"use client";

import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";
import styles from "./ShatteredSigilPuzzle.module.css";

type SigilVariant =
  | "eclipse"
  | "drowned_star"
  | "serpent"
  | "moon_gate"
  | "thorn_crown"
  | "first_flame";
type SigilMaterial = "stone" | "parchment";
type ReferenceMode = "open" | "hold" | "none";
type DragState = {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
};

const SIGIL_VARIANTS: SigilVariant[] = [
  "eclipse",
  "drowned_star",
  "serpent",
  "moon_gate",
  "thorn_crown",
  "first_flame",
];

const SIGIL_NAMES: Record<SigilVariant, string> = {
  eclipse: "Seal of the Drowned Eclipse",
  drowned_star: "The Nine-Tide Star",
  serpent: "Coil of the First Serpent",
  moon_gate: "The Moon Gate Diagram",
  thorn_crown: "Crown of Thorns",
  first_flame: "Circle of the First Flame",
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function RitualMarks({
  count,
  outer = 154,
  inner = 139,
  offset = 0,
}: {
  count: number;
  outer?: number;
  inner?: number;
  offset?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <g key={index} transform={`rotate(${offset + (360 / count) * index} 200 200)`}>
          <path d={`M200 ${200 - outer} L200 ${200 - inner}`} />
          <path d={`M194 ${200 - inner + 9} L200 ${200 - inner} L206 ${200 - inner + 9}`} />
        </g>
      ))}
    </>
  );
}

function motif(variant: SigilVariant) {
  if (variant === "eclipse") {
    return (
      <>
        <circle cx="200" cy="200" r="158" />
        <circle cx="200" cy="200" r="128" />
        <RitualMarks count={12} outer={156} inner={136} offset={15} />
        <path d="M116 200 C136 156 166 136 200 136 C234 136 264 156 284 200 C264 244 234 264 200 264 C166 264 136 244 116 200 Z" />
        <circle cx="200" cy="200" r="31" />
        <path d="M200 108 C173 124 160 150 160 179 C160 219 190 246 226 246 C245 246 262 239 276 226 C258 258 226 280 188 280 C139 280 100 242 100 194 C100 148 135 111 181 107" />
        <path d="M200 292 L200 338 M177 314 L200 338 L223 314" />
        <path d="M200 62 L200 108 M177 86 L200 62 L223 86" />
      </>
    );
  }

  if (variant === "drowned_star") {
    return (
      <>
        <circle cx="200" cy="200" r="158" />
        <circle cx="200" cy="200" r="122" />
        <RitualMarks count={8} outer={156} inner={137} offset={22.5} />
        <path d="M200 72 L225 151 L302 98 L249 175 L328 200 L249 225 L302 302 L225 249 L200 328 L175 249 L98 302 L151 225 L72 200 L151 175 L98 98 L175 151 Z" />
        <circle cx="200" cy="200" r="34" />
        <path d="M78 273 C111 246 145 246 178 273 S245 300 322 268" />
        <path d="M90 300 C124 278 154 280 184 302 S246 327 306 300" />
        <path d="M170 200 C178 184 188 176 200 176 C212 176 222 184 230 200 C222 216 212 224 200 224 C188 224 178 216 170 200 Z" />
      </>
    );
  }

  if (variant === "serpent") {
    return (
      <>
        <circle cx="200" cy="200" r="158" />
        <circle cx="200" cy="200" r="126" />
        <RitualMarks count={10} outer={156} inner={139} offset={18} />
        <path d="M104 226 C99 157 145 105 207 105 C264 105 301 145 297 194 C293 239 258 271 216 271 C179 271 152 248 152 217 C152 191 172 172 198 172 C219 172 235 188 235 208 C235 224 223 237 207 237 C193 237 184 227 184 216" />
        <path d="M103 226 C117 242 133 250 151 252" />
        <path d="M95 219 L77 202 M98 231 L75 237" />
        <path d="M278 119 L304 91 L300 132 Z" />
        <path d="M125 114 L99 86 L104 129 Z" />
        <path d="M200 286 L175 330 L200 317 L225 330 Z" />
      </>
    );
  }

  if (variant === "moon_gate") {
    return (
      <>
        <circle cx="200" cy="200" r="158" />
        <circle cx="200" cy="200" r="126" />
        <RitualMarks count={12} outer={156} inner={141} />
        <path d="M119 112 C88 141 72 174 72 207 C72 253 100 289 143 307 C118 281 106 251 106 216 C106 174 124 139 159 111" />
        <path d="M281 112 C312 141 328 174 328 207 C328 253 300 289 257 307 C282 281 294 251 294 216 C294 174 276 139 241 111" />
        <path d="M155 277 L155 151 L200 111 L245 151 L245 277" />
        <path d="M155 169 L245 169 M155 238 L245 238" />
        <path d="M200 148 L228 200 L200 252 L172 200 Z" />
        <circle cx="200" cy="200" r="17" />
      </>
    );
  }

  if (variant === "thorn_crown") {
    return (
      <>
        <circle cx="200" cy="200" r="158" />
        <circle cx="200" cy="200" r="126" />
        <RitualMarks count={16} outer={157} inner={143} offset={11.25} />
        <path d="M78 200 L103 181 L91 153 L123 151 L130 119 L156 137 L178 111 L192 143 L222 126 L224 159 L257 157 L244 188 L276 200 L244 212 L257 243 L224 241 L222 274 L192 257 L178 289 L156 263 L130 281 L123 249 L91 247 L103 219 Z" />
        <circle cx="200" cy="200" r="67" />
        <path d="M156 233 C151 198 170 167 200 158 C226 150 248 163 252 185 C256 207 240 224 220 224 C202 224 190 214 190 200 C190 190 197 183 207 183" />
        <path d="M172 263 L200 238 L228 263 M172 137 L200 162 L228 137" />
      </>
    );
  }

  return (
    <>
      <circle cx="200" cy="200" r="158" />
      <circle cx="200" cy="200" r="126" />
      <RitualMarks count={12} outer={156} inner={140} offset={15} />
      <path d="M200 80 C220 119 249 142 249 181 C249 214 228 239 200 239 C172 239 151 218 151 190 C151 168 164 150 182 138 C177 163 184 182 200 194 C219 176 224 151 215 126" />
      <path d="M200 239 C236 239 266 263 277 299 C250 282 224 279 200 291 C176 279 150 282 123 299 C134 263 164 239 200 239 Z" />
      <path d="M116 188 L76 200 L116 212 M284 188 L324 200 L284 212" />
      <path d="M166 105 L139 76 L151 118 M234 105 L261 76 L249 118" />
      <circle cx="200" cy="200" r="31" />
    </>
  );
}

function SigilArtwork({
  variant,
  rotation,
  mirror,
  material,
  viewBox = "0 0 400 400",
  className,
}: {
  variant: SigilVariant;
  rotation: number;
  mirror: boolean;
  material: SigilMaterial;
  viewBox?: string;
  className?: string;
}) {
  const transform = `${mirror ? "translate(400 0) scale(-1 1)" : ""} rotate(${rotation} 200 200)`;
  const palette =
    material === "parchment"
      ? {
          shadow: "rgba(79,43,27,0.28)",
          main: "rgba(48,29,21,0.88)",
          accent: "rgba(124,55,42,0.34)",
        }
      : {
          shadow: "rgba(6,12,9,0.82)",
          main: "rgba(207,221,207,0.58)",
          accent: "rgba(110,153,119,0.34)",
        };

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
        stroke={palette.shadow}
        strokeWidth={material === "parchment" ? 7 : 9}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {motif(variant)}
      </g>
      <g
        transform={transform}
        fill="none"
        stroke={palette.main}
        strokeWidth={material === "parchment" ? 3.3 : 4.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {motif(variant)}
      </g>
      <g
        transform={transform}
        fill="none"
        stroke={palette.accent}
        strokeWidth={material === "parchment" ? 1.2 : 1.7}
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

function dragTarget(index: number, size: number, dx: number, dy: number) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return null;
  const row = Math.floor(index / size);
  const col = index % size;

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0 && col > 0) return index - 1;
    if (dx > 0 && col < size - 1) return index + 1;
    return null;
  }

  if (dy < 0 && row > 0) return index - size;
  if (dy > 0 && row < size - 1) return index + size;
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
  const signature = String(
    puzzle.public_config.variant_id ??
      (Array.isArray(puzzle.public_config.symbols)
        ? puzzle.public_config.symbols.join("|")
        : puzzle.id),
  );
  const signatureHash = stableHash(signature);

  const explicitVariant = puzzle.public_config.art_variant;
  const variant = (
    typeof explicitVariant === "string" &&
    SIGIL_VARIANTS.includes(explicitVariant as SigilVariant)
      ? explicitVariant
      : SIGIL_VARIANTS[signatureHash % SIGIL_VARIANTS.length]
  ) as SigilVariant;

  const explicitMaterial = puzzle.public_config.material;
  const material: SigilMaterial =
    explicitMaterial === "parchment" || explicitMaterial === "stone"
      ? explicitMaterial
      : ((signatureHash >>> 8) % 3 === 0 ? "parchment" : "stone");

  const rotation = Number(
    puzzle.public_config.art_rotation ?? ((signatureHash >>> 3) % 8) * 45,
  );
  const mirror = Boolean(
    puzzle.public_config.art_mirror ?? ((signatureHash >>> 7) & 1) === 1,
  );

  const difficulty = puzzle.difficulty_label.toLowerCase();
  const defaultReferenceMode: ReferenceMode =
    difficulty === "easy" ? "open" : difficulty === "insane" ? "none" : "hold";
  const referenceMode = String(
    puzzle.public_config.reference_mode ?? defaultReferenceMode,
  ) as ReferenceMode;
  const assistCorrect = Boolean(
    puzzle.public_config.assist_correct ?? difficulty === "easy",
  );

  const [selected, setSelected] = useState<number | null>(null);
  const [memoryVisible, setMemoryVisible] = useState(referenceMode === "open");
  const [pulse, setPulse] = useState<number[]>([]);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const performSwap = async (from: number, to: number) => {
    if (disabled || !isAdjacent(from, to, size)) return;
    setPulse([from, to]);
    const result = await onAction({ type: "swap", from, to });
    if (result) setSelected(null);
    window.setTimeout(() => setPulse([]), 460);
  };

  const click = async (index: number) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
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

  const pointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (disabled) return;
    dragRef.current = {
      index,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const pointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.pointerId !== event.pointerId || drag.index !== index) return;

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const target = dragTarget(index, size, dx, dy);
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 24) {
      suppressClickRef.current = true;
    }
    if (target !== null) void performSwap(index, target);
  };

  const pointerCancel = () => {
    dragRef.current = null;
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
  const materialClass = material === "parchment" ? styles.parchment : styles.stone;

  return (
    <div className="mx-auto max-w-[680px] space-y-4">
      <div className={`${styles.shell} ${materialClass}`}>
        <div className={styles.recess}>
          <div
            className={`${styles.board} ${solved ? styles.boardSolved : ""}`}
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            aria-label="Shattered ritual image fragments"
          >
            {order.map((tileId, index) => {
              const targetIndex = Number(tileId);
              const targetRow = Math.floor(targetIndex / size);
              const targetCol = targetIndex % size;
              const isCorrect = targetIndex === index;
              const isNeighbor = selected !== null && isAdjacent(selected, index, size);
              const fragmentViewBox = `${targetCol * cell} ${targetRow * cell} ${cell} ${cell}`;

              return (
                <button
                  key={`${tileId}-${index}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => void click(index)}
                  onKeyDown={(event) => keyDown(event, index)}
                  onPointerDown={(event) => pointerDown(event, index)}
                  onPointerUp={(event) => pointerUp(event, index)}
                  onPointerCancel={pointerCancel}
                  className={`${styles.fragment} ${materialClass} ${selected === index ? styles.selected : ""} ${isNeighbor ? styles.neighbor : ""} ${assistCorrect && isCorrect ? styles.correct : ""} ${pulse.includes(index) ? styles.swapPulse : ""}`}
                  aria-label={`Ritual fragment ${index + 1}${selected === index ? ", selected" : ""}`}
                >
                  <SigilArtwork
                    variant={variant}
                    rotation={rotation}
                    mirror={mirror}
                    material={material}
                    viewBox={fragmentViewBox}
                    className={styles.art}
                  />
                  <span className={styles.surfaceNoise} />
                  <span className={styles.edgeWear} />
                  <span className={styles.dust} />
                </button>
              );
            })}
            {solved ? <div className={styles.solvedVeil} /> : null}
          </div>
        </div>
      </div>

      <div className={`${styles.referenceCard} ${materialClass} p-3 sm:p-4`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="mx-auto shrink-0 sm:mx-0">
            <div className={`${styles.referenceMedallion} ${materialClass}`}>
              <SigilArtwork
                variant={variant}
                rotation={rotation}
                mirror={mirror}
                material={material}
                className={`${styles.art} ${fullReferenceVisible ? styles.referenceVisible : styles.referenceHidden}`}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/45">
              {material === "parchment" ? "Recovered ritual manuscript" : "Ceremonial stone seal"}
            </p>
            <h3 className="mt-1 text-base font-black text-stone-100">
              {SIGIL_NAMES[variant]}
            </h3>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              This is one ritual image shattered into misplaced fragments. Match the
              broken lines, rings and symbols until the complete diagram is restored.
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
                  if (event.key === " " || event.key === "Enter") {
                    event.preventDefault();
                    setMemoryVisible(true);
                  }
                }}
                onKeyUp={() => setMemoryVisible(false)}
              >
                Hold to recall the intact ritual
              </button>
            ) : null}

            {referenceMode === "none" ? (
              <p className="mt-3 rounded-xl border border-stone-700/45 bg-black/15 px-3 py-2 text-[11px] leading-5 text-stone-500">
                The original diagram is lost. Reconstruct it from matching strokes,
                circles and torn edges alone.
              </p>
            ) : null}

            {assistCorrect ? (
              <p className="mt-3 text-[11px] text-emerald-200/55">
                Easy guidance: fragments already in their true position gain a faint
                greenstone edge.
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <p className="text-center text-xs leading-5 text-slate-500">
        Tap two neighboring fragments to exchange them, or drag a fragment toward an
        adjacent space. Every generated board is scrambled only through legal swaps,
        so the ritual can always be restored.
      </p>
    </div>
  );
}
