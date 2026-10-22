-- Nattau Fate balance pass, targeted to numerical bonuses that were weak at levels 10–12.
-- Seven of 24 live reward faces change; the 10 inactive draft cards remain untouched.
-- Do NOT rewrite historical draws. Only current Battle of UĆ draw snapshots are updated.
begin;

create temporary table _nattau_fate_balance_patch (
  slug text not null,
  is_reversed boolean not null,
  old_description text not null,
  new_description text not null,
  primary key (slug,is_reversed)
) on commit drop;

insert into _nattau_fate_balance_patch(slug,is_reversed,old_description,new_description)
values
  ('the-magician', false, 'Once, add 1d4 to an Arcana, Investigation, or tool check after seeing the d20 but before the outcome is declared.', 'Once, add twice your proficiency bonus to an Arcana, Investigation, or tool check after seeing the d20 but before the outcome is declared.'),
  ('the-lovers', true, 'Once, when another player you can see fails an ability check, let them add 1d4 to the result. You cannot choose yourself.', 'Once, when another player you can see fails an ability check, let them add twice your proficiency bonus to the result. You cannot choose yourself.'),
  ('the-chariot', true, 'Once, ignore difficult terrain and increase your speed by 10 feet until the end of your turn.', 'Once, ignore difficult terrain and increase your speed by 5 feet times your proficiency bonus until the end of your turn.'),
  ('wheel-of-fortune', false, 'Once, reroll one damage, healing, or random-effect die that is not a d20. You must use the new result.', 'Once, after rolling damage or healing, choose one creature affected. For that creature only, reroll up to your proficiency bonus of the damage or healing dice and keep the higher result for each rerolled die, then add your character level to its damage or healing (healing cannot exceed its hit point maximum). Alternatively, reroll one non-d20 random-effect die; you must use the new result and do not add your level.'),
  ('death', true, 'Once after completing a short rest, regain one expended Hit Die.', 'Once during a short rest, regain up to your proficiency bonus expended Hit Dice. You may immediately spend any of those regained Hit Dice to heal as part of that rest, using the normal Hit Die rules.'),
  ('the-tower', true, 'Once, when you fail a Dexterity saving throw against a trap, collapse, explosion, or area effect, reduce the damage you take by twice your proficiency bonus.', 'Once, when you fail a Dexterity saving throw against a trap, collapse, explosion, or area effect, reduce the damage you take from that event by your character level multiplied by your proficiency bonus (minimum 0 damage), after applying any resistance or vulnerability.'),
  ('the-star', true, 'Once when you receive magical or mundane healing, maximize one healing die.', 'Once when you receive magical or mundane healing, maximize up to your proficiency bonus healing dice affecting you, and regain additional hit points equal to your character level, without exceeding your hit point maximum.');

do $nattau_balance$
declare
  changed_rows integer;
begin
  update public.fate_cards AS fc
  set
    upright_reward_description = case when NOT p.is_reversed then p.new_description else fc.upright_reward_description end,
    reversed_reward_description = case when p.is_reversed then p.new_description else fc.reversed_reward_description end,
    updated_at = now()
  from _nattau_fate_balance_patch AS p
  where fc.slug = p.slug
    and fc.is_active = true
    and fc.is_ready = true
    and (case when p.is_reversed then fc.reversed_reward_description else fc.upright_reward_description end) = p.old_description;

  get diagnostics changed_rows = row_count;
  if changed_rows <> 7 then
    raise exception 'Fate balance expected exactly 7 live cards to update, got %. Check original rewards.', changed_rows;
  end if;
end;
$nattau_balance$;

-- Rewards are snapshotted when claimed. Bring only today's active battle draw into
-- alignment with the current GM ruling; never revise draws from earlier cycles.
update public.fate_draws AS d
set reward_description_snapshot = p.new_description
from public.fate_cycles AS cycle,
     public.fate_cards AS fc,
     _nattau_fate_balance_patch AS p
where d.cycle_id = cycle.id
  and cycle.cycle_number = 6
  and cycle.title = 'Battle of UĆ'
  and cycle.is_active = true
  and d.card_id = fc.id
  and fc.slug = p.slug
  and d.is_reversed = p.is_reversed
  and d.reward_description_snapshot = p.old_description;

commit;
