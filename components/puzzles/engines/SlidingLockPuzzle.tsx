"use client";

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { getNattauRuneDefinition } from "@/lib/puzzles/nattauRunes";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";

type Axis = "h" | "v";
type Direction = "left" | "right" | "up" | "down";

type Block = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  axis: Axis;
  target?: boolean;
  label?: string;
};

type MoveRange = Record<Direction, number>;

type DragState = {
  blockId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  previewSteps: number;
};

const BLOCK_RUNES = ["awa", "matau", "tara", "whetu", "ahi", "niho", "rangi"];

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function canOccupy(
  block: Block,
  x: number,
  y: number,
  blocks: Block[],
  width: number,
  height: number,
) {
  if (x < 0 || y < 0 || x + block.w > width || y + block.h > height) {
    return false;
  }

  return !blocks.some(
    (other) =>
      other.id !== block.id &&
      overlaps(
        { x, y, w: block.w, h: block.h },
        { x: other.x, y: other.y, w: other.w, h: other.h },
      ),
  );
}

function getMoveRange(
  block: Block | null,
  blocks: Block[],
  width: number,
  height: number,
): MoveRange {
  const result: MoveRange = { left: 0, right: 0, up: 0, down: 0 };
  if (!block) return result;

  const directions: Array<{
    name: Direction;
    dx: number;
    dy: number;
    valid: boolean;
  }> = [
    { name: "left", dx: -1, dy: 0, valid: block.axis === "h" },
    { name: "right", dx: 1, dy: 0, valid: block.axis === "h" },
    { name: "up", dx: 0, dy: -1, valid: block.axis === "v" },
    { name: "down", dx: 0, dy: 1, valid: block.axis === "v" },
  ];

  for (const direction of directions) {
    if (!direction.valid) continue;

    for (let distance = 1; distance <= Math.max(width, height); distance += 1) {
      if (
        !canOccupy(
          block,
          block.x + direction.dx * distance,
          block.y + direction.dy * distance,
          blocks,
          width,
          height,
        )
      ) {
        break;
      }
      result[direction.name] = distance;
    }
  }

  return result;
}

function getBlockRune(block: Block, index: number) {
  if (block.target) return "koru";
  return BLOCK_RUNES[index % BLOCK_RUNES.length];
}

function WardGlyph({ runeId, target = false }: { runeId: string; target?: boolean }) {
  const definition = getNattauRuneDefinition(runeId);
  if (!definition) return null;

  return (
    <span
      className={`pointer-events-none flex items-center justify-center rounded-full border ${
        target
          ? "border-lime-100/20 bg-lime-950/12 text-lime-50"
          : "border-stone-100/10 bg-black/10 text-stone-100/88"
      }`}
      title={definition.title}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[58%] w-[58%] drop-shadow-[0_1px_1px_rgba(0,0,0,0.85)]"
        aria-hidden="true"
      >
        {definition.paths.map((path) => (
          <path key={path} d={path} />
        ))}
      </svg>
    </span>
  );
}

function DustPuffs({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <>
      <span className="nattau-dust-puff nattau-dust-puff-a" />
      <span className="nattau-dust-puff nattau-dust-puff-b" />
      <span className="nattau-dust-puff nattau-dust-puff-c" />
      <span className="nattau-dust-puff nattau-dust-puff-d" />
    </>
  );
}

function directionFromPreview(axis: Axis, previewSteps: number): Direction | null {
  if (previewSteps === 0) return null;
  if (axis === "h") return previewSteps < 0 ? "left" : "right";
  return previewSteps < 0 ? "up" : "down";
}

function getTrackOverlayStyle(width: number, height: number) {
  return {
    backgroundImage:
      "linear-gradient(to right, rgba(78,67,58,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(78,67,58,0.5) 1px, transparent 1px)",
    backgroundSize: `${100 / width}% ${100 / height}%`,
  };
}

export function SlidingLockPuzzle({
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
  const width = Number(puzzle.public_config.width ?? 6);
  const height = Number(puzzle.public_config.height ?? 6);
  const exitRow = Number(puzzle.public_config.exit_row ?? 2);
  const blocks = useMemo(
    () => (Array.isArray(run.state.blocks) ? (run.state.blocks as Block[]) : []),
    [run.state.blocks],
  );
  const boardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(
    () => blocks.find((block) => block.target)?.id ?? blocks[0]?.id ?? null,
  );
  const [moving, setMoving] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  const active = blocks.find((block) => block.id === selected) ?? null;
  const activeRange = useMemo(
    () => getMoveRange(active, blocks, width, height),
    [active, blocks, height, width],
  );
  const effectiveDisabled = disabled || moving;

  const performMove = async (
    block: Block,
    direction: Direction,
    distance: number,
  ) => {
    if (effectiveDisabled || distance < 1) return;

    const legalDistance = getMoveRange(block, blocks, width, height)[direction];
    const finalDistance = Math.min(distance, legalDistance);
    if (finalDistance < 1) return;

    setMoving(true);
    try {
      await onAction({
        type: "slide",
        block_id: block.id,
        direction,
        distance: finalDistance,
      });
    } finally {
      setMoving(false);
    }
  };

  const moveSelected = (direction: Direction, mode: "one" | "max") => {
    if (!active) return;
    const range = activeRange[direction];
    void performMove(active, direction, mode === "max" ? range : Math.min(1, range));
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: Block) => {
    if (effectiveDisabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(block.id);
    setDrag({
      blockId: block.id,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      previewSteps: 0,
    });
  };

  const updateDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: Block) => {
    if (!drag || drag.blockId !== block.id || drag.pointerId !== event.pointerId) return;
    const board = boardRef.current;
    if (!board) return;

    const rect = board.getBoundingClientRect();
    const cellWidth = rect.width / width;
    const cellHeight = rect.height / height;
    const range = getMoveRange(block, blocks, width, height);

    let previewSteps = 0;
    if (block.axis === "h") {
      const raw = Math.round((event.clientX - drag.startClientX) / cellWidth);
      previewSteps = Math.max(-range.left, Math.min(range.right, raw));
    } else {
      const raw = Math.round((event.clientY - drag.startClientY) / cellHeight);
      previewSteps = Math.max(-range.up, Math.min(range.down, raw));
    }

    setDrag((current) =>
      current && current.blockId === block.id
        ? { ...current, previewSteps }
        : current,
    );
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: Block) => {
    if (!drag || drag.blockId !== block.id || drag.pointerId !== event.pointerId) return;
    const previewSteps = drag.previewSteps;
    setDrag(null);

    const direction = directionFromPreview(block.axis, previewSteps);
    if (direction && previewSteps !== 0) {
      void performMove(block, direction, Math.abs(previewSteps));
    }
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[640px] rounded-[34px] border border-stone-700/80 bg-[linear-gradient(180deg,#40342a,#211a16_38%,#130f0d)] p-3 shadow-[0_28px_70px_rgba(0,0,0,0.6)] sm:p-4">
        <div className="rounded-[28px] border border-stone-500/20 bg-[linear-gradient(180deg,#6f6154,#392f28_42%,#191411)] p-2 shadow-[inset_0_0_46px_rgba(0,0,0,0.78)] sm:p-3">
          <div
            ref={boardRef}
            className="relative aspect-square touch-none overflow-hidden rounded-[18px] border border-stone-900/90 bg-[#2b241f] shadow-[inset_0_0_70px_rgba(0,0,0,0.84)]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 14%,rgba(255,255,255,0.05),transparent 18%),radial-gradient(circle at 81% 68%,rgba(255,255,255,0.03),transparent 16%),radial-gradient(circle at 60% 38%,rgba(0,0,0,0.13),transparent 36%),repeating-linear-gradient(135deg,rgba(255,255,255,0.012) 0px,rgba(255,255,255,0.012) 2px,transparent 2px,transparent 13px),linear-gradient(145deg,#817062,#5b4d42 24%,#40362f 52%,#2a2420 72%,#1c1714)",
            }}
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-35"
              style={getTrackOverlayStyle(width, height)}
            />

            {Array.from({ length: width * height }, (_, cellIndex) => {
              const cellX = cellIndex % width;
              const cellY = Math.floor(cellIndex / width);
              return (
                <div
                  key={cellIndex}
                  className="pointer-events-none absolute rounded-[10px] border border-stone-700/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.018),rgba(0,0,0,0.07))] shadow-[inset_0_1px_0_rgba(255,255,255,0.025),inset_0_-10px_18px_rgba(0,0,0,0.18)]"
                  style={{
                    left: `${(cellX / width) * 100}%`,
                    top: `${(cellY / height) * 100}%`,
                    width: `${100 / width}%`,
                    height: `${100 / height}%`,
                  }}
                >
                  <span className="absolute inset-x-[16%] top-[14%] h-px bg-white/[0.03]" />
                  <span className="absolute bottom-[17%] left-[18%] h-[2px] w-[22%] rotate-[-18deg] rounded-full bg-black/10" />
                </div>
              );
            })}

            <div className="pointer-events-none absolute inset-x-4 top-0 h-10 bg-gradient-to-b from-white/[0.035] to-transparent" />
            <div className="pointer-events-none absolute inset-x-4 bottom-0 h-10 bg-gradient-to-t from-black/28 to-transparent" />

            <div className="pointer-events-none absolute left-3 top-3 h-10 w-10 rounded-tl-[20px] border-l border-t border-stone-100/8" />
            <div className="pointer-events-none absolute right-3 top-3 h-10 w-10 rounded-tr-[20px] border-r border-t border-stone-100/8" />
            <div className="pointer-events-none absolute bottom-3 left-3 h-10 w-10 rounded-bl-[20px] border-b border-l border-stone-100/8" />
            <div className="pointer-events-none absolute bottom-3 right-3 h-10 w-10 rounded-br-[20px] border-b border-r border-stone-100/8" />

            <div
              className="pointer-events-none absolute right-0 z-20 flex items-center justify-center overflow-hidden border-y border-l border-lime-200/10 bg-[linear-gradient(180deg,rgba(32,29,22,0.98),rgba(58,69,49,0.9),rgba(30,28,22,0.98))] shadow-[-8px_0_18px_rgba(0,0,0,0.18)]"
              style={{
                top: `${(exitRow / height) * 100}%`,
                height: `${100 / height}%`,
                width: 16,
              }}
            >
              <span className="absolute inset-y-0 left-0 w-px bg-lime-100/10" />
              <span className="absolute inset-y-[18%] left-[4px] w-[2px] rounded-full bg-lime-200/18 blur-[1px]" />
              <span className="absolute right-[1px] rotate-90 text-[8px] font-black uppercase tracking-[0.25em] text-lime-100/55">
                Gate
              </span>
            </div>

            {blocks.map((block, index) => {
              const isSelected = block.id === selected;
              const isDragging = drag?.blockId === block.id;
              const previewSteps = isDragging ? drag.previewSteps : 0;
              const previewX = block.axis === "h" ? previewSteps : 0;
              const previewY = block.axis === "v" ? previewSteps : 0;
              const runeId = getBlockRune(block, index);
              const rune = getNattauRuneDefinition(runeId);
              const dustActive = isDragging || (moving && isSelected);

              return (
                <button
                  key={block.id}
                  type="button"
                  disabled={effectiveDisabled}
                  onClick={() => setSelected(block.id)}
                  onPointerDown={(event) => beginDrag(event, block)}
                  onPointerMove={(event) => updateDrag(event, block)}
                  onPointerUp={(event) => finishDrag(event, block)}
                  onPointerCancel={() => setDrag(null)}
                  className={`absolute flex touch-none select-none items-center justify-center overflow-visible rounded-[14px] border p-1.5 text-xs font-black transition-[left,top,box-shadow,transform,border-color] ${
                    isDragging ? "duration-0" : "duration-300"
                  } ${
                    block.target
                      ? "border-lime-100/18 bg-[linear-gradient(145deg,#71826a,#495647_38%,#30392f_74%,#242a23)] text-lime-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.09),inset_0_-10px_16px_rgba(0,0,0,0.22),0_10px_18px_rgba(0,0,0,0.38)]"
                      : "border-stone-200/10 bg-[linear-gradient(145deg,#948375,#6c5f54_36%,#564b42_68%,#413830)] text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-10px_16px_rgba(0,0,0,0.22),0_10px_18px_rgba(0,0,0,0.38)]"
                  } ${
                    isSelected
                      ? "z-10 scale-[1.02] border-amber-100/22 ring-2 ring-amber-50/8 shadow-[0_0_0_1px_rgba(245,158,11,0.05),0_14px_28px_rgba(0,0,0,0.52)]"
                      : "z-[1]"
                  } disabled:opacity-80`}
                  style={{
                    left: `${((block.x + previewX) / width) * 100}%`,
                    top: `${((block.y + previewY) / height) * 100}%`,
                    width: `${(block.w / width) * 100}%`,
                    height: `${(block.h / height) * 100}%`,
                  }}
                  aria-label={`${block.target ? "Gate seal" : "Stone ward"} ${rune?.label ?? block.id}`}
                >
                  <DustPuffs active={dustActive} />
                  <span className="pointer-events-none absolute inset-[3px] rounded-[11px] border border-white/[0.05]" />
                  <span className="pointer-events-none absolute inset-x-[11%] top-1 h-px bg-white/[0.05]" />
                  <span className="pointer-events-none absolute inset-x-[14%] bottom-1 h-px bg-black/15" />
                  <span className="pointer-events-none absolute left-[8px] top-[7px] h-3 w-3 rounded-full bg-white/[0.025] blur-[2px]" />
                  <span className="pointer-events-none absolute bottom-[6px] right-[8px] h-3 w-3 rounded-full bg-black/12 blur-[2px]" />
                  <span className="pointer-events-none absolute inset-y-[22%] left-[10px] w-px bg-white/[0.02]" />
                  <span className="pointer-events-none absolute inset-y-[24%] right-[10px] w-px bg-black/12" />
                  <WardGlyph runeId={runeId} target={block.target} />
                  <span
                    className={`pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] uppercase tracking-[0.18em] ${
                      block.target ? "text-lime-50/68" : "text-stone-100/50"
                    }`}
                  >
                    {block.target ? "Koru Gate Seal" : rune?.label ?? block.label ?? block.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] rounded-[24px] border border-stone-700/65 bg-[linear-gradient(180deg,rgba(42,33,28,0.96),rgba(18,14,12,0.98))] p-4 shadow-[0_18px_32px_rgba(0,0,0,0.3)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-400/70">
              Ancient stone lock
            </p>
            <p className="mt-1 font-bold text-stone-100">
              {active
                ? active.target
                  ? "Koru Gate Seal"
                  : getNattauRuneDefinition(getBlockRune(active, blocks.indexOf(active)))?.label ?? active.label ?? active.id
                : "None"}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-stone-400/80">
              Shift the carved stone wards through the worn channels. A complete slide costs one move, whether it nudges a single cell or grinds all the way to the stop.
            </p>
          </div>

          {active?.axis === "h" ? (
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                disabled={effectiveDisabled || activeRange.left === 0}
                onClick={() => moveSelected("left", "max")}
                className="h-12 w-12 rounded-xl border border-lime-200/12 bg-black/22 text-lg text-lime-100/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:opacity-25"
                aria-label="Slide as far left as possible"
                title="To the left stop — 1 move"
              >
                ⇤
              </button>
              <button
                type="button"
                disabled={effectiveDisabled || activeRange.left === 0}
                onClick={() => moveSelected("left", "one")}
                className="h-12 w-12 rounded-xl border border-stone-400/20 bg-black/22 text-xl text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:opacity-25"
                aria-label="Slide one cell left"
                title="One cell — 1 move"
              >
                ←
              </button>
              <button
                type="button"
                disabled={effectiveDisabled || activeRange.right === 0}
                onClick={() => moveSelected("right", "one")}
                className="h-12 w-12 rounded-xl border border-stone-400/20 bg-black/22 text-xl text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:opacity-25"
                aria-label="Slide one cell right"
                title="One cell — 1 move"
              >
                →
              </button>
              <button
                type="button"
                disabled={effectiveDisabled || activeRange.right === 0}
                onClick={() => moveSelected("right", "max")}
                className="h-12 w-12 rounded-xl border border-lime-200/12 bg-black/22 text-lg text-lime-100/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:opacity-25"
                aria-label="Slide as far right as possible"
                title="To the right stop — 1 move"
              >
                ⇥
              </button>
            </div>
          ) : null}

          {active?.axis === "v" ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={effectiveDisabled || activeRange.up === 0}
                onClick={() => moveSelected("up", "max")}
                className="h-12 w-12 rounded-xl border border-lime-200/12 bg-black/22 text-lg text-lime-100/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:opacity-25"
                aria-label="Slide as far up as possible"
                title="To the upper stop — 1 move"
              >
                ⇈
              </button>
              <button
                type="button"
                disabled={effectiveDisabled || activeRange.up === 0}
                onClick={() => moveSelected("up", "one")}
                className="h-12 w-12 rounded-xl border border-stone-400/20 bg-black/22 text-xl text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:opacity-25"
                aria-label="Slide one cell up"
                title="One cell — 1 move"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={effectiveDisabled || activeRange.down === 0}
                onClick={() => moveSelected("down", "max")}
                className="h-12 w-12 rounded-xl border border-lime-200/12 bg-black/22 text-lg text-lime-100/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:opacity-25"
                aria-label="Slide as far down as possible"
                title="To the lower stop — 1 move"
              >
                ⇊
              </button>
              <button
                type="button"
                disabled={effectiveDisabled || activeRange.down === 0}
                onClick={() => moveSelected("down", "one")}
                className="h-12 w-12 rounded-xl border border-stone-400/20 bg-black/22 text-xl text-stone-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] disabled:opacity-25"
                aria-label="Slide one cell down"
                title="One cell — 1 move"
              >
                ↓
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-stone-700/45 pt-3 text-[11px] text-stone-400/85">
          <span className="rounded-full border border-stone-600/35 bg-black/18 px-2.5 py-1">← / → = one cell</span>
          <span className="rounded-full border border-lime-200/10 bg-lime-950/15 px-2.5 py-1 text-lime-50/70">⇤ / ⇥ = to the stop</span>
          <span className="rounded-full border border-stone-500/20 bg-stone-950/12 px-2.5 py-1">drag = any legal distance</span>
        </div>
      </div>

      <style jsx global>{`
        .nattau-dust-puff {
          position: absolute;
          bottom: -2px;
          z-index: 30;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(204, 182, 150, 0.36) 0%, rgba(158, 137, 111, 0.18) 44%, transparent 78%);
          filter: blur(2px);
          pointer-events: none;
          opacity: 0;
          animation: nattau-stone-dust 900ms ease-out infinite;
        }

        .nattau-dust-puff-a {
          left: 12%;
          width: 16px;
          height: 10px;
          animation-delay: 0s;
        }

        .nattau-dust-puff-b {
          left: 32%;
          width: 18px;
          height: 12px;
          animation-delay: 0.14s;
        }

        .nattau-dust-puff-c {
          right: 28%;
          width: 14px;
          height: 10px;
          animation-delay: 0.24s;
        }

        .nattau-dust-puff-d {
          right: 10%;
          width: 18px;
          height: 12px;
          animation-delay: 0.36s;
        }

        @keyframes nattau-stone-dust {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0.8);
          }
          18% {
            opacity: 0.9;
          }
          100% {
            opacity: 0;
            transform: translateY(-14px) scale(1.55);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .nattau-dust-puff {
            animation: none;
            opacity: 0.45;
          }
        }
      `}</style>
    </div>
  );
}
