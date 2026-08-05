-- ============================================================
-- Campaign Companion — Barovia Administration & Onboarding v1
--
-- Adds:
--   * GM member administration
--   * invitation codes for self-service account creation
--   * secure campaign-scoped redemption
--   * activity timestamps
--   * test/progress participation controls
--
-- Requires:
--   * multi-campaign-foundation.sql
-- Recommended before this migration:
--   * barovia-tarokka-system.sql
-- ============================================================

begin;

create extension if not exists pgcrypto;

alter table public.campaign_members
  add column if not exists counts_toward_campaign_progress boolean not null default true,
  add column if not exists is_test_account boolean not null default false,
  add column if not exists last_seen_at timestamptz;

-- Existing Pippo memberships remain fully usable but are clearly marked as
-- tests and excluded from planning / campaign progress totals.
update public.campaign_members cm
set planning_enabled = false,
    counts_toward_campaign_progress = false,
    is_test_account = true,
    updated_at = now()
from public.profiles p
where p.id = cm.user_id
  and lower(trim(coalesce(p.display_name, ''))) = 'pippo';

-- A profile row is created during invitation redemption. This avoids changing
-- or competing with any existing auth.users signup trigger in the project.

create table if not exists public.campaign_invites (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  token_hash bytea not null unique,
  code_preview text not null,
  label text,
  role text not null default 'player',
  planning_enabled boolean not null default true,
  counts_toward_campaign_progress boolean not null default true,
  max_uses integer,
  uses_count integer not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  constraint campaign_invites_role_check check (role = 'player'),
  constraint campaign_invites_max_uses_check check (max_uses is null or max_uses > 0),
  constraint campaign_invites_uses_count_check check (uses_count >= 0),
  constraint campaign_invites_label_length_check check (label is null or char_length(label) <= 80)
);

create index if not exists campaign_invites_campaign_created_idx
  on public.campaign_invites(campaign_id, created_at desc);

create index if not exists campaign_invites_active_expiry_idx
  on public.campaign_invites(campaign_id, is_active, expires_at);

create table if not exists public.campaign_invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.campaign_invites(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (invite_id, user_id)
);

create index if not exists campaign_invite_redemptions_user_idx
  on public.campaign_invite_redemptions(user_id, redeemed_at desc);

alter table public.campaign_invites enable row level security;
alter table public.campaign_invite_redemptions enable row level security;

revoke all on public.campaign_invites from anon, authenticated;
revoke all on public.campaign_invite_redemptions from anon, authenticated;

-- Public preview intentionally exposes only campaign branding and invitation
-- state. It never exposes members, creator email, hidden campaign data or the
-- stored token hash.
create or replace function public.get_campaign_invite_preview(p_code text)
returns table (
  is_valid boolean,
  invalid_reason text,
  campaign_id uuid,
  campaign_slug text,
  campaign_name text,
  companion_name text,
  campaign_subtitle text,
  system_key text,
  theme_key text,
  invite_label text,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_invite public.campaign_invites%rowtype;
  v_campaign public.campaigns%rowtype;
begin
  select ci.*
  into v_invite
  from public.campaign_invites ci
  where ci.token_hash = digest(lower(trim(coalesce(p_code, ''))), 'sha256')
  limit 1;

  if v_invite.id is null then
    return query select false, 'This invitation code is invalid.', null::uuid,
      null::text, null::text, null::text, null::text, null::text, null::text,
      null::text, null::timestamptz;
    return;
  end if;

  select c.* into v_campaign
  from public.campaigns c
  where c.id = v_invite.campaign_id;

  if v_campaign.id is null or v_campaign.is_active = false then
    return query select false, 'This campaign is not currently accepting members.',
      null::uuid, null::text, null::text, null::text, null::text, null::text,
      null::text, null::text, v_invite.expires_at;
    return;
  end if;

  if v_invite.is_active = false then
    return query select false, 'This invitation was revoked by the Game Master.',
      v_campaign.id, v_campaign.slug, v_campaign.name, v_campaign.companion_name,
      v_campaign.subtitle, v_campaign.system_key, v_campaign.theme_key,
      v_invite.label, v_invite.expires_at;
    return;
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    return query select false, 'This invitation has expired.',
      v_campaign.id, v_campaign.slug, v_campaign.name, v_campaign.companion_name,
      v_campaign.subtitle, v_campaign.system_key, v_campaign.theme_key,
      v_invite.label, v_invite.expires_at;
    return;
  end if;

  if v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses then
    return query select false, 'This invitation has already reached its usage limit.',
      v_campaign.id, v_campaign.slug, v_campaign.name, v_campaign.companion_name,
      v_campaign.subtitle, v_campaign.system_key, v_campaign.theme_key,
      v_invite.label, v_invite.expires_at;
    return;
  end if;

  return query select true, null::text,
    v_campaign.id, v_campaign.slug, v_campaign.name, v_campaign.companion_name,
    v_campaign.subtitle, v_campaign.system_key, v_campaign.theme_key,
    v_invite.label, v_invite.expires_at;
end;
$$;

create or replace function public.create_campaign_invite(
  p_campaign_id uuid,
  p_label text default null,
  p_max_uses integer default 1,
  p_expires_in_days integer default 14,
  p_planning_enabled boolean default true,
  p_counts_toward_progress boolean default true
)
returns table (
  invite_id uuid,
  invite_code text,
  invite_path text,
  expires_at timestamptz,
  invite_label text,
  code_preview text,
  max_uses integer,
  uses_count integer,
  planning_enabled boolean,
  counts_toward_progress boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_campaign public.campaigns%rowtype;
  v_code text;
  v_prefix text;
  v_token text;
  v_preview text;
  v_expires_at timestamptz;
  v_id uuid;
  v_created_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a Game Master can create campaign invitations.';
  end if;

  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 100) then
    raise exception 'Maximum uses must be between 1 and 100, or unlimited.';
  end if;

  if p_expires_in_days is not null and (p_expires_in_days < 1 or p_expires_in_days > 365) then
    raise exception 'Expiration must be between 1 and 365 days, or never.';
  end if;

  select c.* into v_campaign
  from public.campaigns c
  where c.id = p_campaign_id
    and c.is_active = true;

  if v_campaign.id is null then
    raise exception 'Campaign not found or inactive.';
  end if;

  v_prefix := upper(substr(regexp_replace(v_campaign.slug, '[^a-zA-Z0-9]', '', 'g'), 1, 10));
  v_token := upper(substr(encode(gen_random_bytes(12), 'hex'), 1, 16));
  v_code := v_prefix || '-' || substr(v_token, 1, 4) || '-' || substr(v_token, 5, 4)
    || '-' || substr(v_token, 9, 4) || '-' || substr(v_token, 13, 4);
  v_preview := v_prefix || '-••••-••••-••••-' || right(v_token, 4);
  v_expires_at := case
    when p_expires_in_days is null then null
    else now() + make_interval(days => p_expires_in_days)
  end;

  insert into public.campaign_invites (
    campaign_id,
    token_hash,
    code_preview,
    label,
    role,
    planning_enabled,
    counts_toward_campaign_progress,
    max_uses,
    expires_at,
    created_by
  )
  values (
    p_campaign_id,
    digest(lower(v_code), 'sha256'),
    v_preview,
    nullif(trim(coalesce(p_label, '')), ''),
    'player',
    coalesce(p_planning_enabled, true),
    coalesce(p_counts_toward_progress, true),
    p_max_uses,
    v_expires_at,
    auth.uid()
  )
  returning campaign_invites.id, campaign_invites.created_at
  into v_id, v_created_at;

  return query select
    v_id,
    v_code,
    '/campaign-invite/' || v_code,
    v_expires_at,
    nullif(trim(coalesce(p_label, '')), ''),
    v_preview,
    p_max_uses,
    0,
    coalesce(p_planning_enabled, true),
    coalesce(p_counts_toward_progress, true),
    v_created_at;
end;
$$;

create or replace function public.list_campaign_invites(p_campaign_id uuid)
returns table (
  invite_id uuid,
  invite_label text,
  code_preview text,
  planning_enabled boolean,
  counts_toward_progress boolean,
  max_uses integer,
  uses_count integer,
  expires_at timestamptz,
  is_active boolean,
  created_at timestamptz,
  created_by_name text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a Game Master can view invitations.';
  end if;

  return query
  select
    ci.id,
    ci.label,
    ci.code_preview,
    ci.planning_enabled,
    ci.counts_toward_campaign_progress,
    ci.max_uses,
    ci.uses_count,
    ci.expires_at,
    ci.is_active,
    ci.created_at,
    coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1))
  from public.campaign_invites ci
  left join auth.users u on u.id = ci.created_by
  left join public.profiles p on p.id = ci.created_by
  where ci.campaign_id = p_campaign_id
  order by ci.created_at desc;
end;
$$;

create or replace function public.revoke_campaign_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
begin
  select ci.campaign_id into v_campaign_id
  from public.campaign_invites ci
  where ci.id = p_invite_id;

  if v_campaign_id is null then
    raise exception 'Invitation not found.';
  end if;

  if not public.is_campaign_dm(v_campaign_id) then
    raise exception 'Only a Game Master can revoke this invitation.';
  end if;

  update public.campaign_invites
  set is_active = false,
      revoked_at = now(),
      revoked_by = auth.uid()
  where id = p_invite_id;
end;
$$;

create or replace function public.redeem_campaign_invite(p_code text)
returns table (
  campaign_id uuid,
  campaign_slug text,
  companion_name text,
  membership_created boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite public.campaign_invites%rowtype;
  v_campaign public.campaigns%rowtype;
  v_existing_member public.campaign_members%rowtype;
  v_already_redeemed boolean;
begin
  if v_user_id is null then
    raise exception 'Sign in before accepting the invitation.';
  end if;

  select ci.*
  into v_invite
  from public.campaign_invites ci
  where ci.token_hash = digest(lower(trim(coalesce(p_code, ''))), 'sha256')
  for update;

  if v_invite.id is null then
    raise exception 'Invitation code is invalid.';
  end if;

  select c.* into v_campaign
  from public.campaigns c
  where c.id = v_invite.campaign_id
  for share;

  if v_campaign.id is null or v_campaign.is_active = false then
    raise exception 'Campaign is not currently active.';
  end if;

  if v_invite.is_active = false then
    raise exception 'Invitation was revoked.';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'Invitation has expired.';
  end if;

  select cm.* into v_existing_member
  from public.campaign_members cm
  where cm.campaign_id = v_campaign.id
    and cm.user_id = v_user_id;

  if v_existing_member.user_id is not null and v_existing_member.is_active = true then
    return query select v_campaign.id, v_campaign.slug, v_campaign.companion_name, false;
    return;
  end if;

  select exists (
    select 1
    from public.campaign_invite_redemptions cir
    where cir.invite_id = v_invite.id
      and cir.user_id = v_user_id
  ) into v_already_redeemed;

  if v_already_redeemed then
    raise exception 'This account already used this invitation. Ask the Game Master to restore access.';
  end if;

  if v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses then
    raise exception 'Invitation has reached its usage limit.';
  end if;

  -- Create the application profile when the invitation is redeemed.
  insert into public.profiles (id, display_name, role, planning_enabled)
  select
    u.id,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'New player'
    ),
    'player',
    true
  from auth.users u
  where u.id = v_user_id
  on conflict (id) do nothing;

  insert into public.campaign_members (
    campaign_id,
    user_id,
    role,
    planning_enabled,
    counts_toward_campaign_progress,
    is_test_account,
    is_active,
    joined_at,
    last_seen_at
  )
  values (
    v_campaign.id,
    v_user_id,
    'player',
    v_invite.planning_enabled,
    v_invite.counts_toward_campaign_progress,
    false,
    true,
    now(),
    now()
  )
  on conflict on constraint campaign_members_pkey do update
  set role = 'player',
      planning_enabled = excluded.planning_enabled,
      counts_toward_campaign_progress = excluded.counts_toward_campaign_progress,
      is_test_account = false,
      is_active = true,
      last_seen_at = now(),
      updated_at = now();

  insert into public.campaign_invite_redemptions (
    invite_id,
    campaign_id,
    user_id
  )
  values (v_invite.id, v_campaign.id, v_user_id);

  update public.campaign_invites
  set uses_count = uses_count + 1
  where id = v_invite.id;

  return query select v_campaign.id, v_campaign.slug, v_campaign.companion_name, true;
end;
$$;

create or replace function public.list_campaign_admin_members(p_campaign_id uuid)
returns table (
  user_id uuid,
  display_name text,
  email text,
  member_role text,
  planning_enabled boolean,
  counts_toward_progress boolean,
  is_test_account boolean,
  is_active boolean,
  joined_at timestamptz,
  last_seen_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a Game Master can view campaign members.';
  end if;

  return query
  select
    cm.user_id,
    coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(u.email, ''), '@', 1),
      'Unknown soul'
    ),
    u.email::text,
    cm.role,
    cm.planning_enabled,
    cm.counts_toward_campaign_progress,
    cm.is_test_account,
    cm.is_active,
    cm.joined_at,
    cm.last_seen_at
  from public.campaign_members cm
  join auth.users u on u.id = cm.user_id
  left join public.profiles p on p.id = cm.user_id
  where cm.campaign_id = p_campaign_id
  order by
    cm.is_active desc,
    case when cm.role = 'dm' then 0 else 1 end,
    lower(coalesce(p.display_name, u.email, ''));
end;
$$;

create or replace function public.update_campaign_member_admin(
  p_campaign_id uuid,
  p_user_id uuid,
  p_role text,
  p_planning_enabled boolean,
  p_counts_toward_progress boolean,
  p_is_test_account boolean,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.campaign_members%rowtype;
  v_other_active_dms integer;
begin
  if not public.is_campaign_dm(p_campaign_id) then
    raise exception 'Only a Game Master can edit campaign members.';
  end if;

  if p_role not in ('dm', 'player') then
    raise exception 'Invalid campaign role.';
  end if;

  select cm.* into v_current
  from public.campaign_members cm
  where cm.campaign_id = p_campaign_id
    and cm.user_id = p_user_id
  for update;

  if v_current.user_id is null then
    raise exception 'Campaign member not found.';
  end if;

  if v_current.role = 'dm' and v_current.is_active = true
     and (p_role <> 'dm' or p_is_active = false) then
    select count(*) into v_other_active_dms
    from public.campaign_members cm
    where cm.campaign_id = p_campaign_id
      and cm.user_id <> p_user_id
      and cm.role = 'dm'
      and cm.is_active = true;

    if v_other_active_dms = 0 then
      raise exception 'A campaign must keep at least one active Game Master.';
    end if;
  end if;

  update public.campaign_members
  set role = p_role,
      planning_enabled = coalesce(p_planning_enabled, true),
      counts_toward_campaign_progress = coalesce(p_counts_toward_progress, true),
      is_test_account = coalesce(p_is_test_account, false),
      is_active = coalesce(p_is_active, true),
      updated_at = now()
  where campaign_id = p_campaign_id
    and user_id = p_user_id;
end;
$$;

create or replace function public.touch_campaign_activity(p_campaign_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.campaign_members cm
  set last_seen_at = now(),
      updated_at = now()
  from public.campaigns c
  where cm.campaign_id = c.id
    and c.slug = p_campaign_slug
    and cm.user_id = auth.uid()
    and cm.is_active = true;
end;
$$;

revoke all on function public.get_campaign_invite_preview(text) from public;
revoke all on function public.create_campaign_invite(uuid, text, integer, integer, boolean, boolean) from public;
revoke all on function public.list_campaign_invites(uuid) from public;
revoke all on function public.revoke_campaign_invite(uuid) from public;
revoke all on function public.redeem_campaign_invite(text) from public;
revoke all on function public.list_campaign_admin_members(uuid) from public;
revoke all on function public.update_campaign_member_admin(uuid, uuid, text, boolean, boolean, boolean, boolean) from public;
revoke all on function public.touch_campaign_activity(text) from public;

grant execute on function public.get_campaign_invite_preview(text) to anon, authenticated;
grant execute on function public.create_campaign_invite(uuid, text, integer, integer, boolean, boolean) to authenticated;
grant execute on function public.list_campaign_invites(uuid) to authenticated;
grant execute on function public.revoke_campaign_invite(uuid) to authenticated;
grant execute on function public.redeem_campaign_invite(text) to authenticated;
grant execute on function public.list_campaign_admin_members(uuid) to authenticated;
grant execute on function public.update_campaign_member_admin(uuid, uuid, text, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.touch_campaign_activity(text) to authenticated;

commit;

-- Verification output
select
  c.slug,
  p.display_name,
  cm.role,
  cm.planning_enabled,
  cm.counts_toward_campaign_progress,
  cm.is_test_account,
  cm.is_active,
  cm.last_seen_at
from public.campaign_members cm
join public.campaigns c on c.id = cm.campaign_id
left join public.profiles p on p.id = cm.user_id
where c.slug = 'barovia'
order by cm.role, p.display_name;
