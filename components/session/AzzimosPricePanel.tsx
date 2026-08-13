type AzzimosPricePanelProps = {
  debuffs: string[];
  compact?: boolean;
  title?: string;
};

export function AzzimosPricePanel({
  debuffs,
  compact = false,
  title = "Azzimo's Price",
}: AzzimosPricePanelProps) {
  const activeDebuffs = debuffs.map((debuff) => debuff.trim()).filter(Boolean);

  if (activeDebuffs.length === 0) {
    return null;
  }

  return (
    <section
      className={`rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-purple-950/55 via-slate-950/80 to-rose-950/40 shadow-[0_0_30px_rgba(168,85,247,0.08)] ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-fuchsia-300/80">
            Payment due next session
          </p>
          <h3 className="mt-1 text-lg font-bold text-rose-100">☠ {title}</h3>
        </div>
        <span className="rounded-full border border-rose-500/35 bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-200">
          {activeDebuffs.length} {activeDebuffs.length === 1 ? "debuff" : "debuffs"}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {activeDebuffs.map((debuff, index) => (
          <li
            key={`${index}-${debuff}`}
            className="rounded-xl border border-fuchsia-500/15 bg-black/20 px-3 py-2 text-sm text-slate-200"
          >
            <span className="mr-2 text-rose-300">✦</span>
            {debuff}
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs italic text-fuchsia-200/60">
        The Carnival has already performed. Azzimo remembers every debt.
      </p>
    </section>
  );
}
