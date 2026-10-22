"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useMiniatureReference } from "@/components/miniatures/useMiniatureReference";
import { MiniatureObject } from "@/components/miniatures/MiniatureObject";
import { disposeMiniatureScene, loadMiniatureAsset, type MiniatureAsset } from "@/components/miniatures/miniatureAsset";
import { createTerrainModel, disposeTerrainModel } from "@/lib/terrain/terrainGeometry";
import { readTerrainFile, terrainMetrics, type TerrainModelMetrics } from "@/lib/terrain/terrainModels";
import type { TerrainRecipe } from "@/lib/terrain/terrainTypes";

type View = "fit" | "front" | "side" | "top";
type ReferenceMode = "none" | "dummy" | "pippo";

function CameraController({ metrics, scale, view, tick }: { metrics: TerrainModelMetrics; scale: number; view: View; tick: number }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const next = new OrbitControls(camera, gl.domElement);
    next.enableDamping = true; next.maxPolarAngle = Math.PI * 0.97;
    next.minDistance = 0.5; next.maxDistance = 100;
    controls.current = next;
    let frame = 0;
    function animate() { next.update(); frame = requestAnimationFrame(animate); }
    animate();
    return () => { cancelAnimationFrame(frame); next.dispose(); controls.current = null; };
  }, [camera, gl]);
  useEffect(() => {
    const size = Math.max(metrics.width * scale, metrics.height * scale, metrics.depth * scale, 1.8);
    const cameraPerspective = camera as THREE.PerspectiveCamera;
    const verticalFov = THREE.MathUtils.degToRad(cameraPerspective.fov);
    const effectiveFov = Math.min(verticalFov, 2 * Math.atan(Math.tan(verticalFov / 2) * cameraPerspective.aspect));
    const distance = Math.max(3.5, size / (2 * Math.tan(effectiveFov / 2)) * 1.55);
    const target = new THREE.Vector3(0, Math.max(0.7, metrics.height * scale / 2), 0);
    const direction = view === "front" ? new THREE.Vector3(0,0,1) :
      view === "side" ? new THREE.Vector3(1,0,0) :
      view === "top" ? new THREE.Vector3(0.001,1,0) : new THREE.Vector3(1,0.72,1);
    camera.position.copy(target).add(direction.normalize().multiplyScalar(distance));
    camera.lookAt(target);
    controls.current?.target.copy(target);
    controls.current?.update();
  }, [camera, metrics, scale, tick, view]);
  return null;
}
function DummyReference() {
  return <group position={[1.5, 0, 0]}>
    <mesh position={[0, 0.86, 0]} castShadow><capsuleGeometry args={[0.22, 0.9, 4, 10]} /><meshStandardMaterial color="#9ca3af" roughness={0.85} /></mesh>
    <mesh position={[0, 1.65, 0]} castShadow><sphereGeometry args={[0.21, 16, 12]} /><meshStandardMaterial color="#c6a77c" roughness={0.85} /></mesh>
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.41,0.45,32]}/><meshBasicMaterial color="#9ca3af" side={THREE.DoubleSide}/></mesh>
  </group>;
}
function TerrainPrimitive({ model, scale }: { model: THREE.Object3D; scale: number }) {
  return <primitive object={model} scale={scale} dispose={null} />;
}
export function TerrainAssetViewer({ recipe, file, campaignId, scale, referenceMode, onMetrics }: {
  recipe: TerrainRecipe | null; file: File | null; campaignId: string; scale: number;
  referenceMode: ReferenceMode; onMetrics?: (metrics: TerrainModelMetrics | null) => void;
}) {
  const reference = useMiniatureReference(referenceMode === "pippo" ? campaignId : undefined);
  const [loaded, setLoaded] = useState<{ file: File; model: THREE.Group; metrics: TerrainModelMetrics } | null>(null);
  const [referenceAsset, setReferenceAsset] = useState<{ file: File; model: MiniatureAsset } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("fit");
  const [viewTick, setViewTick] = useState(0);
  const [showGrid, setShowGrid] = useState(true);
  const generatedResult = useMemo(() => {
    if (!recipe || file) return {model: null as THREE.Group | null, error: null as string | null};
    try { return { model: createTerrainModel(recipe), error: null as string | null }; }
    catch (cause) { return { model: null, error: cause instanceof Error ? cause.message : "Invalid generator parameters." }; }
  }, [file, recipe]);
  const generated = generatedResult.model;
  useEffect(() => () => { if (generated) disposeTerrainModel(generated); }, [generated]);
  useEffect(() => {
    let alive = true;
    if (!file) { setLoaded(null); setError(null); setLoading(false); return; }
    setLoading(true); setError(null); setLoaded(null);
    void readTerrainFile(file).then((result) => {
      if (!alive) { disposeTerrainModel(result.model); return; }
      setLoaded({ file, ...result });
    }).catch((cause) => { if (alive) setError(cause instanceof Error ? cause.message : "Could not render the GLB."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [file]);
  useEffect(() => () => { if (loaded) disposeTerrainModel(loaded.model); }, [loaded]);
  useEffect(() => {
    let alive = true;
    if (!reference.file || referenceMode !== "pippo") { setReferenceAsset(null); return; }
    void loadMiniatureAsset(reference.file).then((model) => {
      if (!alive) { disposeMiniatureScene(model.scene); return; }
      setReferenceAsset({ file: reference.file!, model });
    }).catch(() => { if (alive) setReferenceAsset(null); });
    return () => { alive = false; };
  }, [reference.file, referenceMode]);
  useEffect(() => () => { if (referenceAsset) disposeMiniatureScene(referenceAsset.model.scene); }, [referenceAsset]);
  const model = generated ?? (loaded?.file === file ? loaded.model : null);
  const metrics = useMemo(() => model ? terrainMetrics(model) : null, [model]);
  useEffect(() => { onMetrics?.(metrics); }, [metrics, onMetrics]);
  const actualReference = referenceMode === "pippo" && referenceAsset?.file === reference.file ? referenceAsset.model : null;
  const viewModel = (next: View) => { setView(next); setViewTick((value) => value + 1); };
  return <div className="space-y-3">
    <div className="relative h-[420px] min-h-[360px] overflow-hidden rounded-2xl border border-slate-700 bg-[#0a1019] sm:h-[530px]">
      {model && metrics ? <Canvas shadows dpr={[1,1.5]} camera={{ position: [4,3,6], fov: 42, near: 0.05, far: 150 }}
        fallback={<p className="p-8 text-slate-200">WebGL is required for the terrain preview.</p>}>
        <color attach="background" args={["#0b1420"]}/>
        <ambientLight intensity={1.6}/>
        <directionalLight intensity={2.3} position={[5,11,6]} castShadow shadow-mapSize={[1024,1024]}/>
        <directionalLight intensity={0.55} position={[-6,6,-5]}/>
        {showGrid ? <gridHelper args={[12,12,"#4a6174","#263547"]}/> : null}
        <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.037,0]} receiveShadow>
          <planeGeometry args={[16,16]}/><meshStandardMaterial color="#17212e" roughness={1}/>
        </mesh>
        <TerrainPrimitive model={model} scale={scale}/>
        {referenceMode === "dummy" || (referenceMode === "pippo" && !actualReference) ? <DummyReference/> : null}
        {actualReference && <group position={[Math.max(metrics.width * scale / 2 + 0.95,1.2),0,0]}>
          <MiniatureObject asset={actualReference} scale={actualReference.baseScale * actualReference.visualScale}/>
        </group>}
        <CameraController metrics={metrics} scale={scale} view={view} tick={viewTick}/>
      </Canvas> : <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-400">{loading ? "Loading 3D asset…" : generatedResult.error ?? error ?? "Select a UC preset or a saved terrain model."}</div>}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl bg-slate-950/85 px-3 py-2 text-[11px] text-slate-300">1 grid unit = 1 VTT square · drag to orbit · scroll to zoom</div>
    </div>
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    <div className="flex flex-wrap items-center gap-2">
      {(["fit","front","side","top"] as View[]).map((candidate) => <button key={candidate} type="button"
        className={view === candidate ? "rounded-lg border border-cyan-400 bg-cyan-500/15 px-3 py-2 text-xs text-cyan-100" : "rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300"}
        onClick={() => viewModel(candidate)}>{candidate === "fit" ? "Fit / Reset" : candidate[0].toUpperCase() + candidate.slice(1)}</button>)}
      <label className="ml-auto flex items-center gap-2 text-xs text-slate-300">
        <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)}/> Grid
      </label>
    </div>
    {referenceMode === "pippo" && reference.error && <p className="text-xs text-amber-300">{reference.error} · dummy shown instead</p>}
    {referenceMode === "pippo" && reference.loading && <p className="text-xs text-slate-400">Loading {reference.name} as a scale reference…</p>}
  </div>;
}
