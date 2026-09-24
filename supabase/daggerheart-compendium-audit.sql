-- Daggerheart compendium / character-sheet QA queries.
-- This file intentionally contains no private compendium seed text.
-- Run after importing/reseeding rules data or changing Daggerheart access SQL.

-- 1. Obvious PDF/table extraction artifacts that should never remain in rules_text.
select name, slug, category, left(rules_text, 300) as rules_preview
from public.daggerheart_compendium_entries
where is_active = true
  and (
    rules_text ~* 'ROLL[[:space:]]+LOOT[[:space:]]+description'
    or rules_text ~* 'Daggerheart[[:space:]]*©|DH Core[[:space:]]+[0-9]+/[0-9]+'
    or rules_text ~* 'Chapter[[:space:]]+[0-9]+:'
    or rules_text ~* 'TIER[[:space:]]+[1-4][[:space:]]*\\(LEVEL'
    or rules_text ~* 'PRIMARY WEAPON TABLES|SECONDARY WEAPON TABLES|ARMOR TABLES'
  )
order by category, name;

-- 2. Gear with a structured first-effect label that does not match the canonical
-- feature prefix at the start of rules_text. Review returned rows manually because
-- derived effect labels such as "Vitreous penalty" can be intentionally more specific.
with first_fx as (
  select
    e.name,
    e.slug,
    e.category,
    e.rules_text,
    e.effects->0->>'label' as effect_label,
    trim((regexp_match(e.rules_text, '^([^:\\n]{1,80}):'))[1]) as rules_feature
  from public.daggerheart_compendium_entries e
  where e.is_active = true
    and e.category in ('weapon_primary','weapon_secondary','armor')
    and jsonb_array_length(e.effects) > 0
)
select name, slug, category, rules_feature, effect_label, rules_text
from first_fx
where rules_feature is not null
  and effect_label is not null
  and lower(replace(effect_label, '’', '''')) <> lower(replace(rules_feature, '’', ''''))
  and lower(effect_label) not like lower(rules_feature) || ' ·%'
order by category, name;

-- 3. Browser-role table privileges. Expected:
-- daggerheart_compendium_entries: authenticated SELECT only, no anon grants.
-- daggerheart_characters: authenticated SELECT/INSERT/UPDATE/DELETE only, no anon grants.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('daggerheart_characters','daggerheart_compendium_entries')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- 4. Public Daggerheart RPC grants. These RPCs should not be executable by anon/PUBLIC.
select routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where specific_schema = 'public'
  and routine_name in ('search_daggerheart_compendium','list_daggerheart_character_roster')
  and grantee in ('PUBLIC','anon','authenticated')
order by routine_name, grantee;
