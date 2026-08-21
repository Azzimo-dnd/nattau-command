"use client";

import { useEffect, useRef, useState } from "react";
import { VttCanvas, type VttToolMode } from "./VttGridAlignedCanvas";
import { VttSceneManager } from "./VttSceneManager";
import { VttSceneSettings } from "./VttSceneSettings";
import { VttSelectionPanel } from "./VttSelectionPanel";
import { useVttBoard } from "./useVttBoard";

type Props = {
  campaignId: string;
  isDm: boolean;
};

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT" || element.isContentEditable;
}

export function VttBattleBoard({ campaignId, isDm }: Props) {
  const board = useVttBoard(campaignId, isDm);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === boardRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isDm || board.selectedTokens.length !== 1 || board.playerPreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "q") {
        event.preventDefault();
        void board.rotateSelected(-Math.PI / 4);
      } else if (key === "e") {
        event.preventDefault();
        void board.rotateSelected(Math.PI / 4);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [board.playerPreview, board.rotateSelected, board.selectedTokens.length, isDm]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === boardRef.current) await document.exitFullscreen();
    else if (boardRef.current?.requestFullscreen) await boardRef.current.requestFullscreen();
  };

  if (board.loading) {
    return <div className="h-[72vh] min-h-[620px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/50" />;
  }

  if (!board.scene || !board.canvasScene) {
    return (
      <div className="rounded-[30px] border border-slate-800 bg-slate-900/65 p-10 text-center">
        <h2 className="text-2xl font-black text-slate-100">No active VTT scene yet</h2>
        <p className="mt-3 text-sm text-slate-500">The Game Master needs to initialize the tabletop first.</p>
        {board.error ? <p className="mt-4 text-xs text-rose-300">{board.error}</p> : null}
      </div>
    );
  }

  const scene = board.scene;

  return (
    <div
      ref={boardRef}
      className={isFullscreen ? "flex h-screen w-screen flex-col gap-2 overflow-hidden bg-[#05080d] p-2 text-slate-100" : "space-y-4"}
    >
      <section className={`flex shrink-0 flex-col gap-3 border border-slate-800 bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between ${isFullscreen ? "rounded-2xl px-4 py-2" : "rounded-[26px] p-4"}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">{scene.is_active ? "Live scene" : "Prepared scene"}</p>
            {!scene.is_active ? <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-violet-200">GM only</span> : null}
            {board.playerPreview ? <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">Player preview</span> : null}
          </div>
          <h2 className={`${isFullscreen ? "text-lg" : "mt-1 text-xl"} font-black text-slate-100`}>{scene.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{scene.grid_width} × {scene.grid_height} squares · {scene.feet_per_square} ft · {scene.map_original_name ?? "plain grid"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDm ? (
            <button
              type="button"
              onClick={() => { board.setPlayerPreview(!board.playerPreview); board.selectToken(null, false); }}
              className={`min-h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.12em] ${board.playerPreview ? "border-emerald-300 bg-emerald-300/15 text-emerald-100" : "border-emerald-400/25 bg-emerald-400/5 text-emerald-200"}`}
            >
              {board.playerPreview ? "Exit player view" : "Player preview"}
            </button>
          ) : null}
          <button type="button" onClick={() => void toggleFullscreen()} className="min-h-9 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300/60">
            {isFullscreen ? "Exit fullscreen" : "Fullscreen table"}
          </button>
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${isDm ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-200" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"}`}>
            {isDm ? "GM control" : "Player spectator"}
          </span>
        </div>
      </section>

      <div className={`${isFullscreen ? "grid min-h-0 flex-1 gap-2" : "grid gap-4"} ${isDm ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className={`relative overflow-hidden border border-slate-800 bg-[#070b11] ${isFullscreen ? "min-h-0 rounded-2xl" : "rounded-[30px]"}`}>
          <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-950/88 p-1.5 shadow-2xl backdrop-blur">
            {(["navigate", "ruler", "radius", "ping"] as VttToolMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => board.selectToolMode(mode)}
                className={`min-h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.1em] ${board.toolMode === mode ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200"}`}
              >
                {mode === "navigate" ? "Navigate" : mode === "ruler" ? "Ruler" : mode === "radius" ? "Spell radius" : "Ping"}
              </button>
            ))}
            {board.measurement ? (
              <span className={`rounded-xl border px-3 py-2 text-[11px] font-black ${board.toolMode === "radius" ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"}`}>
                {board.toolMode === "radius" ? "Radius " : "Distance "}{board.measurement.feet.toFixed(board.measurement.feet >= 100 ? 0 : 1)} ft · {board.measurement.squares.toFixed(1)} sq
              </span>
            ) : null}
            {(board.toolMode === "ruler" || board.toolMode === "radius") && board.measureStart ? (
              <button type="button" onClick={() => { board.setMeasureStart(null); board.setMeasureEnd(null); }} className="min-h-9 rounded-xl border border-slate-800 px-3 text-[10px] font-bold text-slate-400">Clear</button>
            ) : null}
          </div>

          <div className={isFullscreen ? "h-full min-h-0" : "h-[72dvh] min-h-[560px] max-h-[920px]"}>
            <VttCanvas
              key={`${scene.id}:${scene.grid_width}:${scene.grid_height}`}
              scene={board.canvasScene}
              tokens={board.tokens}
              isDm={isDm && !board.playerPreview}
              selectedIds={board.playerPreview ? [] : board.selectedIds}
              supabase={board.supabase}
              toolMode={board.toolMode}
              measureStart={board.measureStart}
              measureEnd={board.measureEnd}
              ping={board.ping}
              onSelect={board.selectToken}
              onLocalMove={board.localMove}
              onCommitMove={(id, x, z) => { void board.commitMove(id, x, z); }}
              onMeasureStart={(point) => { board.setMeasureStart(point); board.setMeasureEnd(point); }}
              onMeasureMove={board.setMeasureEnd}
              onMeasureEnd={board.setMeasureEnd}
              onPing={board.sendPing}
            />
          </div>

          {!isFullscreen ? (
            <div className="border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500">
              {board.playerPreview
                ? "Player Preview hides GM-only tokens and disables GM manipulation. Real players remain protected by server RLS."
                : isDm
                  ? "GM: click to select; Shift/Ctrl-click adds to selection. Drag one token to move it. Q/E rotate a single selection."
                  : "Spectator: orbit, pan, zoom, measure and ping. World state remains GM-controlled."
              }
            </div>
          ) : null}
        </div>

        {isDm ? (
          <aside className={`${isFullscreen ? "min-h-0 overflow-y-auto rounded-2xl pr-1" : "space-y-4"} space-y-4`}>
            <VttSceneManager
              scenes={board.scenes}
              workspaceSceneId={scene.id}
              busy={board.busy}
              onCreate={() => void board.createScene()}
              onOpen={(next) => void board.openScene(next)}
              onActivate={(next) => void board.activateScene(next)}
              onDelete={(next) => void board.deleteScene(next)}
            />

            <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">GM setup</p>
              <button type="button" disabled={board.busy} onClick={() => void board.placeParty()} className="mt-3 min-h-11 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 text-xs font-black text-cyan-100 disabled:opacity-40">Place / refresh party</button>
              <p className="mt-2 text-[10px] leading-4 text-slate-600">Uses each player&apos;s current miniature. Party tokens remain unique inside each scene.</p>
            </section>

            <VttSceneSettings
              scene={scene}
              busy={board.busy}
              mapInputRef={board.mapInputRef}
              mapFile={board.mapFile}
              draftName={board.draftName}
              draftWidth={board.draftWidth}
              draftHeight={board.draftHeight}
              draftMapOpacity={board.draftMapOpacity}
              draftGridOpacity={board.draftGridOpacity}
              draftShowGrid={board.draftShowGrid}
              draftMapScale={board.draftMapScale}
              draftMapOffsetX={board.draftMapOffsetX}
              draftMapOffsetZ={board.draftMapOffsetZ}
              onMapFile={board.setMapFile}
              onName={board.setDraftName}
              onWidth={board.setDraftWidth}
              onHeight={board.setDraftHeight}
              onMapOpacity={board.setDraftMapOpacity}
              onGridOpacity={board.setDraftGridOpacity}
              onShowGrid={board.setDraftShowGrid}
              onMapScale={board.setDraftMapScale}
              onMapOffsetX={board.setDraftMapOffsetX}
              onMapOffsetZ={board.setDraftMapOffsetZ}
              onSave={() => void board.saveScenePresentation()}
              onUpload={() => void board.uploadSceneMap()}
              onRemoveMap={() => void board.removeSceneMap()}
            />

            <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">Enemy library</p>
                <span className="text-[10px] font-bold text-slate-600">{board.enemyModels.length}</span>
              </div>
              {board.enemyModels.length === 0 ? <p className="mt-3 text-xs leading-5 text-slate-500">No enemy STLs yet. Add them in the GM Enemy Studio.</p> : (
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
                  {board.enemyModels.map((enemy) => (
                    <button key={enemy.id} type="button" disabled={board.busy} onClick={() => void board.spawnEnemy(enemy)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 text-left text-xs font-bold text-slate-200 hover:border-rose-400/30 disabled:opacity-40">
                      <span className="truncate">{enemy.name}</span><span className="shrink-0 text-[9px] uppercase text-rose-300">Spawn hidden</span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <VttSelectionPanel
              selectedTokens={board.selectedTokens}
              busy={board.busy}
              rotationDegrees={board.rotationDegrees}
              onRotateLeft={() => void board.rotateSelected(-Math.PI / 4)}
              onRotateReset={() => void board.rotateSelected(0, true)}
              onRotateRight={() => void board.rotateSelected(Math.PI / 4)}
              onResize={(size) => void board.bulkUpdate({ size_squares: size }, `${board.selectedIds.length} token${board.selectedIds.length === 1 ? "" : "s"} resized.`)}
              onReveal={() => void board.bulkUpdate({ visible_to_players: true }, "Selected tokens revealed.")}
              onHide={() => void board.bulkUpdate({ visible_to_players: false }, "Selected tokens hidden from players.")}
              onDuplicate={() => void board.duplicateSelected()}
              onRemove={() => void board.removeSelected()}
            />
          </aside>
        ) : null}
      </div>

      {!isFullscreen && board.message ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">{board.message}</p> : null}
      {!isFullscreen && board.error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{board.error}</p> : null}
      {isFullscreen && (board.message || board.error) ? (
        <div className={`pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-xl border px-4 py-2 text-xs shadow-2xl ${board.error ? "border-rose-500/30 bg-rose-950/90 text-rose-100" : "border-emerald-500/25 bg-emerald-950/90 text-emerald-100"}`}>
          {board.error ?? board.message}
        </div>
      ) : null}
    </div>
  );
}
