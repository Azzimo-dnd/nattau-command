"use client";

import { useMemo, useState } from "react";
import type { CampaignPuzzleRow, CampaignPuzzleRunRow, JsonRecord } from "@/lib/puzzles/puzzleTypes";

export function ShatteredSigilPuzzle({ puzzle, run, disabled, onAction }: {
  puzzle: CampaignPuzzleRow;
  run: CampaignPuzzleRunRow;
  disabled: boolean;
  onAction: (action: JsonRecord) => Promise<unknown>;
}) {
  const size = Number(puzzle.public_config.size ?? 3);
  const symbols = Array.isArray(puzzle.public_config.symbols) ? puzzle.public_config.symbols as string[] : [];
  const order = useMemo(() => Array.isArray(run.state.order) ? run.state.order as string[] : [], [run.state.order]);
  const [selected, setSelected] = useState<number | null>(null);

  const click = async (index: number) => {
    if (disabled) return;
    if (selected === null) { setSelected(index); return; }
    if (selected === index) { setSelected(null); return; }
    const sameRow = Math.floor(selected / size) === Math.floor(index / size);
    const adjacent = (sameRow && Math.abs(selected - index) === 1) || Math.abs(selected - index) === size;
    if (!adjacent) { setSelected(index); return; }
    const result = await onAction({ type: "swap", from: selected, to: index });
    if (result) setSelected(null);
  };

  return (
    <div className="mx-auto max-w-[620px]">
      <div className="rounded-[30px] border border-cyan-900/60 bg-[radial-gradient(circle_at_center,#132a31_0%,#071014_72%)] p-4 shadow-2xl shadow-cyan-950/30">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${size},minmax(0,1fr))` }}>
          {order.map((tileId, index) => {
            const symbol = symbols[Number(tileId)] ?? "?";
            return (
              <button
                key={`${tileId}-${index}`}
                type="button"
                disabled={disabled}
                onClick={() => void click(index)}
                className={`aspect-square rounded-2xl border bg-cyan-950/65 text-3xl font-black text-cyan-100 transition duration-200 sm:text-4xl ${selected === index ? "scale-[1.04] border-cyan-300 ring-2 ring-cyan-300/50" : "border-cyan-800/50 hover:border-cyan-500/70"} disabled:opacity-70`}
              >
                {symbol}
              </button>
            );
          })}
        </div>
      </div>
      <details className="mx-auto mt-3 max-w-[620px] rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Reference sigil</summary>
        <div className="mt-3 grid gap-1 opacity-60" style={{ gridTemplateColumns: `repeat(${size},minmax(0,1fr))` }}>
          {symbols.map((symbol, index) => <span key={`${symbol}-${index}`} className="flex aspect-square items-center justify-center rounded-lg border border-cyan-900/40 bg-cyan-950/30 text-lg text-cyan-200">{symbol}</span>)}
        </div>
      </details>
      <p className="mt-3 text-center text-xs leading-5 text-slate-500">Select one fragment, then an adjacent fragment to exchange their places.</p>
    </div>
  );
}
