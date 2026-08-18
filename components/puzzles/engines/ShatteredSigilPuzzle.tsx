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
import {
  buildMatchedParchmentClipPath,
  isSigilMaterial,
  SIGIL_NAMES,
  SIGIL_VARIANTS,
  sigilPoolForMaterial,
  stableSigilHash,
  type SigilMaterial,
  type SigilVariant,
} from "@/lib/puzzles/shatteredSigil";
import styles from "./ShatteredSigilPuzzle.module.css";

type ReferenceMode = "open" | "hold" | "none";
type DragState = {
  index: number;
  pointerId: number;
  startX: number;
  startY: number;
};

type SigilPresentation = {
  signature: string;
  tearSeed: string;
  material: SigilMaterial;
  variant: SigilVariant;
  rotation: number;
  mirror: boolean;
  referenceMode: ReferenceMode;
  assistCorrect: boolean;
};

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

  if (variant === "first_flame") {
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

  if (variant === "sun_compass") {
    return (
      <>
        <circle cx="200" cy="200" r="159" />
        <circle cx="200" cy="200" r="124" />
        <circle cx="200" cy="200" r="57" />
        <RitualMarks count={16} outer={157} inner={143} />
        <path d="M200 73 L222 158 L327 200 L222 242 L200 327 L178 242 L73 200 L178 158 Z" />
        <path d="M116 116 L164 174 M284 116 L236 174 M284 284 L236 226 M116 284 L164 226" />
        <path d="M200 161 L239 200 L200 239 L161 200 Z" />
        <circle cx="200" cy="200" r="20" />
      </>
    );
  }

  if (variant === "ancestral_eye") {
    return (
      <>
        <circle cx="200" cy="200" r="159" />
        <circle cx="200" cy="200" r="129" />
        <RitualMarks count={10} outer={157} inner={141} offset={18} />
        <path d="M82 200 C119 139 160 116 200 116 C240 116 281 139 318 200 C281 261 240 284 200 284 C160 284 119 261 82 200 Z" />
        <circle cx="200" cy="200" r="58" />
        <circle cx="200" cy="200" r="23" />
        <path d="M200 72 L218 116 L200 101 L182 116 Z" />
        <path d="M200 328 L218 284 L200 299 L182 284 Z" />
        <path d="M111 126 L145 151 M289 126 L255 151 M111 274 L145 249 M289 274 L255 249" />
      </>
    );
  }

  if (variant === "storm_wheel") {
    return (
      <>
        <circle cx="200" cy="200" r="159" />
        <circle cx="200" cy="200" r="125" />
        <RitualMarks count={8} outer={157} inner={140} offset={22.5} />
        <circle cx="200" cy="200" r="39" />
        {Array.from({ length: 8 }, (_, index) => (
          <g key={index} transform={`rotate(${index * 45} 200 200)`}>
            <path d="M200 161 C226 145 246 124 257 93 C249 128 253 151 269 176" />
            <path d="M253 110 L276 102 L263 127" />
          </g>
        ))}
        <path d="M158 200 L181 187 L175 213 L200 200 L225 187 L219 213 L242 200" />
      </>
    );
  }

  if (variant === "guardian_knot") {
    return (
      <>
        <circle cx="200" cy="200" r="159" />
        <circle cx="200" cy="200" r="128" />
        <RitualMarks count={12} outer={157} inner={142} offset={15} />
        <path d="M200 91 L309 200 L200 309 L91 200 Z" />
        <path d="M200 122 L278 200 L200 278 L122 200 Z" />
        <path d="M144 144 C166 123 188 126 200 145 C212 126 234 123 256 144 C277 166 274 188 255 200 C274 212 277 234 256 256 C234 277 212 274 200 255 C188 274 166 277 144 256 C123 234 126 212 145 200 C126 188 123 166 144 144 Z" />
        <circle cx="200" cy="200" r="27" />
      </>
    );
  }

  if (variant === "twin_moons") {
    return (
      <>
        <circle cx="200" cy="200" r="159" />
        <circle cx="200" cy="200" r="126" />
        <RitualMarks count={14} outer={157} inner={141} offset={12.8} />
        <path d="M167 126 C132 139 110 167 110 201 C110 239 138 270 176 277 C152 260 141 235 141 208 C141 174 155 147 184 130" />
        <path d="M233 126 C268 139 290 167 290 201 C290 239 262 270 224 277 C248 260 259 235 259 208 C259 174 245 147 216 130" />
        <ellipse cx="200" cy="200" rx="44" ry="71" />
        <path d="M129 200 H271 M200 83 V317" />
        <circle cx="200" cy="200" r="17" />
      </>
    );
  }

  return (
    <>
      <circle cx="200" cy="200" r="159" />
      <circle cx="200" cy="200" r="128" />
      <circle cx="200" cy="200" r="92" />
      <circle cx="200" cy="200" r="55" />
      <RitualMarks count={12} outer={157} inner={141} offset={15} />
      {Array.from({ length: 8 }, (_, index) => (
        <path key={index} d="M200 72 L200 145" transform={`rotate(${index * 45} 200 200)`} />
      ))}
      <path d="M111 200 C139 177 167 166 200 166 C233 166 261 177 289 200 C261 223 233 234 200 234 C167 234 139 223 111 200 Z" />
      <circle cx="200" cy="200" r="21" />
      <path d="M151 151 L249 249 M249 151 L151 249" />
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

function resolvePresentation(
  publicConfig: JsonRecord,
  difficultyLabel: string,
  fallbackSeed: string,
): SigilPresentation {
  const signature = String(
    publicConfig.variant_id ??
      (Array.isArray(publicConfig.symbols)
        ? publicConfig.symbols.join("|")
        : fallbackSeed),
  );
  const signatureHash = stableSigilHash(signature);
  const explicitMaterial = publicConfig.material;
  const material: SigilMaterial = isSigilMaterial(explicitMaterial)
    ? explicitMaterial
    : ((signatureHash >>> 8) % 3 === 0 ? "parchment" : "stone");

  const explicitVariant = publicConfig.art_variant;
  const materialPool = sigilPoolForMaterial(material);
  const variant = (
    typeof explicitVariant === "string" &&
    SIGIL_VARIANTS.includes(explicitVariant as SigilVariant)
      ? explicitVariant
      : materialPool[signatureHash % materialPool.length]
  ) as SigilVariant;

  const rotation = Number(publicConfig.art_rotation ?? ((signatureHash >>> 3) % 8) * 45);
  const mirror = Boolean(publicConfig.art_mirror ?? ((signatureHash >>> 7) & 1) === 1);
  const difficulty = difficultyLabel.toLowerCase();
  const defaultReferenceMode: ReferenceMode =
    difficulty === "easy" ? "open" : difficulty === "insane" ? "none" : "hold";
  const rawReferenceMode = String(publicConfig.reference_mode ?? defaultReferenceMode);
  const referenceMode: ReferenceMode = ["open", "hold", "none"].includes(rawReferenceMode)
    ? (rawReferenceMode as ReferenceMode)
    : defaultReferenceMode;

  return {
    signature,
    tearSeed: String(publicConfig.tear_seed ?? signature),
    material,
    variant,
    rotation,
    mirror,
    referenceMode,
    assistCorrect: Boolean(publicConfig.assist_correct ?? difficulty === "easy"),
  };
}

function fragmentClipStyle(
  material: SigilMaterial,
  targetIndex: number,
  size: number,
  tearSeed: string,
) {
  return material === "parchment"
    ? { clipPath: buildMatchedParchmentClipPath(targetIndex, size, tearSeed) }
    : undefined;
}

function FragmentArtwork({
  targetIndex,
  size,
  presentation,
}: {
  targetIndex: number;
  size: number;
  presentation: SigilPresentation;
}) {
  const cell = 400 / size;
  const targetRow = Math.floor(targetIndex / size);
  const targetCol = targetIndex % size;
  const fragmentViewBox = `${targetCol * cell} ${targetRow * cell} ${cell} ${cell}`;

  return (
    <>
      <SigilArtwork
        variant={presentation.variant}
        rotation={presentation.rotation}
        mirror={presentation.mirror}
        material={presentation.material}
        viewBox={fragmentViewBox}
        className={styles.art}
      />
      <span className={styles.surfaceNoise} />
      <span className={styles.edgeWear} />
      <span className={styles.dust} />
    </>
  );
}

export function ShatteredSigilPreview({
  publicConfig,
  difficultyLabel,
}: {
  publicConfig: JsonRecord;
  difficultyLabel: string;
}) {
  const size = Number(publicConfig.size ?? 3);
  const initialOrder = Array.isArray(publicConfig.initial_order)
    ? (publicConfig.initial_order as string[])
    : Array.from({ length: size * size }, (_, index) => String(index));
  const presentation = resolvePresentation(publicConfig, difficultyLabel, "gm-preview");
  const materialClass =
    presentation.material === "parchment" ? styles.parchment : styles.stone;

  return (
    <div className={styles.preview}>
      <div className={`${styles.shell} ${materialClass}`}>
        <div className={styles.recess}>
          <div
            className={`${styles.board} ${presentation.material === "parchment" ? styles.parchmentBoard : ""}`}
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            aria-label="GM preview of the generated Shattered Sigil"
          >
            {initialOrder.map((tileId, index) => {
              const targetIndex = Number(tileId);
              return (
                <div
                  key={`${tileId}-${index}`}
                  className={`${styles.fragment} ${styles.previewFragment} ${materialClass}`}
                  style={fragmentClipStyle(
                    presentation.material,
                    targetIndex,
                    size,
                    presentation.tearSeed,
                  )}
                >
                  <FragmentArtwork
                    targetIndex={targetIndex}
                    size={size}
                    presentation={presentation}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className={styles.previewMeta}>
        <span>{presentation.material === "parchment" ? "Torn parchment" : "Carved stone"}</span>
        <span>·</span>
        <span>{SIGIL_NAMES[presentation.variant]}</span>
        <span>·</span>
        <span>{size}×{size}</span>
      </div>
    </div>
  );
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
  const presentation = resolvePresentation(
    puzzle.public_config,
    puzzle.difficulty_label,
    puzzle.id,
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [memoryVisible, setMemoryVisible] = useState(
    presentation.referenceMode === "open",
  );
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

  const fullReferenceVisible =
    presentation.referenceMode === "open" || memoryVisible;
  const solved = run.status === "solved";
  const materialClass =
    presentation.material === "parchment" ? styles.parchment : styles.stone;

  return (
    <div className="mx-auto max-w-[680px] space-y-4">
      <div className={`${styles.shell} ${materialClass}`}>
        <div className={styles.recess}>
          <div
            className={`${styles.board} ${solved ? styles.boardSolved : ""} ${presentation.material === "parchment" ? styles.parchmentBoard : ""}`}
            style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
            aria-label="Shattered ritual image fragments"
          >
            {order.map((tileId, index) => {
              const targetIndex = Number(tileId);
              const isCorrect = targetIndex === index;
              const isNeighbor = selected !== null && isAdjacent(selected, index, size);

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
                  style={fragmentClipStyle(
                    presentation.material,
                    targetIndex,
                    size,
                    presentation.tearSeed,
                  )}
                  className={`${styles.fragment} ${materialClass} ${selected === index ? styles.selected : ""} ${isNeighbor ? styles.neighbor : ""} ${presentation.assistCorrect && isCorrect ? styles.correct : ""} ${pulse.includes(index) ? styles.swapPulse : ""}`}
                  aria-label={`Ritual fragment ${index + 1}${selected === index ? ", selected" : ""}`}
                >
                  <FragmentArtwork
                    targetIndex={targetIndex}
                    size={size}
                    presentation={presentation}
                  />
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
                variant={presentation.variant}
                rotation={presentation.rotation}
                mirror={presentation.mirror}
                material={presentation.material}
                className={`${styles.art} ${fullReferenceVisible ? styles.referenceVisible : styles.referenceHidden}`}
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/45">
              {presentation.material === "parchment"
                ? "Recovered ritual manuscript"
                : "Ceremonial stone seal"}
            </p>
            <h3 className="mt-1 text-base font-black text-stone-100">
              {SIGIL_NAMES[presentation.variant]}
            </h3>
            <p className="mt-2 text-xs leading-5 text-stone-400">
              This is one ritual image shattered into misplaced fragments. Match the
              broken lines, rings and symbols until the complete diagram is restored.
            </p>

            {presentation.referenceMode === "hold" ? (
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

            {presentation.referenceMode === "none" ? (
              <p className="mt-3 rounded-xl border border-stone-700/45 bg-black/15 px-3 py-2 text-[11px] leading-5 text-stone-500">
                The original diagram is lost. Reconstruct it from matching strokes,
                circles and torn edges alone.
              </p>
            ) : null}

            {presentation.assistCorrect ? (
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
