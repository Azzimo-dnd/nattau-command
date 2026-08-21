"use client";

import type { RefObject } from "react";
import type { VttScene } from "./vttTypes";

type Props = {
  scene: VttScene;
  busy: boolean;
  mapInputRef: RefObject<HTMLInputElement | null>;
  mapFile: File | null;
  draftName: string;
  draftWidth: number;
  draftHeight: number;
  draftMapOpacity: number;
  draftGridOpacity: number;
  draftShowGrid: boolean;
  draftMapScale: number;
  draftMapOffsetX: number;
  draftMapOffsetZ: number;
  onMapFile: (file: File | null) => void;
  onName: (value: string) => void;
  onWidth: (value: number) => void;
  onHeight: (value: number) => void;
  onMapOpacity: (value: number) => void;
  onGridOpacity: (value: number) => void;
  onShowGrid: (value: boolean) => void;
  onMapScale: (value: number) => void;
  onMapOffsetX: (value: number) => void;
  onMapOffsetZ: (value: number) => void;
  onSave: () => void;
  onUpload: () => void;
  onRemoveMap: () => void;
};

export function VttSceneSettings(props: Props) {
  const {
    scene,
    busy,
    mapInputRef,
    mapFile,
    draftName,
    draftWidth,
    draftHeight,
    draftMapOpacity,
    draftGridOpacity,
    draftShowGrid,
    draftMapScale,
    draftMapOffsetX,
    draftMapOffsetZ,
  } = props;

  return (
    <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Scene map & grid</p>
      <p className="mt-2 text-[10px] leading-4 text-slate-500">
        Settings belong to this scene only. Prepared scenes remain private until they go live.
      </p>

      <label className="mt-3 block text-[10px] font-bold text-slate-400">
        Scene name
        <input
          value={draftName}
          maxLength={120}
          onChange={(event) => props.onName(event.target.value)}
          className="mt-1 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 outline-none focus:border-cyan-400/60"
        />
      </label>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-[10px] font-bold text-slate-400">
          Width (squares)
          <input
            type="number"
            min={4}
            max={100}
            value={draftWidth}
            onChange={(event) => props.onWidth(Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 outline-none focus:border-cyan-400/60"
          />
        </label>
        <label className="text-[10px] font-bold text-slate-400">
          Height (squares)
          <input
            type="number"
            min={4}
            max={100}
            value={draftHeight}
            onChange={(event) => props.onHeight(Number(event.target.value))}
            className="mt-1 h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-slate-100 outline-none focus:border-cyan-400/60"
          />
        </label>
      </div>

      <label className="mt-3 block text-[10px] font-bold text-slate-400">
        Map opacity · {draftMapOpacity}%
        <input type="range" min={0} max={100} value={draftMapOpacity} onChange={(event) => props.onMapOpacity(Number(event.target.value))} className="mt-1 w-full accent-emerald-400" />
      </label>
      <label className="mt-2 block text-[10px] font-bold text-slate-400">
        Grid opacity · {draftGridOpacity}%
        <input type="range" min={0} max={100} value={draftGridOpacity} onChange={(event) => props.onGridOpacity(Number(event.target.value))} className="mt-1 w-full accent-cyan-400" />
      </label>
      <label className="mt-2 flex items-center gap-2 text-[10px] font-bold text-slate-300">
        <input type="checkbox" checked={draftShowGrid} onChange={(event) => props.onShowGrid(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
        Show VTT grid
      </label>

      <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-200">Grid calibration</p>
          <button
            type="button"
            onClick={() => { props.onMapScale(1); props.onMapOffsetX(0); props.onMapOffsetZ(0); }}
            className="rounded-lg border border-slate-700 px-2 py-1 text-[8px] font-bold text-slate-400"
          >
            Reset
          </button>
        </div>
        <p className="mt-1 text-[9px] leading-4 text-slate-500">
          Align a baked-in map grid without changing the VTT coordinate system or token positions.
        </p>
        <label className="mt-2 block text-[9px] font-bold text-slate-400">
          Map scale · {Number(draftMapScale).toFixed(3)}×
          <input type="range" min={0.5} max={1.5} step={0.005} value={draftMapScale} onChange={(event) => props.onMapScale(Number(event.target.value))} className="mt-1 w-full accent-amber-300" />
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <label className="text-[9px] font-bold text-slate-400">
            X offset
            <input type="number" step={0.05} value={draftMapOffsetX} onChange={(event) => props.onMapOffsetX(Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-100" />
          </label>
          <label className="text-[9px] font-bold text-slate-400">
            Y offset
            <input type="number" step={0.05} value={draftMapOffsetZ} onChange={(event) => props.onMapOffsetZ(Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-100" />
          </label>
        </div>
      </div>

      <input
        ref={mapInputRef}
        type="file"
        accept=".webp,.png,.jpg,.jpeg,image/webp,image/png,image/jpeg"
        onChange={(event) => props.onMapFile(event.target.files?.[0] ?? null)}
        className="mt-3 block w-full text-[10px] text-slate-400 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-[10px] file:font-bold file:text-slate-200"
      />
      {mapFile ? <p className="mt-1 truncate text-[9px] text-emerald-300">Ready: {mapFile.name} · {(mapFile.size / 1024 / 1024).toFixed(1)} MB</p> : null}
      {scene.map_original_name ? <p className="mt-1 truncate text-[9px] text-slate-500">Current: {scene.map_original_name}</p> : <p className="mt-1 text-[9px] text-slate-600">Current: plain grid</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={props.onSave} className="min-h-10 rounded-xl border border-cyan-400/25 px-3 text-[10px] font-black text-cyan-100 disabled:opacity-40">
          Save settings
        </button>
        <button type="button" disabled={busy || !mapFile} onClick={props.onUpload} className="min-h-10 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 text-[10px] font-black text-emerald-100 disabled:opacity-40">
          Upload & apply
        </button>
      </div>
      {scene.map_storage_path ? (
        <button type="button" disabled={busy} onClick={props.onRemoveMap} className="mt-2 min-h-9 w-full rounded-xl border border-rose-400/20 px-3 text-[9px] font-bold text-rose-200 disabled:opacity-40">
          Remove current map
        </button>
      ) : null}
    </section>
  );
}
