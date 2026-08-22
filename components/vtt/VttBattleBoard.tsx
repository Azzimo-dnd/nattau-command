"use client";

import { useEffect, useRef, useState } from "react";
import { VttCanvas, type VttToolMode } from "./VttGridAlignedCanvas";
import type { VttAssetProgress, VttCameraCommand } from "./VttCanvas";
import { VttDiceBar } from "./VttDiceBar";
import { VttDiceHistoryPanel } from "./VttDiceHistoryPanel";
import { VttInitiativePanel } from "./VttInitiativePanel";
import { VttInitiativeStrip } from "./VttInitiativeStrip";
import { VttSceneManager } from "./VttSceneManager";
import { VttSceneSettings } from "./VttSceneSettings";
import { VttSelectionPanel } from "./VttSelectionPanel";
import { useVttBoard } from "./useVttBoard";
import { useVttDice } from "./useVttDice";
import { useVttPresence } from "./useVttPresence";

type Props = { campaignId: string; isDm: boolean; currentUserId: string; currentUserName: string };

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.tagName === "SELECT" || element.isContentEditable;
}

export function VttBattleBoard({ campaignId, isDm, currentUserId, currentUserName }: Props) {
  const board = useVttBoard(campaignId, isDm);
  const dice = useVttDice({ campaignId, currentUserId, currentUserName, sceneId: board.scene?.id ?? null });
  const presence = useVttPresence({ campaignId, currentUserId, currentUserName, isDm });
  const boardRef = useRef<HTMLDivElement | null>(null);
  const cameraCommandId = useRef(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<VttCameraCommand | null>(null);
  const [assetProgress, setAssetProgress] = useState<VttAssetProgress>({ loaded: 0, failed: 0, total: 0 });

  const commandCamera = (type: VttCameraCommand["type"], x?: number, z?: number) => {
    cameraCommandId.current += 1;
    setCameraCommand({ id: cameraCommandId.current, type, x, z });
  };

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(document.fullscreenElement === boardRef.current);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => { setHistoryOpen(false); setAssetProgress({ loaded: 0, failed: 0, total: 0 }); }, [board.scene?.id]);

  useEffect(() => {
    if (!isDm || board.playerPreview || dice.activeRoll) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (board.selectedTokens.length === 1 && key === "q") { event.preventDefault(); void board.rotateSelected(-Math.PI / 4); }
      else if (board.selectedTokens.length === 1 && key === "e") { event.preventDefault(); void board.rotateSelected(Math.PI / 4); }
      else if ((event.key === "Delete" || event.key === "Backspace") && board.selectedIds.length > 0) { event.preventDefault(); void board.removeSelected(); }
      else if ((event.ctrlKey || event.metaKey) && key === "d" && board.selectedIds.length > 0) { event.preventDefault(); void board.duplicateSelected(); }
      else if (key === "h" && board.selectedTokens.length > 0) {
        event.preventDefault();
        const allVisible = board.selectedTokens.every((token) => token.visible_to_players);
        void board.bulkUpdate({ visible_to_players: !allVisible }, allVisible ? "Selected tokens hidden from players." : "Selected tokens revealed.");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [board, dice.activeRoll, isDm]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === boardRef.current) await document.exitFullscreen();
    else if (boardRef.current?.requestFullscreen) await boardRef.current.requestFullscreen();
  };

  if (board.loading) return <div className="h-[72vh] min-h-[620px] animate-pulse rounded-[30px] border border-slate-800 bg-slate-900/50" />;

  if (!board.scene || !board.canvasScene) {
    if (!isDm) {
      return (
        <div className="overflow-hidden rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_center,#152338_0%,#0b111b_55%,#070b11_100%)] p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/5 text-2xl">✦</div>
          <h2 className="mt-5 text-2xl font-black text-slate-100">The tabletop is behind the GM screen</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500">The Game Master is preparing or hiding the current scene. Keep this page open — the table will appear automatically when it is revealed.</p>
          {board.error ? <p className="mt-4 text-xs text-rose-300">{board.error}</p> : null}
        </div>
      );
    }
    return <div className="rounded-[30px] border border-slate-800 bg-slate-900/65 p-10 text-center"><h2 className="text-2xl font-black text-slate-100">No VTT scene yet</h2><p className="mt-3 text-sm text-slate-500">Create a prepared scene to initialize the tabletop.</p>{board.error ? <p className="mt-4 text-xs text-rose-300">{board.error}</p> : null}</div>;
  }

  const scene = board.scene;
  const settledAssets = assetProgress.loaded + assetProgress.failed;
  const assetsLoading = assetProgress.total > 0 && settledAssets < assetProgress.total;
  const selectedForFocus = board.selectedTokens.length === 1 ? board.selectedTokens[0] : null;

  return (
    <div ref={boardRef} className={isFullscreen ? "flex h-screen w-screen flex-col gap-2 overflow-hidden bg-[#05080d] p-2 text-slate-100" : "space-y-4"}>
      <section className={`flex shrink-0 flex-col gap-3 border border-slate-800 bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between ${isFullscreen ? "rounded-2xl px-4 py-2" : "rounded-[26px] p-4"}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">{scene.is_active ? "Live scene" : "Prepared scene"}</p>
            {!scene.is_active ? <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-violet-200">GM only</span> : null}
            {scene.is_active && !scene.visible_to_players && isDm ? <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-amber-200">Hidden from players</span> : null}
            {board.playerPreview ? <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200">Player preview</span> : null}
          </div>
          <h2 className={`${isFullscreen ? "text-lg" : "mt-1 text-xl"} font-black text-slate-100`}>{scene.name}</h2>
          <p className="mt-1 text-xs text-slate-500">{scene.grid_width} × {scene.grid_height} squares · {scene.feet_per_square} ft · {scene.map_original_name ?? "plain grid"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDm ? <span className="rounded-full border border-slate-700 bg-slate-950/50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-300">{presence.length} connected</span> : null}
          {isDm ? <button type="button" disabled={board.busy} onClick={() => void board.toggleNameplates()} className={`min-h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.12em] disabled:opacity-40 ${scene.show_nameplates ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-slate-700 bg-slate-950/50 text-slate-400"}`}>Names {scene.show_nameplates ? "on" : "off"}</button> : null}
          {isDm ? <button type="button" onClick={() => { board.setPlayerPreview(!board.playerPreview); board.selectToken(null, false); }} className={`min-h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.12em] ${board.playerPreview ? "border-emerald-300 bg-emerald-300/15 text-emerald-100" : "border-emerald-400/25 bg-emerald-400/5 text-emerald-200"}`}>{board.playerPreview ? "Exit player view" : "Player preview"}</button> : null}
          <button type="button" onClick={() => void toggleFullscreen()} className="min-h-9 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-100 hover:border-cyan-300/60">{isFullscreen ? "Exit fullscreen" : "Fullscreen table"}</button>
          <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${isDm ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-200" : "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"}`}>{isDm ? "GM control" : "Player spectator"}</span>
        </div>
      </section>

      <div className={`${isFullscreen ? "grid min-h-0 flex-1 gap-2" : "grid gap-4"} ${isDm ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className={`relative overflow-hidden border border-slate-800 bg-[#070b11] ${isFullscreen ? "min-h-0 rounded-2xl" : "rounded-[30px]"}`}>
          <div className="absolute left-3 top-3 z-20 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1.5 rounded-2xl border border-slate-700/80 bg-slate-950/88 p-1.5 shadow-2xl backdrop-blur">
            {(["navigate", "ruler", "radius", "ping"] as VttToolMode[]).map((mode) => <button key={mode} type="button" onClick={() => board.selectToolMode(mode)} disabled={Boolean(dice.activeRoll)} className={`min-h-9 rounded-xl border px-3 text-[10px] font-black uppercase tracking-[0.1em] disabled:opacity-35 ${board.toolMode === mode ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : "border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200"}`}>{mode === "navigate" ? "Navigate" : mode === "ruler" ? "Ruler" : mode === "radius" ? "Spell radius" : "Ping"}</button>)}
            <span className="mx-0.5 h-7 w-px bg-slate-800" />
            <button type="button" onClick={() => commandCamera("fit")} className="min-h-9 rounded-xl border border-slate-800 px-2.5 text-[9px] font-black text-slate-400 hover:text-slate-100">Fit</button>
            {isDm ? <button type="button" disabled={!selectedForFocus} onClick={() => selectedForFocus && commandCamera("focus", selectedForFocus.x, selectedForFocus.z)} className="min-h-9 rounded-xl border border-slate-800 px-2.5 text-[9px] font-black text-slate-400 hover:text-slate-100 disabled:opacity-30">Focus</button> : null}
            <button type="button" onClick={() => commandCamera("reset")} className="min-h-9 rounded-xl border border-slate-800 px-2.5 text-[9px] font-black text-slate-400 hover:text-slate-100">Reset</button>
            {board.measurement ? <span className={`rounded-xl border px-3 py-2 text-[11px] font-black ${board.toolMode === "radius" ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100" : "border-cyan-400/30 bg-cyan-400/10 text-cyan-100"}`}>{board.toolMode === "radius" ? "Radius " : "Distance "}{board.measurement.feet.toFixed(board.measurement.feet >= 100 ? 0 : 1)} ft · {board.measurement.squares.toFixed(1)} sq</span> : null}
            {(board.toolMode === "ruler" || board.toolMode === "radius") && board.measureStart ? <button type="button" onClick={() => { board.setMeasureStart(null); board.setMeasureEnd(null); }} className="min-h-9 rounded-xl border border-slate-800 px-3 text-[10px] font-bold text-slate-400">Clear</button> : null}
          </div>

          <VttInitiativeStrip scene={scene} tokens={board.tokens} />
          {assetsLoading ? <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-xl border border-cyan-400/20 bg-slate-950/90 px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-100 shadow-xl">Loading miniatures {settledAssets}/{assetProgress.total}</div> : null}
          {!assetsLoading && assetProgress.failed > 0 ? <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-xl border border-rose-400/20 bg-rose-950/85 px-3 py-2 text-[9px] font-black text-rose-100">{assetProgress.failed} miniature asset{assetProgress.failed === 1 ? "" : "s"} failed</div> : null}

          <div className={isFullscreen ? "h-full min-h-0" : "h-[72dvh] min-h-[560px] max-h-[920px]"}>
            <VttCanvas key={`${scene.id}:${scene.grid_width}:${scene.grid_height}`} scene={board.canvasScene} tokens={board.tokens} isDm={isDm && !board.playerPreview} selectedIds={board.playerPreview ? [] : board.selectedIds} supabase={board.supabase} toolMode={board.toolMode} measureStart={board.measureStart} measureEnd={board.measureEnd} ping={board.ping} diceRequest={dice.activeRoll?.request ?? null} cameraCommand={cameraCommand} onAssetProgress={setAssetProgress} onSelect={board.selectToken} onLocalMove={board.localMove} onCommitMove={(id, x, z) => { void board.commitMove(id, x, z); }} onMeasureStart={(point) => { board.setMeasureStart(point); board.setMeasureEnd(point); }} onMeasureMove={board.setMeasureEnd} onMeasureEnd={board.setMeasureEnd} onPing={board.sendPing} onDiceComplete={(result) => { void dice.handlePhysicsComplete(result); }} onDiceImpact={dice.handleImpact} />
          </div>

          <VttDiceHistoryPanel open={historyOpen} isFullscreen={isFullscreen} sceneName={scene.name} isDm={isDm} rolls={dice.historyRolls} loading={dice.historyLoading} clearing={dice.historyClearing} error={dice.historyError} onClose={() => setHistoryOpen(false)} onClear={() => { void dice.clearHistory(); }} />
          <VttDiceBar isFullscreen={isFullscreen} counts={dice.counts} modifier={dice.modifier} mode={dice.mode} expression={dice.expression} physicalCount={dice.physicalCount} maxPhysicalDice={dice.maxPhysicalDice} canUseD20Mode={dice.canUseD20Mode} canRoll={dice.canRoll} activeRoll={dice.activeRoll} latestResult={dice.latestResult} error={dice.error} appearanceName={dice.appearanceName} appearanceSwatch={dice.appearanceSwatch} historyCount={dice.historyRolls.length} historyOpen={historyOpen} onAddDie={dice.addDie} onRemoveDie={dice.removeDie} onModifier={dice.setModifier} onMode={dice.setMode} onClear={dice.clearDice} onHistory={() => setHistoryOpen((current) => !current)} onRoll={() => { void dice.roll(); }} />

          {!isFullscreen ? <div className="border-t border-slate-800 px-4 py-3 text-[11px] text-slate-500">{board.playerPreview ? "Player Preview hides GM-only tokens and mirrors the player initiative strip." : isDm ? "GM shortcuts: Q/E rotate · H hide/reveal · Ctrl/Cmd+D duplicate enemies · Delete removes selection." : "Spectator: orbit, pan, zoom, measure, ping and use the shared VTT dice bar."}</div> : null}
        </div>

        {isDm ? (
          <aside className={`${isFullscreen ? "min-h-0 overflow-y-auto rounded-2xl pr-1" : "space-y-4"} space-y-4`}>
            <VttSceneManager scenes={board.scenes} workspaceSceneId={scene.id} busy={board.busy} onCreate={() => void board.createScene()} onOpen={(next) => void board.openScene(next)} onActivate={(next) => void board.activateScene(next)} onVisibility={(next, visible) => void board.setScenePlayerVisibility(next, visible)} onDuplicate={(next) => void board.duplicateScene(next)} onDelete={(next) => void board.deleteScene(next)} />

            <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">At the table</p><span className="text-[10px] font-black text-slate-500">{presence.length}</span></div>
              <div className="mt-3 flex flex-wrap gap-1.5">{presence.map((member) => <span key={member.userId} className={`rounded-full border px-2.5 py-1 text-[9px] font-bold ${member.role === "dm" ? "border-yellow-400/20 bg-yellow-400/5 text-yellow-100" : "border-emerald-400/20 bg-emerald-400/5 text-emerald-100"}`}>{member.name}</span>)}</div>
            </section>

            <VttInitiativePanel scene={scene} tokens={board.allTokens} busy={board.busy} onInitiative={(tokenId, value) => void board.setTokenInitiative(tokenId, value)} onStart={() => void board.startInitiative()} onPrevious={() => void board.stepInitiative(-1)} onNext={() => void board.stepInitiative(1)} onStop={(clear) => void board.stopInitiative(clear)} />

            <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4"><p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">GM setup</p><button type="button" disabled={board.busy} onClick={() => void board.placeParty()} className="mt-3 min-h-11 w-full rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 text-xs font-black text-cyan-100 disabled:opacity-40">Place / refresh party</button><p className="mt-2 text-[10px] leading-4 text-slate-600">Uses each player&apos;s current miniature. Party tokens remain unique inside each scene.</p></section>

            <VttSceneSettings scene={scene} busy={board.busy} mapInputRef={board.mapInputRef} mapFile={board.mapFile} draftName={board.draftName} draftWidth={board.draftWidth} draftHeight={board.draftHeight} draftMapOpacity={board.draftMapOpacity} draftGridOpacity={board.draftGridOpacity} draftShowGrid={board.draftShowGrid} draftMapScale={board.draftMapScale} draftMapOffsetX={board.draftMapOffsetX} draftMapOffsetZ={board.draftMapOffsetZ} onMapFile={board.setMapFile} onName={board.setDraftName} onWidth={board.setDraftWidth} onHeight={board.setDraftHeight} onMapOpacity={board.setDraftMapOpacity} onGridOpacity={board.setDraftGridOpacity} onShowGrid={board.setDraftShowGrid} onMapScale={board.setDraftMapScale} onMapOffsetX={board.setDraftMapOffsetX} onMapOffsetZ={board.setDraftMapOffsetZ} onSave={() => void board.saveScenePresentation()} onUpload={() => void board.uploadSceneMap()} onRemoveMap={() => void board.removeSceneMap()} />

            <section className="rounded-[26px] border border-slate-800 bg-slate-900/70 p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.2em] text-rose-300">Enemy library</p><span className="text-[10px] font-bold text-slate-600">{board.enemyModels.length}</span></div>{board.enemyModels.length === 0 ? <p className="mt-3 text-xs leading-5 text-slate-500">No enemy STLs yet. Add them in the GM Enemy Studio.</p> : <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">{board.enemyModels.map((enemy) => <button key={enemy.id} type="button" disabled={board.busy} onClick={() => void board.spawnEnemy(enemy)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/50 px-3 text-left text-xs font-bold text-slate-200 hover:border-rose-400/30 disabled:opacity-40"><span className="truncate">{enemy.name}</span><span className="shrink-0 text-[9px] uppercase text-rose-300">Spawn hidden</span></button>)}</div>}</section>

            <VttSelectionPanel selectedTokens={board.selectedTokens} busy={board.busy} rotationDegrees={board.rotationDegrees} onRotateLeft={() => void board.rotateSelected(-Math.PI / 4)} onRotateReset={() => void board.rotateSelected(0, true)} onRotateRight={() => void board.rotateSelected(Math.PI / 4)} onRenameEnemy={(name) => void board.renameSelectedEnemy(name)} onInitiative={(value) => selectedForFocus && void board.setTokenInitiative(selectedForFocus.id, value)} onResize={(size) => void board.bulkUpdate({ size_squares: size }, `${board.selectedIds.length} token${board.selectedIds.length === 1 ? "" : "s"} resized.`)} onReveal={() => void board.bulkUpdate({ visible_to_players: true }, "Selected tokens revealed.")} onHide={() => void board.bulkUpdate({ visible_to_players: false }, "Selected tokens hidden from players.")} onDuplicate={() => void board.duplicateSelected()} onRemove={() => void board.removeSelected()} />
          </aside>
        ) : null}
      </div>

      {!isFullscreen && board.message ? <p className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">{board.message}</p> : null}
      {!isFullscreen && board.error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{board.error}</p> : null}
      {isFullscreen && (board.message || board.error) ? <div className={`pointer-events-none absolute bottom-32 left-1/2 z-30 -translate-x-1/2 rounded-xl border px-4 py-2 text-xs shadow-2xl ${board.error ? "border-rose-500/30 bg-rose-950/90 text-rose-100" : "border-emerald-500/25 bg-emerald-950/90 text-emerald-100"}`}>{board.error ?? board.message}</div> : null}
    </div>
  );
}
