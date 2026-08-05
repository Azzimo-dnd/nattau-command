-- ============================================================
-- Campaign Companion — Multi-Campaign Chat + Notifications v1
--
-- Adds a private Player <-> Game Master channel per campaign,
-- unread counters, read receipts and Realtime-friendly data.
-- Existing Nattau gm_conversations / gm_messages are copied when found.
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.campaign_chat_threads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, player_id)
);

create table if not exists public.campaign_chat_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  thread_id uuid not null references public.campaign_chat_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint campaign_chat_messages_content_check
    check (char_length(trim(content)) between 1 and 4000)
);

create table if not exists public.campaign_chat_reads (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  thread_id uuid not null references public.campaign_chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists campaign_chat_threads_campaign_updated_idx
  on public.campaign_chat_threads(campaign_id, updated_at desc);
create index if not exists campaign_chat_messages_thread_created_idx
  on public.campaign_chat_messages(thread_id, created_at);
create index if not exists campaign_chat_messages_campaign_created_idx
  on public.campaign_chat_messages(campaign_id, created_at desc);
create index if not exists campaign_chat_reads_campaign_user_idx
  on public.campaign_chat_reads(campaign_id, user_id);

create or replace function public.set_campaign_chat_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists campaign_chat_threads_set_updated_at
  on public.campaign_chat_threads;
create trigger campaign_chat_threads_set_updated_at
before update on public.campaign_chat_threads
for each row execute function public.set_campaign_chat_updated_at();

drop trigger if exists campaign_chat_reads_set_updated_at
  on public.campaign_chat_reads;
create trigger campaign_chat_reads_set_updated_at
before update on public.campaign_chat_reads
for each row execute function public.set_campaign_chat_updated_at();

create or replace function public.validate_campaign_chat_relation()
returns trigger
language plpgsql
as $$
declare
  actual_campaign_id uuid;
begin
  select t.campaign_id
    into actual_campaign_id
  from public.campaign_chat_threads t
  where t.id = new.thread_id;

  if actual_campaign_id is null then
    raise exception 'Chat thread was not found.';
  end if;

  if new.campaign_id <> actual_campaign_id then
    raise exception 'Chat record campaign does not match its thread.';
  end if;

  return new;
end;
$$;

drop trigger if exists campaign_chat_messages_validate_relation
  on public.campaign_chat_messages;
create trigger campaign_chat_messages_validate_relation
before insert or update on public.campaign_chat_messages
for each row execute function public.validate_campaign_chat_relation();

drop trigger if exists campaign_chat_reads_validate_relation
  on public.campaign_chat_reads;
create trigger campaign_chat_reads_validate_relation
before insert or update on public.campaign_chat_reads
for each row execute function public.validate_campaign_chat_relation();

create or replace function public.touch_campaign_chat_thread()
returns trigger
language plpgsql
as $$
begin
  update public.campaign_chat_threads
  set updated_at = new.created_at
  where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists campaign_chat_messages_touch_thread
  on public.campaign_chat_messages;
create trigger campaign_chat_messages_touch_thread
after insert on public.campaign_chat_messages
for each row execute function public.touch_campaign_chat_thread();

-- SECURITY DEFINER helper used by RLS without recursive policy checks.
create or replace function public.can_access_campaign_chat_thread(
  target_thread_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_chat_threads t
    join public.campaign_members membership
      on membership.campaign_id = t.campaign_id
     and membership.user_id = auth.uid()
     and membership.is_active = true
    where t.id = target_thread_id
      and (
        t.player_id = auth.uid()
        or membership.role = 'dm'
      )
  );
$$;

grant execute on function public.can_access_campaign_chat_thread(uuid)
  to authenticated;

alter table public.campaign_chat_threads enable row level security;
alter table public.campaign_chat_messages enable row level security;
alter table public.campaign_chat_reads enable row level security;

revoke all on public.campaign_chat_threads from anon;
revoke all on public.campaign_chat_messages from anon;
revoke all on public.campaign_chat_reads from anon;

-- Direct writes go through RPCs. SELECT is required for pages and Realtime.
grant select on public.campaign_chat_threads to authenticated;
grant select on public.campaign_chat_messages to authenticated;
grant select on public.campaign_chat_reads to authenticated;

drop policy if exists "Participants can view chat threads"
  on public.campaign_chat_threads;
create policy "Participants can view chat threads"
on public.campaign_chat_threads
for select
to authenticated
using (public.can_access_campaign_chat_thread(id));

drop policy if exists "Participants can view chat messages"
  on public.campaign_chat_messages;
create policy "Participants can view chat messages"
on public.campaign_chat_messages
for select
to authenticated
using (public.can_access_campaign_chat_thread(thread_id));

drop policy if exists "Participants can view chat read states"
  on public.campaign_chat_reads;
create policy "Participants can view chat read states"
on public.campaign_chat_reads
for select
to authenticated
using (public.can_access_campaign_chat_thread(thread_id));

-- ------------------------------------------------------------
-- Create/open a thread. Players can open only their own thread.
-- A campaign DM can open a thread for an active player member.
-- ------------------------------------------------------------
create or replace function public.get_or_create_campaign_chat_thread(
  p_campaign_slug text,
  p_player_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_role text;
  v_player_id uuid;
  v_thread_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select c.id, cm.role
    into v_campaign_id, v_role
  from public.campaigns c
  join public.campaign_members cm
    on cm.campaign_id = c.id
   and cm.user_id = auth.uid()
   and cm.is_active = true
  where c.slug = p_campaign_slug
    and c.is_active = true;

  if v_campaign_id is null then
    raise exception 'Campaign access denied.';
  end if;

  if v_role = 'dm' then
    v_player_id := p_player_id;
    if v_player_id is null then
      raise exception 'A player must be selected.';
    end if;

    if not exists (
      select 1
      from public.campaign_members cm
      where cm.campaign_id = v_campaign_id
        and cm.user_id = v_player_id
        and cm.role = 'player'
        and cm.is_active = true
    ) then
      raise exception 'The selected player is not an active campaign member.';
    end if;
  else
    v_player_id := auth.uid();
  end if;

  insert into public.campaign_chat_threads (campaign_id, player_id)
  values (v_campaign_id, v_player_id)
  on conflict (campaign_id, player_id) do update
    set player_id = excluded.player_id
  returning id into v_thread_id;

  insert into public.campaign_chat_reads (
    campaign_id,
    thread_id,
    user_id,
    last_read_at
  )
  values (v_campaign_id, v_thread_id, auth.uid(), now())
  on conflict (thread_id, user_id) do nothing;

  return v_thread_id;
end;
$$;

grant execute on function public.get_or_create_campaign_chat_thread(text, uuid)
  to authenticated;

-- ------------------------------------------------------------
-- Send and mark-read RPCs.
-- ------------------------------------------------------------
create or replace function public.send_campaign_chat_message(
  p_thread_id uuid,
  p_content text
)
returns table (
  id uuid,
  campaign_id uuid,
  thread_id uuid,
  sender_id uuid,
  content text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_content text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.can_access_campaign_chat_thread(p_thread_id) then
    raise exception 'Chat access denied.';
  end if;

  v_content := trim(coalesce(p_content, ''));
  if char_length(v_content) < 1 or char_length(v_content) > 4000 then
    raise exception 'Message must contain between 1 and 4000 characters.';
  end if;

  select t.campaign_id
    into v_campaign_id
  from public.campaign_chat_threads t
  where t.id = p_thread_id;

  return query
  insert into public.campaign_chat_messages (
    campaign_id,
    thread_id,
    sender_id,
    content
  )
  values (v_campaign_id, p_thread_id, auth.uid(), v_content)
  returning
    campaign_chat_messages.id,
    campaign_chat_messages.campaign_id,
    campaign_chat_messages.thread_id,
    campaign_chat_messages.sender_id,
    campaign_chat_messages.content,
    campaign_chat_messages.created_at;
end;
$$;

grant execute on function public.send_campaign_chat_message(uuid, text)
  to authenticated;

create or replace function public.mark_campaign_chat_read(p_thread_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_marked_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.can_access_campaign_chat_thread(p_thread_id) then
    raise exception 'Chat access denied.';
  end if;

  select t.campaign_id
    into v_campaign_id
  from public.campaign_chat_threads t
  where t.id = p_thread_id;

  insert into public.campaign_chat_reads (
    campaign_id,
    thread_id,
    user_id,
    last_read_at
  )
  values (v_campaign_id, p_thread_id, auth.uid(), v_marked_at)
  on conflict (thread_id, user_id) do update
    set last_read_at = excluded.last_read_at,
        updated_at = now();

  return v_marked_at;
end;
$$;

grant execute on function public.mark_campaign_chat_read(uuid)
  to authenticated;

-- ------------------------------------------------------------
-- Messages and counterpart context for an open thread.
-- ------------------------------------------------------------
create or replace function public.get_campaign_chat_messages(p_thread_id uuid)
returns table (
  id uuid,
  campaign_id uuid,
  thread_id uuid,
  sender_id uuid,
  sender_name text,
  sender_role text,
  content text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.campaign_id,
    m.thread_id,
    m.sender_id,
    coalesce(p.display_name, 'Unknown wanderer') as sender_name,
    coalesce(cm.role, 'player') as sender_role,
    m.content,
    m.created_at
  from public.campaign_chat_messages m
  join public.campaign_chat_threads t on t.id = m.thread_id
  left join public.profiles p on p.id = m.sender_id
  left join public.campaign_members cm
    on cm.campaign_id = t.campaign_id
   and cm.user_id = m.sender_id
  where m.thread_id = p_thread_id
    and public.can_access_campaign_chat_thread(p_thread_id)
  order by m.created_at asc
  limit 500;
$$;

grant execute on function public.get_campaign_chat_messages(uuid)
  to authenticated;

create or replace function public.get_campaign_chat_thread_context(p_thread_id uuid)
returns table (
  campaign_id uuid,
  campaign_slug text,
  player_id uuid,
  other_user_id uuid,
  other_display_name text,
  other_role text,
  other_last_read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_thread public.campaign_chat_threads%rowtype;
  v_current_role text;
  v_other_user_id uuid;
begin
  if not public.can_access_campaign_chat_thread(p_thread_id) then
    raise exception 'Chat access denied.';
  end if;

  select * into v_thread
  from public.campaign_chat_threads t
  where t.id = p_thread_id;

  select cm.role into v_current_role
  from public.campaign_members cm
  where cm.campaign_id = v_thread.campaign_id
    and cm.user_id = auth.uid()
    and cm.is_active = true;

  if v_current_role = 'dm' then
    v_other_user_id := v_thread.player_id;
  else
    select cm.user_id into v_other_user_id
    from public.campaign_members cm
    where cm.campaign_id = v_thread.campaign_id
      and cm.role = 'dm'
      and cm.is_active = true
    order by cm.joined_at asc
    limit 1;
  end if;

  return query
  select
    v_thread.campaign_id,
    c.slug,
    v_thread.player_id,
    v_other_user_id,
    coalesce(p.display_name, case when v_current_role = 'dm' then 'Player' else 'Game Master' end),
    case when v_current_role = 'dm' then 'player' else 'dm' end,
    r.last_read_at
  from public.campaigns c
  left join public.profiles p on p.id = v_other_user_id
  left join public.campaign_chat_reads r
    on r.thread_id = v_thread.id
   and r.user_id = v_other_user_id
  where c.id = v_thread.campaign_id;
end;
$$;

grant execute on function public.get_campaign_chat_thread_context(uuid)
  to authenticated;

-- ------------------------------------------------------------
-- DM conversation list. Includes active players without a thread.
-- ------------------------------------------------------------
create or replace function public.get_campaign_chat_thread_summaries(
  p_campaign_slug text
)
returns table (
  campaign_id uuid,
  player_id uuid,
  player_display_name text,
  thread_id uuid,
  unread_messages bigint,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select c.id into v_campaign_id
  from public.campaigns c
  where c.slug = p_campaign_slug
    and c.is_active = true;

  if v_campaign_id is null or not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Game Master access is required.';
  end if;

  return query
  select
    v_campaign_id,
    cm.user_id,
    coalesce(p.display_name, 'Unnamed player'),
    t.id,
    coalesce((
      select count(*)
      from public.campaign_chat_messages unread_message
      left join public.campaign_chat_reads own_read
        on own_read.thread_id = t.id
       and own_read.user_id = auth.uid()
      where unread_message.thread_id = t.id
        and unread_message.sender_id <> auth.uid()
        and unread_message.created_at > coalesce(own_read.last_read_at, '-infinity'::timestamptz)
    ), 0)::bigint,
    latest.content,
    latest.created_at,
    latest.sender_id
  from public.campaign_members cm
  left join public.profiles p on p.id = cm.user_id
  left join public.campaign_chat_threads t
    on t.campaign_id = cm.campaign_id
   and t.player_id = cm.user_id
  left join lateral (
    select m.content, m.created_at, m.sender_id
    from public.campaign_chat_messages m
    where m.thread_id = t.id
    order by m.created_at desc
    limit 1
  ) latest on true
  where cm.campaign_id = v_campaign_id
    and cm.role = 'player'
    and cm.is_active = true
  order by
    coalesce((
      select count(*)
      from public.campaign_chat_messages unread_order
      left join public.campaign_chat_reads own_read_order
        on own_read_order.thread_id = t.id
       and own_read_order.user_id = auth.uid()
      where unread_order.thread_id = t.id
        and unread_order.sender_id <> auth.uid()
        and unread_order.created_at > coalesce(own_read_order.last_read_at, '-infinity'::timestamptz)
    ), 0) desc,
    latest.created_at desc nulls last,
    lower(coalesce(p.display_name, '')) asc;
end;
$$;

grant execute on function public.get_campaign_chat_thread_summaries(text)
  to authenticated;

-- ------------------------------------------------------------
-- Badge summary for either a player or a DM.
-- ------------------------------------------------------------
create or replace function public.get_campaign_chat_unread_summary(
  p_campaign_slug text
)
returns table (
  campaign_id uuid,
  unread_messages bigint,
  unread_threads bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_role text;
begin
  select c.id, cm.role
    into v_campaign_id, v_role
  from public.campaigns c
  join public.campaign_members cm
    on cm.campaign_id = c.id
   and cm.user_id = auth.uid()
   and cm.is_active = true
  where c.slug = p_campaign_slug
    and c.is_active = true;

  if v_campaign_id is null then
    raise exception 'Campaign access denied.';
  end if;

  return query
  with accessible_threads as (
    select t.id
    from public.campaign_chat_threads t
    where t.campaign_id = v_campaign_id
      and (v_role = 'dm' or t.player_id = auth.uid())
  ), unread_by_thread as (
    select
      at.id as thread_id,
      count(m.id)::bigint as unread_count
    from accessible_threads at
    left join public.campaign_chat_reads r
      on r.thread_id = at.id
     and r.user_id = auth.uid()
    left join public.campaign_chat_messages m
      on m.thread_id = at.id
     and m.sender_id <> auth.uid()
     and m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
    group by at.id
  )
  select
    v_campaign_id,
    coalesce(sum(ubt.unread_count), 0)::bigint,
    count(*) filter (where ubt.unread_count > 0)::bigint
  from unread_by_thread ubt;
end;
$$;

grant execute on function public.get_campaign_chat_unread_summary(text)
  to authenticated;

-- ------------------------------------------------------------
-- Preserve existing Nattau chat history when old tables exist.
-- Existing history is marked read to avoid a badge flood after migration.
-- ------------------------------------------------------------
do $$
declare
  v_nattau_id uuid;
begin
  select id into v_nattau_id
  from public.campaigns
  where slug = 'nattau';

  if v_nattau_id is null then
    return;
  end if;

  if to_regclass('public.gm_conversations') is not null then
    execute format($copy_threads$
      insert into public.campaign_chat_threads (
        id, campaign_id, player_id, created_at, updated_at
      )
      select old_thread.id, %L::uuid, old_thread.player_id,
             old_thread.created_at, old_thread.updated_at
      from public.gm_conversations old_thread
      where not exists (
        select 1
        from public.campaign_chat_threads current_thread
        where current_thread.campaign_id = %L::uuid
          and current_thread.player_id = old_thread.player_id
      )
        and not exists (
          select 1
          from public.campaign_chat_threads id_conflict
          where id_conflict.id = old_thread.id
        )
    $copy_threads$, v_nattau_id, v_nattau_id);
  end if;

  if to_regclass('public.gm_messages') is not null
     and to_regclass('public.gm_conversations') is not null then
    execute format($copy_messages$
      insert into public.campaign_chat_messages (
        id, campaign_id, thread_id, sender_id, content, created_at
      )
      select
        old_message.id,
        %L::uuid,
        current_thread.id,
        old_message.sender_id,
        old_message.content,
        old_message.created_at
      from public.gm_messages old_message
      join public.gm_conversations old_thread
        on old_thread.id = old_message.conversation_id
      join public.campaign_chat_threads current_thread
        on current_thread.campaign_id = %L::uuid
       and current_thread.player_id = old_thread.player_id
      where not exists (
        select 1
        from public.campaign_chat_messages existing_message
        where existing_message.id = old_message.id
      )
    $copy_messages$, v_nattau_id, v_nattau_id);
  end if;

  -- Mark migrated history as already read for its player and current DMs.
  insert into public.campaign_chat_reads (
    campaign_id, thread_id, user_id, last_read_at
  )
  select v_nattau_id, t.id, t.player_id, now()
  from public.campaign_chat_threads t
  where t.campaign_id = v_nattau_id
  on conflict (thread_id, user_id) do nothing;

  insert into public.campaign_chat_reads (
    campaign_id, thread_id, user_id, last_read_at
  )
  select v_nattau_id, t.id, cm.user_id, now()
  from public.campaign_chat_threads t
  join public.campaign_members cm
    on cm.campaign_id = t.campaign_id
   and cm.role = 'dm'
   and cm.is_active = true
  where t.campaign_id = v_nattau_id
  on conflict (thread_id, user_id) do nothing;
end;
$$;

-- Enable the module in both campaign records.
update public.campaigns
set enabled_modules = case
      when 'gm-chat' = any(enabled_modules) then enabled_modules
      else array_append(enabled_modules, 'gm-chat')
    end,
    updated_at = now()
where slug in ('nattau', 'barovia');

-- Restrict SECURITY DEFINER RPC execution to authenticated users.
revoke all on function public.can_access_campaign_chat_thread(uuid) from public;
revoke all on function public.get_or_create_campaign_chat_thread(text, uuid) from public;
revoke all on function public.send_campaign_chat_message(uuid, text) from public;
revoke all on function public.mark_campaign_chat_read(uuid) from public;
revoke all on function public.get_campaign_chat_messages(uuid) from public;
revoke all on function public.get_campaign_chat_thread_context(uuid) from public;
revoke all on function public.get_campaign_chat_thread_summaries(text) from public;
revoke all on function public.get_campaign_chat_unread_summary(text) from public;

grant execute on function public.can_access_campaign_chat_thread(uuid) to authenticated;
grant execute on function public.get_or_create_campaign_chat_thread(text, uuid) to authenticated;
grant execute on function public.send_campaign_chat_message(uuid, text) to authenticated;
grant execute on function public.mark_campaign_chat_read(uuid) to authenticated;
grant execute on function public.get_campaign_chat_messages(uuid) to authenticated;
grant execute on function public.get_campaign_chat_thread_context(uuid) to authenticated;
grant execute on function public.get_campaign_chat_thread_summaries(text) to authenticated;
grant execute on function public.get_campaign_chat_unread_summary(text) to authenticated;

-- Realtime publication additions are idempotent through catalog checks.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'campaign_chat_messages'
    ) then
      alter publication supabase_realtime add table public.campaign_chat_messages;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'campaign_chat_reads'
    ) then
      alter publication supabase_realtime add table public.campaign_chat_reads;
    end if;
  end if;
end;
$$;

commit;

select
  c.slug,
  count(distinct t.id) as chat_threads,
  count(m.id) as messages
from public.campaigns c
left join public.campaign_chat_threads t on t.campaign_id = c.id
left join public.campaign_chat_messages m on m.thread_id = t.id
where c.slug in ('nattau', 'barovia')
group by c.slug
order by c.slug;
