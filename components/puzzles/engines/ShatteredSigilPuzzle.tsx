"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";
import styles from "./ShatteredSigilPuzzle.module.css";

type SigilVariant = "tide" | "spiral" | "star" | "weave" | "sun";
type ReferenceMode = "open" | "hold" | "none";

function motif(variant: SigilVariant) {
  if (variant === "tide") {
    return (
      <>
        <circle cx="200" cy="200" r="154" />
        <circle cx="200" cy="200" r="118" />
        <path d="M57 202 C96 154 137 154 177 202 S258 250 343 202" />
        <path d="M66 244 C111 199 151 201 191 244 S269 286 334 242" />
        <path d="M154 182 C154 137 210 124 234 153 C261 187 234 226 197 218 C169 212 165 180 184 165" />
        <path d="M200 46 C215 84 235 101 272 114" />
        <path d="M200 354 C184 316 165 299 128 286" />
      </>
    );
  }

  if (variant === "star") {
    return (
      <>
        <circle cx="200" cy="200" r="155" />
        <circle cx="200" cy="200" r="76" />
        <path d="M200 48 L225 145 L313 87 L255 175 L352 200 L255 225 L313 313 L225 255 L200 352 L175 255 L87 313 L145 225 L48 200 L145 175 L87 87 L175 145 Z" />
        <path d="M121 121 C150 92 178 86 200 86 C222 86 250 92 279 121" />
        <path d="M121 279 C150 308 178 314 200 314 C222 314 250 308 279 279" />
      </>
    );
  }

  if (variant === "weave") {
    return (
      <>
        <circle cx="200" cy="200" r="154" />
        <path d="M70 118 C130 52 190 54 252 118 S330 181 330 200 S312 282 252 282 S130 348 70 282 S70 138 70 118" />
        <path d="M118 70 C52 130 54 190 118 252 S181 330 200 330 S282 312 282 252 S348 130 282 70 S138 70 118 70" />
        <path d="M111 200 C111 151 151 111 200 111 S289 151 289 200 S249 289 200 289 S111 249 111 200 Z" />
        <path d="M143 143 L257 257 M257 143 L143 257" />
      </>
    );
  }

  if (variant === "sun") {
    return (
      <>
        <circle cx="200" cy="200" r="154" />
        <circle cx="200" cy="200" r="88" />
        <circle cx="200" cy="200" r="38" />
        <path d="M200 45 L217 108 L252 54 L249 119 L302 81 L274 140 L337 126 L288 170 L354 181 L291 200 L354 219 L288 230 L337 274 L274 260 L302 319 L249 281 L252 346 L217 292 L200 355 L183 292 L148 346 L151 281 L98 319 L126 260 L63 274 L112 230 L46 219 L109 200 L46 181 L112 170 L63 126 L126 140 L98 81 L151 119 L148 54 L183 108 Z" />
        <path d="M153 199 C166 179 182 169 200 169 C218 169 234 179 247 199 C234 221 218 231 200 231 C182 231 166 221 153 199 Z" />
      </>
    );
  }

  return (
    <>
      <circle cx="200" cy="200" r="154" />
      <circle cx="200" cy="200" r="119" />
      <path d="M200 73 C258 73 306 119 306 176 C306 223 270 259 225 259 C188 259 160 232 160 198 C160 171 180 151 206 151 C227 151 243 167 243 187 C243 203 231 216 216 216" />
      <path d="M327 200 C327 258 281 306 224 306 C177 306 141 270 141 225 C141 188 168 160 202 160 C229 160 249 180 249 206 C249 227 233 243 213 243 C197 243 184 231 184 216" transform="rotate(120 200 200)" />
      <path d="M327 200 C327 258 281 306 224 306 C177 306 141 270 141 225 C141 188 168 160 202 160 C229 160 249 180 249 206 C249 227 233 243 213 243 C197 243 184 231 184 216" transform="rotate(240 200 200)" />
    </>
  );
}

function SigilArtwork({
  variant,
  rotation,
  mirror,
  viewBox = "0 0 400 400",
  className,
}: {
  variant: SigilVariant;
  rotation: number;
  mirror: boolean;
  viewBox?: string;
  className?: string;
}) {
  const transform = `${mirror ? "translate(400 0) scale(-1 1)" : ""} rotate(${rotation} 200 200)`;

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
    >
      <g
        transform={transform}
        fill="none"
        stroke="rgba(15,23,20,0.72)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {motif(variant)}
      </g>
      <g
        transform={transform}
        fill="none"
        stroke="rgba(207,221,207,0.58)"
        strokeWidth="4.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {motif(variant)}
      </g>
      <g
        transform={transform}
        fill="none"
        stroke="rgba(121,151,126,0.32)"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {motif(variant)}
      </g>
    </svg>
  );
}

function isAdjacent(from: number, to: number, size: number) {
  const sameRow = Math.floor(from / size) === Math.floor(to / size);
  return (sameRow && Math.abs(from - to) === 1) || Math.abs(from - to) === size;
}

function adjacentIndex(index: number, size: number, key: string) {
  const row = Math.floor(index / size);
  const col = index % size;
  if (key === "ArrowLeft" && col > 0) return index - 1;
  if (key === "ArrowRight" && col < size - 1) return index + 1;
  if (key === "ArrowUp" && row > 0) return index - size;
  if (key === "ArrowDown" && row < size - 1) return index + size;
  return null;
}

export function ShatteredSigilPuzzle({
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
  const size = Number(puzzle.public_config.size ?? 3);
  const order = useMemo(
    () => (Array.isArray(run.state.order) ? (run.state.order as string[]) : []),
    [run.state.order],
  );
  const variant = String(puzzle.public_config.art_variant ?? "spiral") as SigilVariant;
  const rotation = Number(puzzle.public_config.art_rotation ?? 0);
  const mirror = Boolean(puzzle.public_config.art_mirror ?? false);
  const referenceMode = String(puzzle.public_config.reference_mode ?? "open") as ReferenceMode;
  const assistCorrect = Boolean(puzzle.public_config.assist_correct ?? false);
  const [selected, setSelected] = useState<number | null>(null);
  const [memoryVisible, setMemoryVisible] = useState(referenceMode === "open");
  const [pulse, setPulse] = useState<number[]>([]);

  const performSwap = async (from: number, to: number) => {
    if (disabled || !isAdjacent(from, to, size)) return;
    setPulse([from, to]);
    const result = await onAction({ type: "swap", from, to });
    if (result) setSelected(null);
    window.setTimeout(() => setPulse([]), 460);
  };

  const click = async (index: number) => {
    if (disabled) return;
    if (selected === null) {
      setSelected(index);
      return;
    }
    if (selected === index) {
      setSelected(null);
      return;
    }
    if (!isAdjacent(selected, index, size)) {
      setSelected(index);
      return;
    }
    await performSwap(selected, index);
  };

  const keyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (disabled) return;
    const target = adjacentIndex(index, size, event.key);
    if (target === null) return;
    event.preventDefault();
    if (selected !== index) {
      setSelected(index);
      return;
    }
    void performSwap(index, target);
  };

  const fullReferenceVisible = referenceMode === "open" || memoryVisible;
  const solved = run.status === "solved";
  const cell = 400 / size;

  return (
    <div className="mx-auto max-w-[660px] space-y-4">
      <div className={styles.shell}>
        <div className={styles.recess}>
          <div
            className={styles.board}
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            aria-label="Shattered sigil fragments"
          >
            {order.map((tileId, index) => {
              const targetIndex = Number(tileId);
              const targetRow = Math.floor(targetIndex / size);
              const targetCol = targetIndex % size;
              const isCorrect = targetIndex === index;
              const fragmentViewBox = `${targetCol * cell} ${targetRow * cell} ${cell} ${cell}`;

              return (
                <button
                  key={`${tileId}-${index}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => void click(index)}
                  onKeyDown={(event) => keyDown(event, index)}
                  className={`${styles.fragment} ${selected === index ? styles.selected : ""} ${assistCorrect && isCorrect ? styles.correct : ""} ${pulse.includes(index) ? styles.swapPulse : ""}`}
                  aria-label={`Sigil fragment ${index + 1}${selected === index ? ", selected" : ""}`}
                >
                  <SigilArtwork
                    variant={variant}
                    rotation={rotation}
                    mirror={mirror}
                    viewBox={fragmentViewBox}
                    className={styles.art}
                  />
                  <span className={styles.surfaceNoise} />
                  <span className={styles.dust} />
                </button>
              );
            })}
            {solved ? <div className={styles.solvedVeil} /> : null}
          </div>
        </div>
      </div>

      <div className={`${styles.referenceCard} p-3 sm:p-4`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="mx-auto shrink-0 sm:mx-0">
            <div className={styles.referenceMedallion}>
              <SigilArtwork
                variant={variant}
                rotation={rotation}
                mirror={mirror}
                className={`${styles.art} ${fullReferenceVisible ? styles.referenceVisible : styles.referenceHidden}`}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/45">
              Intact memory
            </p>
            <h3 className="mt-1 text-base font-black text-stone-100">
              Restore the carved image
            </h3>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              Exchange neighboring fragments until the carved channels form one continuous ceremonial sigil.
            </p>

            {referenceMode === "hold" ? (
              <button
                type="button"
                className={`${styles.memoryButton} mt-3`}
                onPointerDown={() => setMemoryVisible(true)}
                onPointerUp={() => setMemoryVisible(false)}
                onPointerCancel={() => setMemoryVisible(false)}
                onPointerLeave={() => setMemoryVisible(false)}
                onKeyDown={(event) => {
                  if (event.key === " " || event.key === "Enter") setMemoryVisible(true);
                }}
                onKeyUp={() => setMemoryVisible(false)}
              >
                Hold to remember the intact sigil
              </button>
            ) : null}

            {referenceMode === "none" ? (
              <p className="mt-3 rounded-xl border border-stone-700/45 bg-black/15 px-3 py-2 text-[11px] leading-5 text-stone-500">
                The intact pattern is lost. Reconstruct it from the carved lines and matching edges alone.
              </p>
            ) : null}

            {assistCorrect ? (
              <p className="mt-3 text-[11px] text-emerald-200/55">
                Easy guidance: correctly seated fragments gain a faint greenstone edge.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-center text-xs leading-5 text-slate-500">
        Tap one fragment, then an adjacent fragment to exchange them. On keyboard, select a fragment and use the arrow keys.
      </p>
    </div>
  );
}
