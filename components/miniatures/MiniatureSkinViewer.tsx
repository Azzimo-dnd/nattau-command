"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  applyMiniaturePaintDocumentToGeometry,
  clearMiniaturePaintGeometry,
  type MiniaturePaintDocument,
} from "./miniaturePaintData";
import { loadMiniatureGeometry } from "./miniatureModelFiles";

type Model = {
  geometry: THREE.BufferGeometry;
  height: number;
  triangles: number;
  name: string;
  format: "stl" | "glb";
};

type Props = {
  sourceFile: File | null;
  paintDocument: MiniaturePaintDocument | null;
  skinName?: string | null;
};

function CameraRig({ height, resetKey, autoRotate }: { height: number; resetKey: number; autoRotate: boolean }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const next = new OrbitControls(camera, gl.domElement);
    next.enableDamping = true;
    next.dampingFactor = 0.06;
    next.enablePan = true;
    next.screenSpacePanning = true;
    next.zoomToCursor = true;
    next.minPolarAngle = 0.08;
    next.maxPolarAngle = Math.PI * 0.98;
    next.touches.ONE = THREE.TOUCH.ROTATE;
    next.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.current = next;
    let frame = 0;
    const tick = () => {
      next.autoRotate = autoRotate;
      next.autoRotateSpeed = 1.15;
      next.update();
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      next.dispose();
      controls.current = null;
    };
  }, [autoRotate, camera, gl]);

  useEffect(() => {
    const next = controls.current;
    if (!next) return;
    const distance = Math.max(52, height * 1.8);
    camera.position.set(distance * 0.75, Math.max(24, height * 0.72), distance * 0.92);
    camera.near = 0.1;
    camera.far = 2000;
    camera.updateProjectionMatrix();
    next.target.set(0, Math.max(8, height * 0.42), 0);
    next.minDistance = Math.max(10, height * 0.22);
    next.maxDistance = Math.max(140, height * 5.2);
    next.update();
  }, [camera, height, resetKey]);

  return null;
}

export function MiniatureSkinViewer({ sourceFile, paintDocument, skinName = null }: Props) {
  const [model, setModel] = useState<Model | null>(null);
  const modelRef = useRef<Model | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [paintApplied, setPaintApplied] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (modelRef.current) {
        modelRef.current.geometry.dispose();
        modelRef.current = null;
      }
      setModel(null);
      setError(null);
      if (!sourceFile) return;
      try {
        const loaded = await loadMiniatureGeometry(sourceFile);
        if (cancelled) {
          loaded.geometry.dispose();
          return;
        }
        const next = { ...loaded };
        modelRef.current = next;
        setModel(next);
        setResetKey((value) => value + 1);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not load this miniature file.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sourceFile]);

  useEffect(() => () => modelRef.current?.geometry.dispose(), []);

  useEffect(() => {
    if (!model) return;
    clearMiniaturePaintGeometry(model.geometry);
    if (!paintDocument) {
      setPaintApplied(false);
      return;
    }
    const applied = applyMiniaturePaintDocumentToGeometry(model.geometry, paintDocument);
    setPaintApplied(applied);
    if (!applied) setError("This skin belongs to a different miniature version.");
    else setError(null);
  }, [model, paintDocument]);

  return (
    <div className="overflow-hidden rounded-[30px] border border-slate-800 bg-[#080d13] shadow-2xl shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">Miniature viewport</p>
          <p className="mt-1 text-sm font-bold text-slate-200">{model?.name ?? "No miniature loaded"}</p>
          <p className="mt-1 text-[11px] text-slate-600">Skin: {skinName ?? "Original / unpainted"}{model?.format === "glb" ? " · Web GLB" : " · Source STL"}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setAutoRotate((value) => !value)} disabled={!model} className={`rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-30 ${autoRotate ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-slate-700 text-slate-400"}`}>{autoRotate ? "Stop turntable" : "Turntable"}</button>
          <button type="button" onClick={() => setResetKey((value) => value + 1)} disabled={!model} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400 disabled:opacity-30">Reset view</button>
        </div>
      </div>

      <div className="relative h-[58dvh] min-h-[390px] max-h-[820px] sm:min-h-[520px]" style={{ touchAction: "none" }}>
        {model ? (
          <Canvas shadows={!compact} dpr={compact ? 1 : [1, 1.7]} camera={{ fov: 32, position: [55, 34, 62] }} gl={{ antialias: true, alpha: false }}>
            <color attach="background" args={["#0a0f16"]} />
            {!compact ? <fog attach="fog" args={["#0a0f16", 95, 220]} /> : null}
            <ambientLight intensity={1.15} />
            <hemisphereLight args={["#d8e7ff", "#281d16", 1.35]} />
            <directionalLight castShadow={!compact} position={[40, 70, 35]} intensity={3.1} />
            {!compact ? <directionalLight position={[-35, 30, -25]} intensity={1.35} /> : null}
            <mesh castShadow={!compact} receiveShadow={!compact} geometry={model.geometry} rotation={[-Math.PI / 2, 0, 0]}>
              <meshStandardMaterial vertexColors={paintApplied} color={paintApplied ? "#ffffff" : "#8f949b"} roughness={0.68} metalness={0.08} />
            </mesh>
            <mesh receiveShadow={!compact} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}><circleGeometry args={[46, compact ? 48 : 96]} /><meshStandardMaterial color="#151b22" roughness={0.96} /></mesh>
            <gridHelper args={[140, 28, "#344253", "#17202a"]} position={[0, -0.1, 0]} />
            <CameraRig height={model.height} resetKey={resetKey} autoRotate={autoRotate} />
          </Canvas>
        ) : <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-500">No miniature loaded.</div>}
        {model ? <div className="pointer-events-none absolute bottom-4 left-1/2 max-w-[92%] -translate-x-1/2 rounded-full border border-slate-700/80 bg-slate-950/75 px-4 py-2 text-center text-[11px] font-semibold text-slate-400 backdrop-blur">Touch: one finger orbit · pinch zoom · two fingers pan · Desktop: drag orbit / right-drag pan</div> : null}
      </div>
      {error ? <p className="border-t border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
    </div>
  );
}
