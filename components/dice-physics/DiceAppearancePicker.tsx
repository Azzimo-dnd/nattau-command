"use client";

import type { ChangeEvent } from "react";
import {
  DICE_COSMETICS,
  getDiceCosmetic,
} from "./diceCosmetics";
import type {
  DiceAppearanceSettings,
  DiceLabTheme,
  DiceNumberSize,
} from "./dicePhysicsTypes";

const NUMBER_SIZES: Array<{ value: DiceNumberSize; label: string }> = [
  { value: "standard", label: "Standard" },
  { value: "large", label: "Large" },
  { value: "extra-large", label: "Extra Large" },
];

export function DiceAppearancePicker({
  theme,
  value,
  disabled,
  saving,
  onChange,
  compact = false,
}: {
  theme: DiceLabTheme;
  value: DiceAppearanceSettings;
  disabled?: boolean;
  saving?: boolean;
  onChange: (value: DiceAppearanceSettings) => void;
  compact?: boolean;
}) {
  const selected = getDiceCosmetic(value.cosmeticId);
  const available = DICE_COSMETICS.filter(
    (cosmetic) =>
      cosmetic.campaignScope === "global" || cosmetic.campaignScope === theme
  );
  const panel =
    theme === "barovia"
      ? "border-[#4d2c37] bg-[#130d11]/85 text-[#ead7dc]"
      : "border-slate-700/80 bg-slate-950/78 text-slate-100";
  const accent = theme === "barovia" ? "text-[#e0a8b8]" : "text-yellow-300";
  const selectedStyle =
    theme === "barovia"
      ? "border-[#bd6c85] bg-[#6b2137]/[0.28]"
      : "border-yellow-400/65 bg-yellow-400/10";

  return (
    <section className={`rounded-3xl border p-4 sm:p-5 ${panel}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-bold uppercase tracking-[0.24em] ${accent}`}>
            My Dice
          </p>
          <p className="mt-2 text-sm font-black">{selected.name}</p>
          {!compact && (
            <p className="mt-1 text-xs leading-5 opacity-60">
              {selected.description}
            </p>
          )}
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] opacity-60">
          {saving ? "Saving" : selected.rarity}
        </span>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-4 sm:grid-cols-5" : "grid-cols-2"}`}>
        {available.map((cosmetic) => (
          <button
            key={cosmetic.id}
            type="button"
            disabled={disabled}
            title={cosmetic.name}
            onClick={() => onChange({ ...value, cosmeticId: cosmetic.id })}
            className={`rounded-2xl border p-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
              cosmetic.id === value.cosmeticId
                ? selectedStyle
                : "border-white/10 bg-black/20 hover:border-white/25"
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                className="h-8 w-8 shrink-0 rounded-xl border border-white/20 shadow-inner"
                style={{ background: cosmetic.swatch }}
              />
              {!compact && (
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-black">
                    {cosmetic.name}
                  </span>
                  <span className="mt-1 block text-[9px] uppercase tracking-[0.1em] opacity-45">
                    {cosmetic.textureKind === "solid" ? "Color" : "Texture"}
                  </span>
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <p className="text-xs font-semibold opacity-70">Number size</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {NUMBER_SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, numberSize: option.value })}
              className={`min-h-10 rounded-xl border px-2 text-[10px] font-bold transition disabled:opacity-40 ${
                value.numberSize === option.value
                  ? selectedStyle
                  : "border-white/10 bg-black/20 opacity-75 hover:border-white/25"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-xs opacity-80">
        <input
          type="checkbox"
          checked={value.sound}
          disabled={disabled}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange({ ...value, sound: event.target.checked })}
          className="h-4 w-4 accent-current"
        />
        Physical collision sounds
      </label>
    </section>
  );
}
