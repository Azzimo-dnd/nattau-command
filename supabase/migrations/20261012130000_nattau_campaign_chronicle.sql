-- Campaign Chronicle entries live in Supabase instead of a hardcoded dashboard array.
-- Reads are restricted to active campaign members; editing is restricted to that campaign's GM.
create table if not exists public.campaign_chronicle_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  seed_key text,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  description text not null check (char_length(btrim(description)) between 1 and 2500),
  tag text not null check (char_length(btrim(tag)) between 1 and 50),
  sort_index integer not null default 0,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, seed_key)
);

create index if not exists campaign_chronicle_entries_recent_idx
  on public.campaign_chronicle_entries (campaign_id, created_at desc, sort_index desc);

create or replace function public.update_campaign_chronicle_timestamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists campaign_chronicle_timestamp on public.campaign_chronicle_entries;
create trigger campaign_chronicle_timestamp
before update on public.campaign_chronicle_entries
for each row execute function public.update_campaign_chronicle_timestamp();

alter table public.campaign_chronicle_entries enable row level security;
revoke all on public.campaign_chronicle_entries from anon;
grant select, insert, update, delete on public.campaign_chronicle_entries to authenticated;

drop policy if exists "Active campaign members read chronicle" on public.campaign_chronicle_entries;
create policy "Active campaign members read chronicle"
on public.campaign_chronicle_entries for select to authenticated
using (public.is_campaign_member(campaign_id));

drop policy if exists "Campaign GMs add chronicle" on public.campaign_chronicle_entries;
create policy "Campaign GMs add chronicle"
on public.campaign_chronicle_entries for insert to authenticated
with check (public.is_campaign_dm(campaign_id) and created_by = (select auth.uid()));

drop policy if exists "Campaign GMs edit chronicle" on public.campaign_chronicle_entries;
create policy "Campaign GMs edit chronicle"
on public.campaign_chronicle_entries for update to authenticated
using (public.is_campaign_dm(campaign_id))
with check (public.is_campaign_dm(campaign_id));

drop policy if exists "Campaign GMs delete chronicle" on public.campaign_chronicle_entries;
create policy "Campaign GMs delete chronicle"
on public.campaign_chronicle_entries for delete to authenticated
using (public.is_campaign_dm(campaign_id));

-- Import only the twelve player-approved entries. The three old placeholders are deliberately excluded.
insert into public.campaign_chronicle_entries
  (campaign_id, seed_key, title, description, tag, sort_index)
select c.id, seed.seed_key, seed.title, seed.description, seed.tag, seed.sort_index
from public.campaigns c
cross join (values
  ('nattau-approved-01', 'Sebilla''s Ship Destroyed', 'Acting on direct orders from the party, the spectral circus troupe destroyed Sebilla''s ship, bringing the vessel''s voyage to a violent end.', 'Military', 120),
  ('nattau-approved-02', 'The Mine Holds Against Attack', 'The mine came under attack, but its defenders successfully repelled the assault and maintained control of the facility.', 'Military', 110),
  ('nattau-approved-03', 'Imperial Officer Interrogated', 'An officer of the Empire was interrogated following the recent confrontation with Imperial forces.', 'Intelligence', 100),
  ('nattau-approved-04', 'Fifty Recruits Survive Kevin''s Training', 'The grueling military training overseen by Kevin has concluded. Of the sixty volunteers who entered the program, only fifty survived.', 'Military', 90),
  ('nattau-approved-05', 'Reinforcements Assigned to Ared', 'The party ordered a portion of the newly trained recruits to join Ared''s forces, strengthening border security and the defenses of the settlement.', 'Military', 80),
  ('nattau-approved-06', 'The Buried Chamber of Dom Strażnika', 'Previously locked doors within the fortress of Dom Strażnika were finally opened, revealing a chamber buried beneath rubble. The Guardian was discovered lying beneath the debris. Khael and others have begun clearing the collapsed room.', 'Discovery', 70),
  ('nattau-approved-07', 'Kealith and Drakar Brought to Safety', 'Sally and Albert successfully located Kealith and Drakar and escorted them back to the fortress of Dom Strażnika.', 'Settlement', 60),
  ('nattau-approved-08', 'Mother Tyllen''s Child Draws Near', 'An important moment approaches for Torsten''s family. Mother Tyllen is now less than a month away from giving birth.', 'Personal', 50),
  ('nattau-approved-09', 'New Clues in the Search for the Key', 'Szejmus provided valuable information regarding the missing key, confirming that it is neither in the city nor with the Cult of Mazamundi.', 'Intelligence', 40),
  ('nattau-approved-10', 'Pippo Assigned a Diplomatic Mission', 'Pippo was entrusted with a trade and diplomatic mission to Avanui, tasked with establishing relations and exploring opportunities for cooperation.', 'Diplomacy', 30),
  ('nattau-approved-11', 'Tsalan Agrees to a Meeting', 'The party established contact with Tsalan. Although displeased by the manner in which he was approached, Tsalan agreed to meet Pippo in Pipport.', 'Diplomacy', 20),
  ('nattau-approved-12', 'The Search for Mariusz', 'Odetta entrusted Kevin with the task of locating Mariusz, setting a new search in motion.', 'Quest', 10)
) as seed(seed_key, title, description, tag, sort_index)
where c.slug = 'nattau'
on conflict (campaign_id, seed_key) do nothing;
