"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { getNattauRuneDefinition } from "@/lib/puzzles/nattauRunes";
import type { CampaignPuzzleRow, CampaignPuzzleRunRow, JsonRecord } from "@/lib/puzzles/puzzleTypes";
import styles from "./SlidingLockPuzzle.module.css";

type Axis = "h" | "v";
type Direction = "left" | "right" | "up" | "down";
type Block = { id: string; x: number; y: number; w: number; h: number; axis: Axis; target?: boolean; label?: string };
type DragState = { blockId: string; pointerId: number; startClientX: number; startClientY: number; previewSteps: number };
type MoveRange = Record<Direction, number>;
type Motion = { blockId: string; direction: Direction; nonce: number } | null;

const BLOCK_RUNES = ["awa", "matau", "tara", "whetu", "ahi", "niho", "rangi"];
const DIRECTIONS: Array<{ name: Direction; dx: number; dy: number; axis: Axis }> = [
  { name: "left", dx: -1, dy: 0, axis: "h" }, { name: "right", dx: 1, dy: 0, axis: "h" },
  { name: "up", dx: 0, dy: -1, axis: "v" }, { name: "down", dx: 0, dy: 1, axis: "v" },
];
const DUST = [[11,7,-16,-12,0],[24,5,-8,-18,50],[37,8,4,-13,90],[51,6,13,-20,20],[66,9,18,-11,120],[79,5,8,-17,70],[90,7,-13,-14,140]] as const;

function overlaps(a: {x:number;y:number;w:number;h:number}, b: {x:number;y:number;w:number;h:number}) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function canOccupy(block: Block, x: number, y: number, blocks: Block[], width: number, height: number) {
  if (x < 0 || y < 0 || x + block.w > width || y + block.h > height) return false;
  return !blocks.some((other) => other.id !== block.id && overlaps({x,y,w:block.w,h:block.h}, other));
}

function getMoveRange(block: Block | null, blocks: Block[], width: number, height: number): MoveRange {
  const result: MoveRange = { left: 0, right: 0, up: 0, down: 0 };
  if (!block) return result;
  for (const direction of DIRECTIONS) {
    if (direction.axis !== block.axis) continue;
    for (let distance = 1; distance <= Math.max(width, height); distance += 1) {
      if (!canOccupy(block, block.x + direction.dx * distance, block.y + direction.dy * distance, blocks, width, height)) break;
      result[direction.name] = distance;
    }
  }
  return result;
}

function runeFor(block: Block, index: number) { return block.target ? "koru" : BLOCK_RUNES[index % BLOCK_RUNES.length]; }
function directionFromSteps(axis: Axis, steps: number): Direction | null {
  if (!steps) return null;
  return axis === "h" ? (steps < 0 ? "left" : "right") : (steps < 0 ? "up" : "down");
}

function EngravedGlyph({ runeId, target }: { runeId: string; target?: boolean }) {
  const rune = getNattauRuneDefinition(runeId);
  if (!rune) return null;
  const highlight = target ? "rgba(220,235,211,.34)" : "rgba(235,226,211,.28)";
  const shadow = target ? "rgba(14,28,19,.88)" : "rgba(25,20,17,.9)";
  return (
    <svg viewBox="0 0 24 24" className={styles.glyph} fill="none" aria-hidden="true">
      <g stroke={shadow} strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" transform="translate(.45 .55)">
        {rune.paths.map((path) => <path key={`s-${path}`} d={path} />)}
      </g>
      <g stroke={highlight} strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" transform="translate(-.25 -.35)">
        {rune.paths.map((path) => <path key={`h-${path}`} d={path} />)}
      </g>
    </svg>
  );
}

function DustBurst({ direction, nonce }: { direction: Direction; nonce: number }) {
  return (
    <span key={nonce} className={`${styles.dust} ${styles[`dust_${direction}`]}`} aria-hidden="true">
      {DUST.map(([position,size,dx,dy,delay], index) => (
        <i key={index} style={{"--p":`${position}%`,"--s":`${size}px`,"--x":`${dx}px`,"--y":`${dy}px`,"--d":`${delay}ms`} as CSSProperties} />
      ))}
    </span>
  );
}

function Control({ children, disabled, onClick, label, accent }: { children: ReactNode; disabled: boolean; onClick:()=>void; label:string; accent?:boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} aria-label={label} title={label} className={`${styles.control} ${accent ? styles.controlAccent : ""}`}>{children}</button>;
}

export function SlidingLockPuzzle({ puzzle, run, disabled, onAction }: {
  puzzle: CampaignPuzzleRow; run: CampaignPuzzleRunRow; disabled: boolean; onAction: (action: JsonRecord) => Promise<unknown>;
}) {
  const width = Number(puzzle.public_config.width ?? 6);
  const height = Number(puzzle.public_config.height ?? 6);
  const exitRow = Number(puzzle.public_config.exit_row ?? 2);
  const blocks = useMemo(() => Array.isArray(run.state.blocks) ? run.state.blocks as unknown as Block[] : [], [run.state.blocks]);
  const boardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(() => blocks.find((b) => b.target)?.id ?? blocks[0]?.id ?? null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [moving, setMoving] = useState(false);
  const [motion, setMotion] = useState<Motion>(null);
  const [settling, setSettling] = useState<string | null>(null);

  const active = blocks.find((b) => b.id === selected) ?? null;
  const range = useMemo(() => getMoveRange(active, blocks, width, height), [active, blocks, width, height]);
  const locked = disabled || moving;
  const tracks = useMemo(() => {
    const seen = new Set<string>();
    return blocks.filter((b) => {
      const key = b.axis === "h" ? `h-${b.y}-${b.h}` : `v-${b.x}-${b.w}`;
      if (seen.has(key)) return false; seen.add(key); return true;
    });
  }, [blocks]);

  const fireMotion = (blockId: string, direction: Direction) => {
    const nonce = Date.now() + Math.random();
    setMotion({ blockId, direction, nonce });
    window.setTimeout(() => setMotion((current) => current?.nonce === nonce ? null : current), 620);
  };

  const performMove = async (block: Block, direction: Direction, distance: number) => {
    if (locked || distance < 1) return;
    const finalDistance = Math.min(distance, getMoveRange(block, blocks, width, height)[direction]);
    if (finalDistance < 1) return;
    setMoving(true); fireMotion(block.id, direction);
    try {
      await onAction({ type: "slide", block_id: block.id, direction, distance: finalDistance });
      setSettling(block.id);
      window.setTimeout(() => setSettling((current) => current === block.id ? null : current), 260);
    } finally { setMoving(false); }
  };

  const moveSelected = (direction: Direction, mode: "one" | "max") => {
    if (!active) return;
    void performMove(active, direction, mode === "max" ? range[direction] : Math.min(1, range[direction]));
  };

  const beginDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: Block) => {
    if (locked) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setSelected(block.id);
    setDrag({blockId:block.id,pointerId:event.pointerId,startClientX:event.clientX,startClientY:event.clientY,previewSteps:0});
  };

  const updateDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: Block) => {
    if (!drag || drag.blockId !== block.id || drag.pointerId !== event.pointerId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const legal = getMoveRange(block, blocks, width, height);
    const raw = block.axis === "h" ? Math.round((event.clientX-drag.startClientX)/(rect.width/width)) : Math.round((event.clientY-drag.startClientY)/(rect.height/height));
    const next = block.axis === "h" ? Math.max(-legal.left,Math.min(legal.right,raw)) : Math.max(-legal.up,Math.min(legal.down,raw));
    if (next !== drag.previewSteps && next !== 0) {
      const direction = directionFromSteps(block.axis, next-drag.previewSteps); if (direction) fireMotion(block.id,direction);
    }
    setDrag((current) => current?.blockId === block.id ? {...current,previewSteps:next} : current);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, block: Block) => {
    if (!drag || drag.blockId !== block.id || drag.pointerId !== event.pointerId) return;
    const steps = drag.previewSteps; setDrag(null);
    const direction = directionFromSteps(block.axis, steps); if (direction) void performMove(block,direction,Math.abs(steps));
  };

  return (
    <div className={styles.shell}>
      <div className={styles.monolith}><div className={styles.rim}>
        <div ref={boardRef} className={styles.board}>
          {tracks.map((block) => <span key={`track-${block.id}`} className={`${styles.track} ${block.axis === "h" ? styles.trackH : styles.trackV}`} style={block.axis === "h" ? {left:"2.5%",top:`${(block.y/height)*100+.7}%`,width:"95%",height:`${(block.h/height)*100-1.4}%`} : {left:`${(block.x/width)*100+.7}%`,top:"2.5%",width:`${(block.w/width)*100-1.4}%`,height:"95%"}} />)}
          <span className={styles.gate} style={{top:`${(exitRow/height)*100}%`,height:`${100/height}%`}} aria-hidden="true" />
          <span className={`${styles.crack} ${styles.crackA}`} /><span className={`${styles.crack} ${styles.crackB}`} /><span className={`${styles.crack} ${styles.crackC}`} />

          {blocks.map((block,index) => {
            const isSelected = selected === block.id;
            const isDragging = drag?.blockId === block.id;
            const preview = isDragging ? drag.previewSteps : 0;
            const px = block.axis === "h" ? preview : 0; const py = block.axis === "v" ? preview : 0;
            const runeId = runeFor(block,index); const rune = getNattauRuneDefinition(runeId);
            const classes = [styles.ward, block.target && styles.target, isSelected && styles.selected, isDragging && styles.dragging, settling===block.id && styles.settle].filter(Boolean).join(" ");
            return (
              <button key={block.id} type="button" disabled={locked} className={classes}
                onPointerDown={(e)=>beginDrag(e,block)} onPointerMove={(e)=>updateDrag(e,block)} onPointerUp={(e)=>finishDrag(e,block)} onPointerCancel={()=>setDrag(null)} onClick={()=>setSelected(block.id)}
                style={{left:`${((block.x+px)/width)*100}%`,top:`${((block.y+py)/height)*100}%`,width:`${(block.w/width)*100}%`,height:`${(block.h/height)*100}%`}}
                aria-label={`${block.target ? "Koru gate seal" : "Stone ward"} ${rune?.label ?? block.id}`}>
                <span className={styles.face}><EngravedGlyph runeId={runeId} target={block.target} /><span className={styles.label}>{block.target ? "Koru" : rune?.label ?? block.label ?? block.id}</span></span>
                {motion?.blockId===block.id ? <DustBurst direction={motion.direction} nonce={motion.nonce} /> : null}
              </button>
            );
          })}
        </div>
      </div></div>

      <div className={styles.controls}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">Carved ward</p>
          <p className="mt-1 truncate font-bold text-stone-200">{active ? active.target ? "Koru Gate Seal" : getNattauRuneDefinition(runeFor(active,blocks.indexOf(active)))?.label ?? active.label ?? active.id : "None"}</p>
          <p className="mt-1 text-xs leading-5 text-stone-500">Drag the stone directly. One complete slide costs one move, no matter the distance.</p>
        </div>
        {active?.axis === "h" ? <div className={styles.controlGrid4}>
          <Control disabled={locked||!range.left} onClick={()=>moveSelected("left","max")} label="Slide left to the stop" accent>⇤</Control><Control disabled={locked||!range.left} onClick={()=>moveSelected("left","one")} label="Slide one cell left">←</Control><Control disabled={locked||!range.right} onClick={()=>moveSelected("right","one")} label="Slide one cell right">→</Control><Control disabled={locked||!range.right} onClick={()=>moveSelected("right","max")} label="Slide right to the stop" accent>⇥</Control>
        </div> : null}
        {active?.axis === "v" ? <div className={styles.controlGrid2}>
          <Control disabled={locked||!range.up} onClick={()=>moveSelected("up","max")} label="Slide up to the stop" accent>⇈</Control><Control disabled={locked||!range.up} onClick={()=>moveSelected("up","one")} label="Slide one cell up">↑</Control><Control disabled={locked||!range.down} onClick={()=>moveSelected("down","one")} label="Slide one cell down">↓</Control><Control disabled={locked||!range.down} onClick={()=>moveSelected("down","max")} label="Slide down to the stop" accent>⇊</Control>
        </div> : null}
      </div>
    </div>
  );
}
