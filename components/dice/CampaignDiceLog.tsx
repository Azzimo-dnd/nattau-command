"use client";

import type { CampaignDiceRollRow, DiceAppRole } from "./diceTypes";
import {
  formatTimestamp,
  readNumber,
  readString,
} from "./diceUtils";

type CampaignDiceLogProps = {
  variant: "nattau" | "barovia";
  rolls: CampaignDiceRollRow[];
  loading: boolean;
  currentUserId: string;
  role: DiceAppRole;
  onRefresh: () => void;
  onDelete: (rollId: string) => void;
  onClearMine: () => void;
};

function BaroviaRollDetails({ roll }: { roll: CampaignDiceRollRow }) {
  const hope = readNumber(roll.details, "hope_die");
  const fear = readNumber(roll.details, "fear_die");
  const advantage = readNumber(roll.details, "advantage_die");
  const natural = readNumber(roll.details, "natural_d20");
  const difficulty = readNumber(roll.details, "difficulty");
  const modifier = readNumber(roll.details, "modifier");
  const targetEvasion = readNumber(roll.details, "target_evasion");
  const mode = readString(roll.details, "advantage_mode");

  if (hope !== null && fear !== null) {
    return (
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-lg border border-[#9d8e88]/45 bg-[#ded2bd]/10 px-2.5 py-1.5 text-[#ded2bd]">
          Hope d12: <strong>{hope}</strong>
        </span>
        <span className="rounded-lg border border-[#8f4057]/60 bg-[#5a1825]/25 px-2.5 py-1.5 text-[#e4a6b6]">
          Fear d12: <strong>{fear}</strong>
        </span>
        {advantage !== null && (
          <span className="rounded-lg border border-[#53606d]/50 bg-[#77818d]/10 px-2.5 py-1.5 text-[#b4bec8]">
            {mode === "disadvantage" ? "Disadvantage" : "Advantage"} d6:{" "}
            <strong>{advantage}</strong>
          </span>
        )}
        {modifier !== null && (
          <span className="rounded-lg border border-[#4d3d44] bg-black/20 px-2.5 py-1.5 text-[#a99da1]">
            Modifier: <strong>{modifier >= 0 ? `+${modifier}` : modifier}</strong>
          </span>
        )}
        {difficulty !== null && (
          <span className="rounded-lg border border-[#4d3d44] bg-black/20 px-2.5 py-1.5 text-[#a99da1]">
            Difficulty: <strong>{difficulty}</strong>
          </span>
        )}
      </div>
    );
  }

  if (natural !== null) {
    return (
      <p className="mt-2 text-xs text-[#8f8187]">
        Natural d20: <strong className="text-[#d8c9cd]">{natural}</strong>
        {targetEvasion !== null && (
          <> · Target Evasion: <strong className="text-[#d8c9cd]">{targetEvasion}</strong></>
        )}
      </p>
    );
  }

  return null;
}

export function CampaignDiceLog({
  variant,
  rolls,
  loading,
  currentUserId,
  role,
  onRefresh,
  onDelete,
  onClearMine,
}: CampaignDiceLogProps) {
  const barovia = variant === "barovia";

  const panelClass = barovia
    ? "border-[#432832] bg-[#120d11]/90"
    : "border-slate-800 bg-slate-900";
  const mutedClass = barovia ? "text-[#8f8187]" : "text-slate-500";
  const headingClass = barovia ? "text-[#eadbd2]" : "text-slate-100";
  const accentClass = barovia ? "text-[#a7566d]" : "text-yellow-500";
  const itemClass = barovia
    ? "border-[#3e2630] bg-black/20"
    : "border-slate-800 bg-slate-950/60";

  const ownCount = rolls.filter((roll) => roll.user_id === currentUserId).length;

  return (
    <section className={`rounded-2xl border p-5 ${panelClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs uppercase tracking-[0.32em] ${accentClass}`}>
            Shared campaign log
          </p>
          <h2 className={`mt-3 text-2xl font-bold ${headingClass}`}>
            Recent Rolls
          </h2>
          <p className={`mt-2 text-xs leading-5 ${mutedClass}`}>
            Campaign rolls are visible to campaign members. Private rolls remain
            visible only to the person who made them.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className={`min-h-10 rounded-xl border px-3 text-xs transition ${
              barovia
                ? "border-[#51303c] bg-black/20 text-[#bda5ad] hover:border-[#8f4057]"
                : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-yellow-600/40"
            }`}
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={ownCount === 0}
            onClick={onClearMine}
            className={`min-h-10 rounded-xl border px-3 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
              barovia
                ? "border-[#51303c] bg-black/20 text-[#bda5ad] hover:border-red-500/50 hover:text-red-300"
                : "border-slate-700 bg-slate-950/70 text-slate-300 hover:border-red-500/50 hover:text-red-300"
            }`}
          >
            Clear my rolls
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className={`rounded-xl border p-4 text-sm ${itemClass} ${mutedClass}`}>
            Loading the campaign log...
          </p>
        ) : rolls.length === 0 ? (
          <p className={`rounded-xl border p-4 text-sm ${itemClass} ${mutedClass}`}>
            No rolls have been recorded in this campaign yet.
          </p>
        ) : (
          rolls.map((roll) => {
            const canDelete = role === "dm" || roll.user_id === currentUserId;

            return (
              <article key={roll.id} className={`rounded-xl border p-4 ${itemClass}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`font-semibold ${headingClass}`}>{roll.title}</p>
                      {roll.visibility === "private" && (
                        <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-violet-300">
                          Private
                        </span>
                      )}
                    </div>

                    <p className={`mt-1 text-xs ${mutedClass}`}>
                      {roll.roller_name} · {formatTimestamp(roll.created_at)}
                    </p>

                    {roll.expression && (
                      <p className={`mt-2 text-sm ${mutedClass}`}>
                        {roll.expression}
                      </p>
                    )}

                    {barovia && <BaroviaRollDetails roll={roll} />}
                  </div>

                  <div className="text-right">
                    {roll.total !== null && (
                      <p
                        className={`text-3xl font-black ${
                          barovia ? "text-[#e8c5ce]" : "text-yellow-300"
                        }`}
                      >
                        {roll.total}
                      </p>
                    )}
                    {roll.outcome && (
                      <p
                        className={`mt-1 max-w-52 text-xs font-semibold ${
                          barovia ? "text-[#c9909f]" : "text-slate-300"
                        }`}
                      >
                        {roll.outcome}
                      </p>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(roll.id)}
                        className={`mt-3 text-xs transition ${
                          barovia
                            ? "text-[#795e67] hover:text-red-300"
                            : "text-slate-600 hover:text-red-300"
                        }`}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
