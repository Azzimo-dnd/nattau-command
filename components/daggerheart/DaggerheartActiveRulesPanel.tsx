"use client";

type RuleItem = {
  name: string;
  details?: string;
  state?: "loadout" | "vault";
  equipped?: boolean;
  category?: string;
  quantity?: number;
};

function RuleCard({
  item,
  badge,
}: {
  item: RuleItem;
  badge: string;
}) {
  if (!item.details?.trim()) return null;

  return (
    <details className="group rounded-xl border border-[#38252d] bg-black/15 open:border-[#694052]">
      <summary className="cursor-pointer list-none px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#d9c5cb]">{item.name}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7f6971]">
              {badge}
              {(item.quantity ?? 1) > 1 ? ` · ×${item.quantity}` : ""}
            </p>
          </div>
          <span className="text-[#9e6374] transition group-open:rotate-180">⌄</span>
        </div>
      </summary>
      <div className="border-t border-[#2f2026] px-3 py-3 whitespace-pre-wrap text-xs leading-6 text-[#a9959c]">
        {item.details}
      </div>
    </details>
  );
}

export function DaggerheartActiveRulesPanel({
  intrinsicRules,
  domainCards,
  weapons,
  armor,
  inventory,
}: {
  intrinsicRules: RuleItem[];
  domainCards: RuleItem[];
  weapons: RuleItem[];
  armor: RuleItem[];
  inventory: RuleItem[];
}) {
  const activeIntrinsic = intrinsicRules.filter((item) => item.details?.trim());
  const activeCards = domainCards.filter(
    (item) => item.state === "loadout" && item.details?.trim()
  );
  const equippedGear = [...weapons, ...armor].filter(
    (item) => item.equipped !== false && item.details?.trim()
  );
  const carried = inventory.filter((item) => item.details?.trim());

  const total =
    activeIntrinsic.length + activeCards.length + equippedGear.length + carried.length;
  if (total === 0) {
    return (
      <p className="rounded-xl border border-[#34242b] bg-black/15 p-4 text-sm text-[#806f75]">
        No compendium-linked active rules yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs leading-5 text-[#88757c]">
        Dynamic modifiers and resource costs are handled automatically where the rule is deterministic.
        Contextual rules remain visible here so the sheet never guesses whether a narrative condition applies.
      </p>

      {activeIntrinsic.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#956475]">
            Character features
          </p>
          <div className="grid gap-2 lg:grid-cols-2">
            {activeIntrinsic.map((item, index) => (
              <RuleCard
                key={`intrinsic-${item.name}-${index}`}
                item={item}
                badge="Active character source"
              />
            ))}
          </div>
        </div>
      )}

      {activeCards.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#956475]">
            Domain Loadout
          </p>
          <div className="grid gap-2 lg:grid-cols-2">
            {activeCards.map((item, index) => (
              <RuleCard key={`card-${item.name}-${index}`} item={item} badge="Loadout card" />
            ))}
          </div>
        </div>
      )}

      {equippedGear.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#956475]">
            Equipped gear
          </p>
          <div className="grid gap-2 lg:grid-cols-2">
            {equippedGear.map((item, index) => (
              <RuleCard key={`gear-${item.name}-${index}`} item={item} badge="Equipped" />
            ))}
          </div>
        </div>
      )}

      {carried.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#956475]">
            Carried items & consumables
          </p>
          <div className="grid gap-2 lg:grid-cols-2">
            {carried.map((item, index) => (
              <RuleCard key={`inventory-${item.name}-${index}`} item={item} badge="Carried" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
