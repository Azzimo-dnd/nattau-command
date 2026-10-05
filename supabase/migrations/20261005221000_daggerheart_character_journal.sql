create table if not exists public.daggerheart_character_journal_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  character_id uuid not null references public.daggerheart_characters(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_date date not null default current_date,
  session_label text not null default '',
  title text not null default '',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daggerheart_character_journal_session_label_length
    check (char_length(session_label) <= 120),
  constraint daggerheart_character_journal_title_length
    check (char_length(title) <= 160),
  constraint daggerheart_character_journal_content_length
    check (char_length(trim(content)) between 1 and 12000)
);

create index if not exists daggerheart_character_journal_character_chronology_idx
  on public.daggerheart_character_journal_entries
  (character_id, session_date desc, created_at desc);

create index if not exists daggerheart_character_journal_campaign_idx
  on public.daggerheart_character_journal_entries (campaign_id);

create or replace function public.set_daggerheart_character_journal_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daggerheart_character_journal_updated_at
  on public.daggerheart_character_journal_entries;
create trigger daggerheart_character_journal_updated_at
before update on public.daggerheart_character_journal_entries
for each row execute function public.set_daggerheart_character_journal_updated_at();

alter table public.daggerheart_character_journal_entries enable row level security;

revoke all on public.daggerheart_character_journal_entries from anon;
grant select, insert, update, delete
  on public.daggerheart_character_journal_entries to authenticated;

drop policy if exists "Character player and DM can read journal" on public.daggerheart_character_journal_entries;
create policy "Character player and DM can read journal"
on public.daggerheart_character_journal_entries
for select
to authenticated
using (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and exists (
    select 1
    from public.daggerheart_characters character
    where character.id = character_id
      and character.campaign_id = campaign_id
      and character.is_active
      and (
        character.player_id = (select auth.uid())
        or is_campaign_dm(campaign_id)
      )
  )
);

drop policy if exists "Character player and DM can add journal entries" on public.daggerheart_character_journal_entries;
create policy "Character player and DM can add journal entries"
on public.daggerheart_character_journal_entries
for insert
to authenticated
with check (
  author_id = (select auth.uid())
  and (select private.is_active_daggerheart_campaign_member(campaign_id))
  and exists (
    select 1
    from public.daggerheart_characters character
    where character.id = character_id
      and character.campaign_id = campaign_id
      and character.is_active
      and (
        character.player_id = (select auth.uid())
        or is_campaign_dm(campaign_id)
      )
  )
);

drop policy if exists "Character player and DM can edit journal entries" on public.daggerheart_character_journal_entries;
create policy "Character player and DM can edit journal entries"
on public.daggerheart_character_journal_entries
for update
to authenticated
using (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and exists (
    select 1
    from public.daggerheart_characters character
    where character.id = character_id
      and character.campaign_id = campaign_id
      and character.is_active
      and (
        character.player_id = (select auth.uid())
        or is_campaign_dm(campaign_id)
      )
  )
)
with check (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and exists (
    select 1
    from public.daggerheart_characters character
    where character.id = character_id
      and character.campaign_id = campaign_id
      and character.is_active
      and (
        character.player_id = (select auth.uid())
        or is_campaign_dm(campaign_id)
      )
  )
);

drop policy if exists "Character player and DM can delete journal entries" on public.daggerheart_character_journal_entries;
create policy "Character player and DM can delete journal entries"
on public.daggerheart_character_journal_entries
for delete
to authenticated
using (
  (select private.is_active_daggerheart_campaign_member(campaign_id))
  and exists (
    select 1
    from public.daggerheart_characters character
    where character.id = character_id
      and character.campaign_id = campaign_id
      and character.is_active
      and (
        character.player_id = (select auth.uid())
        or is_campaign_dm(campaign_id)
      )
  )
);
