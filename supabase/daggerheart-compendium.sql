-- Private Daggerheart compendium schema.
-- Source-book content is intentionally NOT committed to this public repository.
-- The private seed data is maintained in Supabase and is readable only by active
-- members of a Daggerheart campaign.

create table if not exists public.daggerheart_compendium_entries (
  id uuid primary key default gen_random_uuid(),
  source_key text not null check (source_key in ('core','hope-fear')),
  category text not null,
  slug text not null,
  name text not null,
  parent_slug text,
  domain text,
  level integer,
  tier integer,
  summary text not null default '',
  rules_text text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  source_page_start integer,
  source_page_end integer,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_key, category, slug)
);

create index if not exists daggerheart_compendium_category_idx
  on public.daggerheart_compendium_entries(category, is_active, sort_order);

create index if not exists daggerheart_compendium_domain_level_idx
  on public.daggerheart_compendium_entries(domain, level)
  where domain is not null;

create index if not exists daggerheart_compendium_parent_idx
  on public.daggerheart_compendium_entries(parent_slug)
  where parent_slug is not null;

create index if not exists daggerheart_compendium_name_search_idx
  on public.daggerheart_compendium_entries
  using gin (to_tsvector('english', name || ' ' || summary || ' ' || rules_text));

alter table public.daggerheart_compendium_entries enable row level security;

create schema if not exists private;

create or replace function private.has_daggerheart_compendium_access()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $
  select exists (
    select 1
    from public.campaign_members cm
    join public.campaigns c on c.id = cm.campaign_id
    where cm.user_id = (select auth.uid())
      and cm.is_active = true
      and c.is_active = true
      and c.system_key = 'daggerheart'
  );
$;

revoke all on function private.has_daggerheart_compendium_access() from public;
grant usage on schema private to authenticated;
grant execute on function private.has_daggerheart_compendium_access() to authenticated;

drop policy if exists "Daggerheart players can read compendium"
  on public.daggerheart_compendium_entries;

create policy "Daggerheart players can read compendium"
on public.daggerheart_compendium_entries
for select
to authenticated
using ((select private.has_daggerheart_compendium_access()));

revoke all on public.daggerheart_compendium_entries from anon;
revoke insert, update, delete on public.daggerheart_compendium_entries from authenticated;
grant select on public.daggerheart_compendium_entries to authenticated;

create or replace function public.set_daggerheart_compendium_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daggerheart_compendium_set_updated_at
  on public.daggerheart_compendium_entries;

create trigger daggerheart_compendium_set_updated_at
before update on public.daggerheart_compendium_entries
for each row execute function public.set_daggerheart_compendium_updated_at();

create or replace function public.search_daggerheart_compendium(
  p_query text default null,
  p_category text default null,
  p_domain text default null,
  p_level integer default null,
  p_limit integer default 100
)
returns setof public.daggerheart_compendium_entries
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select e.*
  from public.daggerheart_compendium_entries e
  where e.is_active = true
    and (p_category is null or e.category = p_category)
    and (p_domain is null or e.domain = p_domain)
    and (p_level is null or e.level = p_level)
    and (
      nullif(trim(coalesce(p_query, '')), '') is null
      or to_tsvector('english', e.name || ' ' || e.summary || ' ' || e.rules_text)
        @@ websearch_to_tsquery('english', p_query)
      or e.name ilike '%' || p_query || '%'
    )
  order by e.category, e.sort_order, e.name
  limit greatest(1, least(coalesce(p_limit, 100), 250));
$$;

grant execute on function public.search_daggerheart_compendium(
  text, text, text, integer, integer
) to authenticated;
