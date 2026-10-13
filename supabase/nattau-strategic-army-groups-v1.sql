-- Strategic army groups: source of truth restricted to campaign GM.
create table if not exists public.campaign_strategic_army_groups (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 faction_key text not null,
 name text not null check (char_length(trim(name)) between 1 and 120),
 commander text not null default '',
 composition text not null default '',
 strength integer not null default 0 check (strength >= 0),
 orders text not null default 'Holding',
 condition text not null default '',
 gm_notes text not null default '',
 visibility text not null default 'hidden' check (visibility in ('public','rumored','hidden')),
 province_number integer,
 pos_x numeric(6,3) not null default 50 check (pos_x between 0 and 100),
 pos_y numeric(6,3) not null default 50 check (pos_y between 0 and 100),
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key (campaign_id,faction_key) references public.campaign_strategic_factions(campaign_id,faction_key),
 foreign key (campaign_id,province_number) references public.campaign_strategic_provinces(campaign_id,province_number)
);
create index if not exists campaign_strategic_army_groups_campaign_idx on public.campaign_strategic_army_groups(campaign_id,archived_at);
alter table public.campaign_strategic_army_groups enable row level security;
create policy "Strategic army group GM read" on public.campaign_strategic_army_groups for select to authenticated using (public.is_campaign_dm(campaign_id));
create policy "Strategic army group GM insert" on public.campaign_strategic_army_groups for insert to authenticated with check (public.is_campaign_dm(campaign_id));
create policy "Strategic army group GM update" on public.campaign_strategic_army_groups for update to authenticated using (public.is_campaign_dm(campaign_id)) with check (public.is_campaign_dm(campaign_id));
create policy "Strategic army group GM delete" on public.campaign_strategic_army_groups for delete to authenticated using (public.is_campaign_dm(campaign_id));
grant select, insert, update, delete on public.campaign_strategic_army_groups to authenticated;
-- Player-facing RPC explicitly projects only approved columns; hidden groups are excluded.
-- Rumors include province_number only; never exact coordinates, commander, strength or GM notes.
create or replace function public.get_visible_strategic_army_groups(p_campaign_id uuid)
returns table(id uuid, name text, faction_key text, visibility text, strength integer, commander text, composition text, orders text, condition text, province_number integer, pos_x numeric, pos_y numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.is_campaign_member(p_campaign_id) then
   raise exception 'Not a member of this campaign';
 end if;
 return query
 select g.id,
        case when g.visibility='rumored' then 'Unidentified military force' else g.name end,
        case when g.visibility='rumored' then 'unknown' else g.faction_key end,
        g.visibility,
        case when g.visibility='public' then g.strength else null end,
        case when g.visibility='public' then g.commander else null end,
        case when g.visibility='public' then g.composition else null end,
        case when g.visibility='public' then g.orders else null end,
        case when g.visibility='public' then g.condition else null end,
        g.province_number,
        case when g.visibility='public' then g.pos_x else null end,
        case when g.visibility='public' then g.pos_y else null end
 from public.campaign_strategic_army_groups g
 where g.campaign_id=p_campaign_id and g.archived_at is null and g.visibility in ('public','rumored');
end $$;
revoke all on function public.get_visible_strategic_army_groups(uuid) from public, anon;
grant execute on function public.get_visible_strategic_army_groups(uuid) to authenticated, service_role;