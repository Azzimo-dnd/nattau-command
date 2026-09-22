"use client";

import { useMemo } from "react";
import { findCircuitRotation } from "@/lib/puzzles/arcaneCircuit";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";
import { ArcaneCircuitPuzzle } from "./engines/ArcaneCircuitPuzzle";
import { ShatteredSigilPuzzle } from "./engines/ShatteredSigilPuzzle";

type Props = {
  puzzle: CampaignPuzzleRow;
  run: CampaignPuzzleRunRow;
  solution: JsonRecord;
  onClose: () => void;
};

const noAction = async () => null;

function arrayOfStrings(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function arrayOfNumbers(value: unknown) {
  return Array.isArray(value) ? value.map(Number) : [];
}

export function GmPuzzleSolution({ puzzle, run, solution, onClose }: Props) {
  const secret =
    solution.secret_config && typeof solution.secret_config === "object"
      ? (solution.secret_config as JsonRecord)
      : {};

  const solutionRun = useMemo<CampaignPuzzleRunRow>(() => {
    if (puzzle.puzzle_type === "shattered_sigil") {
      return {
        ...run,
        state: {
          ...run.state,
          order: arrayOfStrings(secret.target_order),
        },
      };
    }

    if (puzzle.puzzle_type === "arcane_circuit") {
      const masks = arrayOfNumbers(puzzle.public_config.masks);
      const explicitRotations = arrayOfNumbers(secret.solution_rotations);
      const targetMasks = arrayOfNumbers(secret.target_masks);
      const rotations =
        explicitRotations.length === masks.length
          ? explicitRotations
          : masks.map((mask, index) =>
              findCircuitRotation(mask, targetMasks[index] ?? mask),
            );

      return {
        ...run,
        state: {
          ...run.state,
          rotations,
        },
      };
    }

    return run;
  }, [puzzle, run, secret]);

  const cipher = arrayOfStrings(secret.solution);
  const sequence = arrayOfStrings(secret.sequence);
  const slidingMoves = Array.isArray(secret.solution_moves)
    ? (secret.solution_moves as JsonRecord[])
    : [];

  return (
    <section className="mt-4 rounded-3xl border border-fuchsia-400/25 bg-fuchsia-950/10 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-300/70">
            GM only
          </p>
          <h3 className="mt-1 text-lg font-black text-fuchsia-100">
            Correct solution
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            This panel is loaded through a DM-authorized database function and is never
            included in the player puzzle payload.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400"
        >
          Hide solution
        </button>
      </div>

      {puzzle.puzzle_type === "rune_cipher" ? (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-black/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Rune order
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {cipher.map((rune, index) => (
              <span
                key={`${rune}-${index}`}
                className="rounded-xl border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-2 font-mono text-lg font-black text-fuchsia-100"
              >
                {rune}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {puzzle.puzzle_type === "rune_sequence" ? (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-black/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Full sequence
          </p>
          <p className="mt-3 break-words font-mono text-base font-bold text-fuchsia-100">
            {sequence.join(" → ")}
          </p>
        </div>
      ) : null}

      {puzzle.puzzle_type === "sliding_lock" ? (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-black/20 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Verified move sequence
          </p>
          {slidingMoves.length > 0 ? (
            <ol className="mt-3 grid gap-2">
              {slidingMoves.map((move, index) => (
                <li
                  key={index}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm text-slate-300"
                >
                  <span className="mr-2 font-black text-fuchsia-300">
                    {index + 1}.
                  </span>
                  Ward <strong>{String(move.block_id ?? "?")}</strong> —{" "}
                  {String(move.direction ?? "?")} × {String(move.distance ?? 1)}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-400">
              This older Sliding Lock was generated before solution paths were retained.
              Regenerating the variant will attach a verified shortest move sequence.
            </p>
          )}
        </div>
      ) : null}

      {puzzle.puzzle_type === "shattered_sigil" ? (
        <div className="mt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Restored sigil
          </p>
          <div className="pointer-events-none">
            <ShatteredSigilPuzzle
              puzzle={puzzle}
              run={solutionRun}
              disabled
              onAction={noAction}
            />
          </div>
        </div>
      ) : null}

      {puzzle.puzzle_type === "arcane_circuit" ? (
        <div className="mt-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            Canonical powered network
          </p>
          <div className="pointer-events-none">
            <ArcaneCircuitPuzzle
              puzzle={puzzle}
              run={solutionRun}
              disabled
              onAction={noAction}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Other valid orientations may also solve the circuit. Only anchored targets
            must receive power; spare conduits may remain dark.
          </p>
        </div>
      ) : null}
    </section>
  );
}
