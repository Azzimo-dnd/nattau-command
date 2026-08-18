"use client";

import { useMemo, type CSSProperties } from "react";
import { getCircuitFlow } from "@/lib/puzzles/arcaneCircuit";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";

type SegmentDirection = "north" | "east" | "south" | "west";

const SEGMENTS: Array<{
  bit: number;
  direction: SegmentDirection;
}> = [
  { bit: 1, direction: "north" },
  { bit: 2, direction: "east" },
  { bit: 4, direction: "south" },
  { bit: 8, direction: "west" },
];

function CircuitSegment({
  direction,
  energized,
  delay,
}: {
  direction: SegmentDirection;
  energized: boolean;
  delay: number;
}) {
  return (
    <span
      className={`nattau-arcane-wire nattau-arcane-wire-${direction} ${
        energized ? "nattau-arcane-wire-powered" : ""
      }`}
    >
      {energized ? (
        <span
          className={`nattau-arcane-flow nattau-arcane-flow-${direction}`}
          style={{ "--arcane-delay": `${delay}s` } as CSSProperties}
        />
      ) : null}
    </span>
  );
}

function CircuitTile({
  mask,
  energizedMask,
  source,
  target,
  powered,
  fixed,
  distance,
}: {
  mask: number;
  energizedMask: number;
  source: boolean;
  target: boolean;
  powered: boolean;
  fixed: boolean;
  distance: number;
}) {
  const delay = Math.max(0, distance) * 0.09;

  return (
    <span className="relative block h-full w-full">
      {SEGMENTS.map((segment) =>
        mask & segment.bit ? (
          <CircuitSegment
            key={segment.bit}
            direction={segment.direction}
            energized={Boolean(energizedMask & segment.bit)}
            delay={delay}
          />
        ) : null,
      )}

      {source ? (
        <span
          aria-hidden="true"
          className="nattau-arcane-terminal nattau-arcane-terminal-source"
        />
      ) : null}

      {target ? (
        <span
          aria-hidden="true"
          className={`nattau-arcane-terminal nattau-arcane-terminal-target ${
            powered ? "nattau-arcane-terminal-target-powered" : ""
          }`}
        />
      ) : null}

      {source ? (
        <span className="absolute left-1.5 top-1.5 rounded-md border border-emerald-300/25 bg-emerald-950/35 px-1.5 py-0.5 text-[9px] font-semibold leading-none tracking-wide text-emerald-200/80">
          SOURCE
        </span>
      ) : target ? (
        <span className="absolute left-1.5 top-1.5 rounded-md border border-fuchsia-300/25 bg-fuchsia-950/35 px-1.5 py-0.5 text-[9px] font-semibold leading-none tracking-wide text-fuchsia-200/80">
          TARGET
        </span>
      ) : fixed ? (
        <span className="absolute left-1.5 top-1.5 rounded-md border border-white/10 bg-black/25 px-1.5 py-0.5 text-[9px] leading-none text-slate-500">
          FIXED
        </span>
      ) : null}
    </span>
  );
}

export function ArcaneCircuitPuzzle({
  puzzle,
  run,
  disabled,
  onAction,
}: {
  puzzle: CampaignPuzzleRow;
  run: CampaignPuzzleRunRow;
  disabled: boolean;
  onAction: (action: JsonRecord) => Promise<unknown>;
}) {
  const width = Number(puzzle.public_config.width ?? 4);
  const masks = Array.isArray(puzzle.public_config.masks)
    ? puzzle.public_config.masks.map(Number)
    : [];
  const rotations = useMemo(
    () =>
      Array.isArray(run.state.rotations)
        ? run.state.rotations.map(Number)
        : [],
    [run.state.rotations],
  );
  const sourceIndex = Number(puzzle.public_config.source_index ?? 0);
  const targets = Array.isArray(puzzle.public_config.target_indices)
    ? puzzle.public_config.target_indices.map(Number)
    : [];
  const configuredLocks = Array.isArray(puzzle.public_config.locked_indices)
    ? puzzle.public_config.locked_indices.map(Number)
    : [];

  const lockedIndices = useMemo(
    () => new Set([sourceIndex, ...targets, ...configuredLocks]),
    [configuredLocks, sourceIndex, targets],
  );

  const flow = useMemo(
    () => getCircuitFlow(masks, rotations, width, sourceIndex),
    [masks, rotations, sourceIndex, width],
  );

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="rounded-[30px] border border-cyan-700/25 bg-[#061419] p-3 shadow-2xl shadow-cyan-950/40 sm:p-5">
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${width},minmax(0,1fr))`,
          }}
        >
          {masks.map((_, index) => {
            const locked = lockedIndices.has(index);
            const powered = flow.poweredIndices.has(index);
            const target = targets.includes(index);
            const source = index === sourceIndex;

            return (
              <button
                key={index}
                type="button"
                disabled={disabled || locked}
                aria-label={
                  source
                    ? "Arcane Circuit source — fixed"
                    : target
                      ? "Arcane Circuit destination — fixed"
                      : `Rotate Arcane Circuit tile ${index + 1}`
                }
                onClick={() =>
                  void onAction({ type: "rotate", index, delta: 1 })
                }
                onContextMenu={(event) => {
                  event.preventDefault();
                  if (!disabled && !locked) {
                    void onAction({ type: "rotate", index, delta: -1 });
                  }
                }}
                className={`aspect-square overflow-hidden rounded-xl border bg-cyan-950/45 p-1 transition ${
                  powered
                    ? "border-cyan-700/70"
                    : "border-cyan-900/60"
                } ${
                  locked
                    ? "cursor-default ring-1 ring-inset ring-white/5"
                    : "hover:border-cyan-500/70 active:scale-95"
                } ${disabled && !locked ? "opacity-70" : ""}`}
              >
                <CircuitTile
                  mask={flow.rotatedMasks[index] ?? 0}
                  energizedMask={flow.energizedMasks[index] ?? 0}
                  source={source}
                  target={target}
                  powered={powered}
                  fixed={locked}
                  distance={flow.distances[index] ?? -1}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <i className="inline-block h-[4px] w-8 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.85)]" />
          live current
        </span>
        <span>Source and target are fixed.</span>
        <span>Tap a free tile to rotate clockwise.</span>
      </div>

      <style jsx global>{`
        .nattau-arcane-wire {
          position: absolute;
          z-index: 1;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(74, 181, 198, 0.48);
          box-shadow: inset 0 0 2px rgba(207, 250, 254, 0.12);
          transition:
            background-color 180ms ease,
            box-shadow 180ms ease,
            opacity 180ms ease;
        }

        .nattau-arcane-wire-north {
          left: 50%;
          top: 0;
          width: 6px;
          height: calc(50% + 3px);
          transform: translateX(-50%);
        }

        .nattau-arcane-wire-east {
          left: calc(50% - 3px);
          top: 50%;
          width: calc(50% + 3px);
          height: 6px;
          transform: translateY(-50%);
        }

        .nattau-arcane-wire-south {
          left: 50%;
          top: calc(50% - 3px);
          width: 6px;
          height: calc(50% + 3px);
          transform: translateX(-50%);
        }

        .nattau-arcane-wire-west {
          left: 0;
          top: 50%;
          width: calc(50% + 3px);
          height: 6px;
          transform: translateY(-50%);
        }

        .nattau-arcane-wire-powered {
          background: rgba(76, 230, 255, 0.96);
          box-shadow:
            0 0 4px rgba(207, 250, 254, 0.95),
            0 0 10px rgba(103, 232, 249, 0.95),
            0 0 22px rgba(34, 211, 238, 0.62),
            inset 0 0 2px rgba(255, 255, 255, 0.95);
        }

        .nattau-arcane-flow {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          opacity: 0.95;
          animation-delay: var(--arcane-delay, 0s);
        }

        .nattau-arcane-flow-north,
        .nattau-arcane-flow-south {
          background-image: linear-gradient(
            180deg,
            transparent 0%,
            transparent 28%,
            rgba(255, 255, 255, 0.98) 48%,
            rgba(186, 248, 255, 0.9) 56%,
            transparent 76%,
            transparent 100%
          );
          background-size: 100% 260%;
          animation: nattau-arcane-current-v 1.05s linear infinite;
        }

        .nattau-arcane-flow-east,
        .nattau-arcane-flow-west {
          background-image: linear-gradient(
            90deg,
            transparent 0%,
            transparent 28%,
            rgba(255, 255, 255, 0.98) 48%,
            rgba(186, 248, 255, 0.9) 56%,
            transparent 76%,
            transparent 100%
          );
          background-size: 260% 100%;
          animation: nattau-arcane-current-h 1.05s linear infinite;
        }

        .nattau-arcane-terminal {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 3;
          width: 10px;
          height: 10px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          background: #061419;
        }

        .nattau-arcane-terminal-source {
          border: 2px solid rgba(110, 231, 183, 0.95);
          box-shadow: 0 0 9px rgba(52, 211, 153, 0.45);
        }

        .nattau-arcane-terminal-target {
          border: 2px solid rgba(240, 171, 252, 0.82);
          box-shadow: 0 0 8px rgba(217, 70, 239, 0.35);
        }

        .nattau-arcane-terminal-target-powered {
          background: rgba(240, 171, 252, 0.92);
          box-shadow:
            0 0 8px rgba(250, 232, 255, 0.95),
            0 0 18px rgba(217, 70, 239, 0.72);
        }

        @keyframes nattau-arcane-current-v {
          from { background-position: 0 130%; }
          to { background-position: 0 -130%; }
        }

        @keyframes nattau-arcane-current-h {
          from { background-position: 130% 0; }
          to { background-position: -130% 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nattau-arcane-flow-north,
          .nattau-arcane-flow-east,
          .nattau-arcane-flow-south,
          .nattau-arcane-flow-west {
            animation: none;
            background: rgba(255, 255, 255, 0.34);
          }
        }
      `}</style>
    </div>
  );
}
