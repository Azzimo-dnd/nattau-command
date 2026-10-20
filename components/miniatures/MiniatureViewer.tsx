"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { disposeMiniatureScene, loadMiniatureAsset, type MiniatureAsset } from "./miniatureAsset";
import { MiniatureObject } from "./MiniatureObject";
import { scaleToReferenceHeight, validVisualScale } from "./miniatureGlb";
import { useMiniatureReference } from "./useMiniatureReference";

export type MiniatureModelInfo = {
  name: string; sizeBytes: number; triangles: number; width: number; depth: number; height: number;
  format: "stl" | "glb"; visualScale: number;
};
type LoadedModel = { asset: MiniatureAsset; info: MiniatureModelInfo; file: File };
type Props = {
  sourceFile?: File | null;
  allowFilePicker?: boolean;
  disabled?: boolean;
  campaignId?: string;
  visualScale?: number;
  onVisualScaleChange?: (scale: number) => void;
  onLocalFileLoaded?: (file: File, info: MiniatureModelInfo) => void;
  onLocalFileCleared?: () => void;
  emptyTitle?: string;
  emptyCopy?: string;
};

function CameraRig({ height, width, depth, resetKey }: { height: number; width: number; depth: number; resetKey: number }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const next = new OrbitControls(camera, gl.domElement);
    next.enableDamping = true;
    next.minDistance = 0.3;
    next.maxDistance = 80;
    controls.current = next;
    let frame = 0;
    const tick = () => { next.update(); frame = requestAnimationFrame(tick); };
    tick();
    return () => { cancelAnimationFrame(frame); next.dispose(); controls.current = null; };
  }, [camera, gl]);
  useEffect(() => {
    const target = new THREE.Vector3(0, height / 2, 0);
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = Math.min(THREE.MathUtils.degToRad(perspective.fov), 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2) * perspective.aspect));
    const distance = Math.max(3, Math.hypot(width, height, depth) / (2 * Math.sin(fov / 2))) * 1.15;
    if (controls.current) controls.current.maxDistance = Math.max(80, distance * 3);
    camera.position.copy(target).add(new THREE.Vector3(0.3, 0.22, 1).normalize().multiplyScalar(distance));
    controls.current?.target.copy(target);
    controls.current?.update();
    // Scaling must stay visible: changing the slider must not refit the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, resetKey]);
  return null;
}

export function MiniatureViewer({ sourceFile, allowFilePicker = true, disabled = false, campaignId, visualScale, onVisualScaleChange, onLocalFileLoaded, onLocalFileCleared, emptyTitle = "Choose a miniature", emptyCopy = "Drop an STL or a GLB with embedded textures here. Maximum 50 MB." }: Props = {}) {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const modelRef = useRef<LoadedModel | null>(null);
  const [referenceModel, setReferenceModel] = useState<{ file: File; asset: MiniatureAsset } | null>(null);
  const reference = useMiniatureReference(campaignId);
  const referenceAsset = referenceModel?.file === reference.file ? referenceModel.asset : null;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [scaleDraft, setScaleDraft] = useState("100");
  const [draftScale, setDraftScale] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadRequest = useRef(0);
  const replace = useCallback((next: LoadedModel | null) => {
    if (modelRef.current !== next) {
      if (modelRef.current) disposeMiniatureScene(modelRef.current.asset.scene);
      modelRef.current = next;
      setModel(next);
    }
  }, []);
  const load = useCallback(async (file: File, notify: boolean) => {
    const request = ++loadRequest.current;
    setLoading(true); setError(null);
    try {
      const asset = await loadMiniatureAsset(file);
      if (request !== loadRequest.current) { disposeMiniatureScene(asset.scene); return; }
      // STL uses millimetres; glTF declares metres. Rendering uses scale-independent grid units.
      const mm = asset.format === "glb" && asset.originalMaterials ? 1000 : 1;
      const info: MiniatureModelInfo = { name: file.name, sizeBytes: file.size, triangles: asset.triangles, width: asset.width * mm, depth: asset.depth * mm, height: asset.height * mm, format: asset.format, visualScale: asset.visualScale };
      replace({ file, asset, info });
      setResetKey((key) => key + 1);
      if (notify) onLocalFileLoaded?.(file, info);
    } catch (cause) {
      if (request === loadRequest.current) { replace(null); setError(cause instanceof Error ? cause.message : "Could not load this model."); }
    } finally { if (request === loadRequest.current) setLoading(false); }
  }, [onLocalFileLoaded, replace]);
  useEffect(() => {
    if (sourceFile === undefined || sourceFile === modelRef.current?.file) return;
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      if (!sourceFile) { loadRequest.current++; replace(null); setLoading(false); return; }
      void load(sourceFile, false);
    });
    return () => { alive = false; };
  }, [sourceFile, load, replace]);
  useEffect(() => () => { loadRequest.current++; if (modelRef.current) { disposeMiniatureScene(modelRef.current.asset.scene); modelRef.current = null; } }, []);
  useEffect(() => {
    let alive = true;
    let owned: MiniatureAsset | null = null;
    if (reference.file) void loadMiniatureAsset(reference.file).then((asset) => {
      if (!alive) { disposeMiniatureScene(asset.scene); return; }
      owned = asset; setReferenceModel({ file: reference.file!, asset }); setResetKey((key) => key + 1);
    }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not preview the reference."); });
    return () => { alive = false; if (owned) disposeMiniatureScene(owned.scene); };
  }, [reference.file]);

  const pick = (file: File) => { if (disabled) return; onLocalFileCleared?.(); void load(file, true); };
  const scale = visualScale ?? model?.asset.visualScale ?? 1;
  if (draftScale !== scale) {
    setDraftScale(scale);
    setScaleDraft(String(Math.round(scale * 100)));
  }
  const height = model ? model.asset.height * model.asset.baseScale * scale : 1;
  const width = model ? model.asset.width * model.asset.baseScale * scale : 1;
  const depth = model ? model.asset.depth * model.asset.baseScale * scale : 1;
  const referenceWidth = referenceAsset ? referenceAsset.width * referenceAsset.baseScale * referenceAsset.visualScale : 0;
  const separation = referenceAsset ? (width + referenceWidth) / 2 + 0.35 : 0;
  const referenceHeight = referenceAsset ? referenceAsset.height * referenceAsset.baseScale * referenceAsset.visualScale : null;
  const matchScale = model && referenceHeight ? scaleToReferenceHeight(model.asset.height * model.asset.baseScale, referenceHeight) : null;
  const changeScale = (next: number) => { if (validVisualScale(next)) onVisualScaleChange?.(next); };
  const button = "min-h-10 rounded-xl border border-cyan-400/25 px-3 text-xs font-bold text-cyan-100 disabled:opacity-35";

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
    <div className="overflow-hidden rounded-[26px] border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-100">{model?.info.name ?? "Miniature preview"}</p><p className="text-[11px] text-slate-400">{model?.asset.originalMaterials ? "Original materials & textures" : "Miniature"} · 1 grid square = 1 token base</p></div>
        <button type="button" className={button} onClick={() => setResetKey((key) => key + 1)}>Fit view</button>
      </div>
      <div className={`relative h-[420px] sm:h-[560px] ${dragging ? "ring-2 ring-inset ring-cyan-300" : ""}`} onDragOver={(event) => { if (allowFilePicker && !disabled) { event.preventDefault(); setDragging(true); } }} onDragLeave={() => setDragging(false)} onDrop={(event) => { if (!allowFilePicker || disabled) return; event.preventDefault(); setDragging(false); if (event.dataTransfer.files[0]) pick(event.dataTransfer.files[0]); }}>
        {model ? <Canvas shadows dpr={[1, 1.5]} camera={{ position: [2, 2, 5], fov: 38, near: 0.01, far: 300 }}>
          <color attach="background" args={["#0a0f16"]} /><ambientLight intensity={1.4} /><hemisphereLight args={["#e3ecff", "#453b32", 1.2]} /><directionalLight position={[4, 8, 5]} intensity={2.2} castShadow /><directionalLight position={[-3, 4, -2]} intensity={1} />
          <group position={[-separation / 2, 0, 0]}><MiniatureObject asset={model.asset} scale={model.asset.baseScale * scale} /></group>
          {referenceAsset ? <group position={[separation / 2, 0, 0]}><MiniatureObject asset={referenceAsset} scale={referenceAsset.baseScale * referenceAsset.visualScale} /></group> : null}
          <gridHelper args={[12, 12, "#657083", "#283343"]} position={[0, -0.005, 0]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow><planeGeometry args={[80, 80]} /><meshStandardMaterial color="#111820" roughness={1} /></mesh>
          <CameraRig height={Math.max(height, referenceHeight ?? 0)} width={Math.max(2, separation + Math.max(width, referenceWidth))} depth={Math.max(depth, referenceAsset ? referenceAsset.depth * referenceAsset.baseScale * referenceAsset.visualScale : 0)} resetKey={resetKey} />
        </Canvas> : <button type="button" disabled={!allowFilePicker || disabled || loading} onClick={() => inputRef.current?.click()} className="absolute inset-0 flex w-full flex-col items-center justify-center gap-4 px-8 text-center"><span className="text-2xl font-black text-slate-200">{emptyTitle}</span><span className="max-w-md text-sm text-slate-400">{emptyCopy}</span></button>}
        {loading ? <p role="status" className="absolute inset-x-4 top-4 rounded-xl bg-slate-950/95 p-3 text-center text-sm text-cyan-200">Loading miniature…</p> : null}
        {model ? <div className="pointer-events-none absolute inset-x-3 bottom-3 rounded-xl bg-slate-950/85 p-2 text-center text-xs text-slate-300">{referenceAsset ? `Left: imported model · Right: ${reference.name}` : "Drag to orbit · wheel / pinch to zoom"}</div> : null}
      </div>
    </div>
    <aside className="space-y-4">
      {allowFilePicker ? <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="font-bold text-slate-100">Import miniature</h3><p className="mt-2 text-xs leading-5 text-slate-400">GLB keeps embedded textures and all model parts. STL remains available for printable models.</p>
        <input aria-label="Miniature file" ref={inputRef} type="file" accept=".stl,.glb,model/gltf-binary,model/stl" className="hidden" disabled={disabled} onChange={(event) => { if (event.target.files?.[0]) pick(event.target.files[0]); event.currentTarget.value = ""; }} />
        <button type="button" disabled={disabled || loading} onClick={() => inputRef.current?.click()} className={`${button} mt-3 w-full`}>Choose STL / GLB</button><p className="mt-2 text-[11px] text-slate-500">Up to 50 MB · Embedded PNG/JPEG textures · No Draco/KTX2 compression</p>
      </section> : null}
      {onVisualScaleChange && model ? <section className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
        <label className="text-sm font-bold text-cyan-100">Default visual scale
          <input aria-label="Default visual scale slider" type="range" min={10} max={1000} step={1} value={Math.round(scale * 100)} disabled={disabled} onChange={(event) => changeScale(Number(event.target.value) / 100)} className="mt-3 w-full accent-cyan-300" />
        </label>
        <div className="mt-2 flex items-center gap-2"><input aria-label="Default visual scale percent" type="number" min={10} max={1000} step={1} value={scaleDraft} disabled={disabled} onChange={(event) => { setScaleDraft(event.target.value); changeScale(Number(event.target.value) / 100); }} onBlur={() => setScaleDraft(String(Math.round(scale * 100)))} className="min-h-10 w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm" /><span className="text-sm text-slate-400">%</span><button type="button" className={button} disabled={disabled} onClick={() => changeScale(1)}>Reset</button></div>
        <p className="mt-3 text-xs leading-5 text-slate-400">Saved with the upload. Height: {height.toFixed(2)} grid units. The token footprint stays unchanged.</p>
        {referenceHeight ? <><button type="button" className={`${button} mt-3 w-full`} disabled={disabled || !matchScale} onClick={() => matchScale && changeScale(matchScale)}>Match {reference.name}&apos;s height</button><p className="mt-2 text-[11px] leading-4 text-slate-500">Matches total height, including weapons and the base. Fine-tune for different poses.</p></> : null}
      </section> : null}
      {campaignId ? <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <label className="block text-xs font-bold text-slate-300">Reference campaign<select aria-label="Reference campaign" value={reference.referenceCampaign} onChange={(event) => reference.setReferenceCampaign(event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2">{reference.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
        <label className="mt-3 block text-xs font-bold text-slate-300">Compare with<select aria-label="Reference miniature" value={reference.referenceId} onChange={(event) => reference.setReferenceId(event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-2"><option value="">No reference</option>{reference.references.map((row) => <option key={row.player_id} value={row.player_id}>{row.display_name}</option>)}</select></label>
        <p className="mt-2 text-[11px] leading-5 text-slate-400">{reference.loading ? "Loading reference…" : reference.references.length ? "Pippo is selected first when available. Reference uses its saved default scale." : "No miniatures here yet. Choose another accessible campaign."}</p>{reference.error ? <p role="alert" className="mt-2 text-xs text-rose-300">{reference.error}</p> : null}
      </section> : null}
      {model ? <p className="rounded-xl border border-slate-800 p-3 text-xs leading-5 text-slate-400">{model.asset.meshCount} model part(s) · {model.info.triangles.toLocaleString()} triangles · {(model.info.sizeBytes / 1024 / 1024).toFixed(1)} MB</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">{error}</p> : null}
    </aside>
  </div>;
}
