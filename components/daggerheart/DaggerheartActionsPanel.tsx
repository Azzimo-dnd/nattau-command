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
  if (cost?.special_resource) {
    bits.push(
      `Spend ${cost.special_resource.amount} ${cost.special_resource.name}`
    );
  }
  if (source.action.consume_quantity) {
    bits.push(`Consume ×${source.action.consume_quantity}`);
  }
  if (source.action.availability === "during_rest") bits.push("During rest");
  for (const result of source.action.results ?? []) {
    const amount = result.all
      ? "all"
      : result.roll
        ? `${result.roll.count}d${result.roll.die}${
            (result.roll.bonus ?? 0) > 0 ? `+${result.roll.bonus}` : ""
          }`
        : String(result.amount ?? 0);
    bits.push(
      `${result.type === "clear" ? "Clear" : "Gain"} ${amount} ${result.resource}`
    );
  }
  if (source.action.activate_effect_roll) {
    bits.push(
      `Roll ${source.action.activate_effect_roll.count}d${source.action.activate_effect_roll.die} for effect`
    );
  }
  if (source.action.limit) {
    bits.push(
      `${source.action.limit.uses} / ${source.action.limit.reset.replaceAll(
        "_",
        " "
      )}`
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
    <div className="space-y-3">
      {lastMessage && (
        <div className="rounded-xl border border-[#59404a] bg-black/20 px-4 py-3 text-sm text-[#d5bec5]">
          {lastMessage}
        </div>
      )}

      {activeSources.length === 0 ? (
        <p className="rounded-xl border border-[#34242b] bg-black/15 p-4 text-sm text-[#806f75]">
          No resource actions are currently available from equipped gear, Loadout
          cards, or carried consumables.
        </p>
      ) : (
        <div className="space-y-2">
          {activeSources.map((source) => {
            const availability = actionAvailable(character, source);
            const used = actionUses(
              character.effect_state,
              source.action_key
            );
            const meta = actionMeta(source);

            return (
              <article
                key={source.action_key}
                className="rounded-xl border border-[#3d2931] bg-black/15 p-3"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-[#decbd1]">
                        {source.action.label}
                      </p>
                      {source.quantity !== null && (
                        <span className="rounded-full border border-[#4c323c] bg-black/20 px-2 py-0.5 text-[11px] font-bold text-[#ad929b]">
                          ×{source.quantity}
                        </span>
                      )}
                      {source.action.limit && (
                        <span className="text-xs text-[#806a72]">
                          Used {used}/{source.action.limit.uses}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#886f78]">
                      {source.source_name}
                    </p>
                    {meta.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {meta.slice(0, 3).map((item) => (
                          <span
                            key={item}
                            className="rounded-md border border-[#3d2a31] bg-[#160e12] px-2 py-1 text-[11px] font-semibold text-[#a18991]"
                          >
                            {item}
                          </span>
                        ))}
                        {meta.length > 3 && (
                          <span className="px-1 py-1 text-[11px] text-[#756169]">
                            +{meta.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!availability.ok}
                    onClick={() => onUse(source)}
                    className="min-h-11 shrink-0 rounded-xl border border-[#83495b] bg-[#481827] px-4 text-sm font-black text-[#eed8de] transition hover:bg-[#5a2031] disabled:cursor-not-allowed disabled:border-[#3b2a30] disabled:bg-[#171015] disabled:text-[#6f5f64] sm:min-w-32"
                  >
                    {availability.ok ? "Use" : availability.reason}
                  </button>
                </div>

                {(source.action.description || meta.length > 3) && (
                  <details className="mt-3 rounded-lg border border-[#302229] bg-black/10">
                    <summary className="cursor-pointer list-none px-3 py-2 text-xs font-bold text-[#9f858e]">
                      Details
                    </summary>
                    <div className="border-t border-[#2b1e24] px-3 py-3">
                      {source.action.description && (
                        <p className="text-sm leading-6 text-[#a18b92]">
                          {source.action.description}
                        </p>
                      )}
                      {meta.length > 3 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {meta.map((item) => (
                            <span
                              key={item}
                              className="rounded-md border border-[#3d2a31] bg-[#160e12] px-2 py-1 text-[11px] font-semibold text-[#9f858e]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}

      <details className="rounded-xl border border-[#32232a] bg-black/10">
        <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-bold text-[#8f7880]">
          Rest & session resets
        </summary>
        <div className="grid gap-2 border-t border-[#2b1e24] p-3 sm:grid-cols-2">
          {(
            ["scene", "rest", "long_rest", "session"] as DaggerheartActionReset[]
          ).map((reset) => (
            <button
              key={reset}
              type="button"
              onClick={() => onReset(reset)}
              className="min-h-11 rounded-lg border border-[#45303a] bg-[#171016] px-3 text-xs font-bold text-[#a9939a] transition hover:border-[#714353] hover:text-[#d8c2c9]"
            >
              {resetLabels[reset]}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
