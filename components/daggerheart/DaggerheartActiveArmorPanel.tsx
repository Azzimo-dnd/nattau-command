"use client";

import type { DaggerheartDerivedStats } from "@/lib/daggerheart/effects";

type Armor = {
  instance_id?: string;
  name: string;
  category?: string;
  tier?: number | null;
  equipped?: boolean;
  details?: string;
  metadata?: Record<string, unknown>;
  marked_slots?: number;
};

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function DaggerheartActiveArmorPanel({
  armor,
  stats,
  markedSlots,
  onMarkedSlotsChange,
  compact = false,
}: {
  armor: Armor[];
  stats: DaggerheartDerivedStats;
  markedSlots: number;
  onMarkedSlotsChange: (next: number) => void;
  compact?: boolean;
}) {
  const equipped =
    armor.find(
      (item) =>
        item.category === "armor" &&
        item.equipped !== false
    ) ?? null;

  if (!equipped) {
    return (
      <p className="rounded-xl border border-[#34242b] bg-black/15 p-4 text-sm text-[#806f75]">
        No armor is currently equipped. Your live damage thresholds use the unarmored profile.
      </p>
    );
  }

  const baseScore = numberValue(equipped.metadata?.base_score);
  const baseMajor = numberValue(equipped.metadata?.base_major);
  const baseSevere = numberValue(equipped.metadata?.base_severe);
  const maxSlots = Math.max(0, stats.armor_slots_max);
  const currentMarked = Math.max(0, Math.min(markedSlots, maxSlots));

  return (
    <div className="rounded-2xl border border-[#49303a] bg-gradient-to-br from-[#211219] to-[#0e090c] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#936675]">
            Active armor{equipped.tier ? ` · Tier ${equipped.tier}` : ""}
          </p>
          <h4 className="mt-1 font-serif text-xl font-black text-[#ead8dd]">
            {equipped.name}
          </h4>
        </div>
        <span className="rounded-full border border-emerald-900/45 bg-emerald-950/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200/90">
          Equipped
        </span>
      </div>

      {compact && (
        <>
          <p className="mt-3 text-sm text-[#a88f97]">
            Armor Score {stats.armor_score} · Major {stats.major_threshold} · Severe{" "}
            {stats.severe_threshold} · {currentMarked}/{maxSlots} slots marked
          </p>
          {equipped.details?.trim() && equipped.details.trim() !== "—" && (
            <details className="mt-3 rounded-xl border border-[#35242b] bg-black/20">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-bold text-[#a88f97]">
                Armor rule
              </summary>
              <p className="border-t border-[#2d2026] px-3 py-3 whitespace-pre-line text-sm leading-6 text-[#bca8ae]">
                {equipped.details}
              </p>
            </details>
          )}
        </>
      )}

      {!compact && (
        <>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-[#35242b] bg-black/20 p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#78666c]">
            Armor Score
          </p>
          <p className="mt-1 text-lg font-black text-[#e3cbd2]">
            {stats.armor_score}
          </p>
          {baseScore !== null && baseScore !== stats.armor_score && (
            <p className="mt-0.5 text-[10px] text-[#8e747d]">Base {baseScore}</p>
          )}
        </div>

        <div className="rounded-lg border border-[#35242b] bg-black/20 p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#78666c]">
            Major
          </p>
          <p className="mt-1 text-lg font-black text-[#e3cbd2]">
            {stats.major_threshold}
          </p>
          {baseMajor !== null && baseMajor !== stats.major_threshold && (
            <p className="mt-0.5 text-[10px] text-[#8e747d]">Base {baseMajor}</p>
          )}
        </div>

        <div className="rounded-lg border border-[#35242b] bg-black/20 p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#78666c]">
            Severe
          </p>
          <p className="mt-1 text-lg font-black text-[#e3cbd2]">
            {stats.severe_threshold}
          </p>
          {baseSevere !== null && baseSevere !== stats.severe_threshold && (
            <p className="mt-0.5 text-[10px] text-[#8e747d]">Base {baseSevere}</p>
          )}
        </div>

        <div className="rounded-lg border border-[#35242b] bg-black/20 p-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#78666c]">
            Armor Slots
          </p>
          <p className="mt-1 text-lg font-black text-[#e3cbd2]">
            {currentMarked} / {maxSlots}
          </p>
          <p className="mt-0.5 text-[10px] text-[#8e747d]">marked</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={currentMarked >= maxSlots || maxSlots <= 0}
          onClick={() => onMarkedSlotsChange(currentMarked + 1)}
          className="min-h-9 rounded-lg border border-[#6d4050] bg-[#2b141d] px-3 text-xs font-bold text-[#dfbcc6] transition hover:border-[#96536a] hover:bg-[#381923] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Mark Armor Slot
        </button>
        <button
          type="button"
          disabled={currentMarked <= 0}
          onClick={() => onMarkedSlotsChange(currentMarked - 1)}
          className="min-h-9 rounded-lg border border-[#49303a] bg-black/20 px-3 text-xs font-bold text-[#bca0a9] transition hover:border-[#704052] disabled:cursor-not-allowed disabled:opacity-35"
        >
          Clear Armor Slot
        </button>
      </div>

      {equipped.details?.trim() && equipped.details.trim() !== "—" && (
        <div className="mt-4 rounded-xl border border-[#35242b] bg-black/20 p-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#78666c]">
            Armor rule
          </p>
          <p className="mt-1 whitespace-pre-line text-xs leading-5 text-[#bca8ae]">
            {equipped.details}
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}
