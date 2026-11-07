import { daggerheartEquipmentRulesText } from "@/lib/daggerheart/equipment";

export function DaggerheartEquipmentFeature({
  item,
  kind,
}: {
  item: { name: string; rules_text?: string; details?: string };
  kind: "Weapon" | "Armor";
}) {
  const rules = daggerheartEquipmentRulesText(item);
  if (!rules) return null;

  const feature = rules.match(/^([^:\n]{1,80}):\s*([\s\S]+)$/);

  return (
    <div
      role="note"
      aria-label={`${item.name} feature`}
      className="mt-4 rounded-xl border border-[#64404d] bg-[#2a1720]/65 px-3 py-3 sm:px-4"
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#bd8797]">
        {`${kind} feature`}
      </p>
      <p className="mt-1 break-words whitespace-pre-wrap text-sm leading-6 text-[#d9c5cc]">
        {feature ? (
          <>
            <strong className="font-black text-[#f0dce2]">{feature[1]}: </strong>
            {feature[2]}
          </>
        ) : rules}
      </p>
    </div>
  );
}
