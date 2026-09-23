"use client";

import {
  actionAvailable,
  actionUses,
  type DaggerheartActionCharacter,
  type DaggerheartActionReset,
  type DaggerheartActionSource,
} from "@/lib/daggerheart/actions";

const resetLabels: Record<DaggerheartActionReset, string> = {
  scene: "Reset scene",
  rest: "Reset rest",
  long_rest: "Reset long rest",
  session: "Reset session",
};

function actionMeta(source: DaggerheartActionSource) {
  const bits: string[] = [];
  const cost = source.action.cost;
  if (cost?.hope) bits.push(`Spend ${cost.hope} Hope`);
  if (cost?.stress) bits.push(`Mark ${cost.stress} Stress`);
  if (cost?.armor) bits.push(`Mark ${cost.armor} Armor`);
  if (source.action.consume_quantity) {
    bits.push(`Consume ×${source.action.consume_quantity}`);
  }
  if (source.action.availability === "during_rest") bits.push("During rest");
  if (source.action.limit) {
    bits.push(
      `${source.action.limit.uses} / ${source.action.limit.reset.replaceAll("_", " ")}`
    );
  }
  return bits;
}

export function DaggerheartActionsPanel({
  character,
  sources,
  lastMessage,
  onUse,
  onReset,
}: {
  character: DaggerheartActionCharacter;
  sources: DaggerheartActionSource[];
  lastMessage: string | null;
  onUse: (source: DaggerheartActionSource) => void;
  onReset: (reset: DaggerheartActionReset) => void;
}) {
  const activeSources = sources.filter((source) => source.active);

  return (
    <div className="space-y-4">
      {lastMessage && (
        <div className="rounded-xl border border-[#59404a] bg-black/20 px-4 py-3 text-sm text-[#d5bec5]">
          {lastMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(["scene", "rest", "long_rest", "session"] as DaggerheartActionReset[]).map(
          (reset) => (
            <button
              key={reset}
              type="button"
              onClick={() => onReset(reset)}
              className="min-h-9 rounded-lg border border-[#45303a] bg-[#171016] px-3 text-xs font-bold text-[#a9939a] transition hover:border-[#714353] hover:text-[#d8c2c9]"
            >
              {resetLabels[reset]}
            </button>
          )
        )}
      </div>

      {activeSources.length === 0 ? (
        <p className="rounded-xl border border-[#34242b] bg-black/15 p-4 text-sm text-[#806f75]">
          No resource actions are currently available from equipped gear, Loadout cards, or carried consumables.
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {activeSources.map((source) => {
            const availability = actionAvailable(character, source);
            const used = actionUses(character.effect_state, source.action_key);
            const meta = actionMeta(source);

            return (
              <div
                key={source.action_key}
                className="rounded-xl border border-[#3d2931] bg-black/15 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[#decbd1]">
                      {source.action.label}
                    </p>
                    <p className="mt-1 text-xs text-[#886f78]">
                      {source.source_name}
                    </p>
                  </div>
                  {source.quantity !== null && (
                    <span className="rounded-full border border-[#4c323c] bg-black/20 px-2.5 py-1 text-[10px] font-bold text-[#ad929b]">
                      ×{source.quantity}
                    </span>
                  )}
                </div>

                {source.action.description && (
                  <p className="mt-3 text-xs leading-5 text-[#9f8990]">
                    {source.action.description}
                  </p>
                )}

                {meta.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {meta.map((item) => (
                      <span
                        key={item}
                        className="rounded-md border border-[#3d2a31] bg-[#160e12] px-2 py-1 text-[10px] font-semibold text-[#9f858e]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                {source.action.limit && (
                  <p className="mt-2 text-[11px] text-[#746169]">
                    Used {used}/{source.action.limit.uses}
                  </p>
                )}

                <button
                  type="button"
                  disabled={!availability.ok}
                  onClick={() => onUse(source)}
                  className="mt-3 min-h-10 w-full rounded-lg border border-[#83495b] bg-[#481827] px-3 text-sm font-black text-[#eed8de] transition hover:bg-[#5a2031] disabled:cursor-not-allowed disabled:border-[#3b2a30] disabled:bg-[#171015] disabled:text-[#6f5f64]"
                >
                  {availability.ok ? "Use" : availability.reason}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
