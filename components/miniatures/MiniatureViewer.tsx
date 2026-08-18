"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

export type MiniatureModelInfo = {
  name: string;
  sizeBytes: number;
  triangles: number;
  width: number;
  depth: number;
  height: number;
};

type LoadedModel = {
  geometry: THREE.BufferGeometry;
  info: MiniatureModelInfo;
};

type Props = {
  sourceFile?: File | null;
  allowFilePicker?: boolean;
  onLocalFileLoaded?: (file: File, info: MiniatureModelInfo) => void;
  emptyTitle?: string;
  emptyCopy?: string;
};

const MATERIALS = [
  { name: "Primer", value: "#8f949b" },
  { name: "Ivory", value: "#c8b99b" },
  { name: "Bronze", value: "#8b6442" },
  { name: "Obsidian", value: "#30343b" },
];

function CameraRig({ height, resetKey, autoRotate }: { height: number; resetKey: number; autoRotate: boolean }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const next = new OrbitControls(camera, gl.domElement);
    next.enableDamping = true;
    next.dampingFactor = 0.06;
    next.enablePan = true;
    next.screenSpacePanning = true;
    next.minPolarAngle = 0.18;
    next.maxPolarAngle = Math.PI * 0.93;
    controls.current = next;

    let frame = 0;
    const tick = () => {
      next.autoRotate = autoRotate;
      next.autoRotateSpeed = 1.2;
      next.update();
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      next.dispose();
      controls.current = null;
    };
  }, [camera, gl, autoRotate]);

  useEffect(() => {
    const distance = Math.max(52, height * 1.8);
    camera.position.set(distance * 0.75, Math.max(24, height * 0.72), distance * 0.92);
    camera.near = 0.1;
    camera.far = 2000;
    camera.updateProjectionMatrix();
    controls.current?.target.set(0, Math.max(8, height * 0.42), 0);
    if (controls.current) {
      controls.current.minDistance = Math.max(18, height * 0.55);
      controls.current.maxDistance = Math.max(120, height * 4.2);
    }
    controls.current?.update();
  }, [camera, height, resetKey]);

  return null;
}

function MiniatureScene({ model, material, autoRotate, resetKey }: { model: LoadedModel; material: string; autoRotate: boolean; resetKey: number }) {
  return (
    <>
      <color attach="background" args={["#0a0f16"]} />
      <fog attach="fog" args={["#0a0f16", 95, 220]} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={["#d8e7ff", "#281d16", 1.35]} />
      <directionalLight castShadow position={[40, 70, 35]} intensity={3.1} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-35, 30, -25]} intensity={1.35} />

      <group>
        <mesh castShadow receiveShadow geometry={model.geometry} rotation={[-Math.PI / 2, 0, 0]}>
          <meshStandardMaterial color={material} roughness={0.68} metalness={0.08} />
        </mesh>
      </group>

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <circleGeometry args={[46, 96]} />
        <meshStandardMaterial color="#151b22" roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <circleGeometry args={[51, 96]} />
        <meshStandardMaterial color="#090c10" roughness={1} />
      </mesh>
      <gridHelper args={[140, 28, "#344253", "#17202a"]} position={[0, -0.1, 0]} />

      <CameraRig height={model.info.height} resetKey={resetKey} autoRotate={autoRotate} />
    </>
  );
}

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MiniatureViewer({
  sourceFile,
  allowFilePicker = true,
  onLocalFileLoaded,
  emptyTitle = "Choose an STL miniature",
  emptyCopy = "Drop an STL here or click to choose one from your computer.",
}: Props = {}) {
  const [model, setModel] = useState<LoadedModel | null>(null);
  const modelRef = useRef<LoadedModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [material, setMaterial] = useState(MATERIALS[0].value);
  const [autoRotate, setAutoRotate] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedMaterial = useMemo(
    () => MATERIALS.find((entry) => entry.value === material)?.name ?? "Primer",
    [material],
  );

  const replaceModel = useCallback((next: LoadedModel | null) => {
    if (modelRef.current && modelRef.current !== next) {
      modelRef.current.geometry.dispose();
    }
    modelRef.current = next;
    setModel(next);
  }, []);

  const loadFile = useCallback(async (file: File, notifyLocal: boolean) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".stl")) {
      setError("Choose an STL file.");
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const geometry = new STLLoader().parse(buffer);
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (!box) throw new Error("Could not determine model bounds.");

      const width = box.max.x - box.min.x;
      const depth = box.max.y - box.min.y;
      const height = box.max.z - box.min.z;
      geometry.translate(
        -(box.min.x + box.max.x) / 2,
        -(box.min.y + box.max.y) / 2,
        -box.min.z,
      );

      const triangles = Math.floor((geometry.getAttribute("position")?.count ?? 0) / 3);
      const info: MiniatureModelInfo = {
        name: file.name,
        sizeBytes: file.size,
        triangles,
        width,
        depth,
        height,
      };
      replaceModel({ geometry, info });
      setResetKey((value) => value + 1);
      if (notifyLocal) onLocalFileLoaded?.(file, info);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this STL file.");
    }
  }, [onLocalFileLoaded, replaceModel]);

  useEffect(() => {
    if (sourceFile === undefined) return;
    if (sourceFile === null) {
      replaceModel(null);
      return;
    }
    void loadFile(sourceFile, false);
  }, [loadFile, replaceModel, sourceFile]);

  useEffect(() => () => {
    modelRef.current?.geometry.dispose();
    modelRef.current = null;
  }, []);

  const acceptLocalFile = (file: File) => {
    if (!allowFilePicker) return;
    void loadFile(file, true);
  };

  return (
    <div className={`grid gap-5 ${allowFilePicker ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "xl:grid-cols-[minmax(0,1fr)_280px]"}`}>
      <div className="overflow-hidden rounded-[30px] border border-slate-800 bg-[#080d13] shadow-2xl shadow-black/30">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/70 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-cyan-300">Miniature viewport</p>
            <p className="mt-1 text-sm font-bold text-slate-200">{model?.info.name ?? "No miniature loaded"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAutoRotate((value) => !value)} disabled={!model} className={`rounded-xl border px-3 py-2 text-xs font-bold disabled:opacity-30 ${autoRotate ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-slate-700 text-slate-400"}`}>
              {autoRotate ? "Stop turntable" : "Turntable"}
            </button>
            <button type="button" onClick={() => setResetKey((value) => value + 1)} disabled={!model} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400 disabled:opacity-30">
              Reset view
            </button>
          </div>
        </div>

        <div
          className={`relative h-[62vh] min-h-[520px] max-h-[820px] ${dragging ? "ring-2 ring-inset ring-cyan-400/60" : ""}`}
          onDragEnter={(event) => { if (!allowFilePicker) return; event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => { if (allowFilePicker) event.preventDefault(); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            if (!allowFilePicker) return;
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files?.[0];
            if (file) acceptLocalFile(file);
          }}
        >
          {model ? (
            <Canvas shadows dpr={[1, 1.7]} camera={{ fov: 32, position: [55, 34, 62] }} gl={{ antialias: true, alpha: false }}>
              <MiniatureScene model={model} material={material} autoRotate={autoRotate} resetKey={resetKey} />
            </Canvas>
          ) : allowFilePicker ? (
            <button type="button" onClick={() => inputRef.current?.click()} className="absolute inset-0 flex w-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_38%,rgba(39,66,92,0.5),rgba(8,13,19,0.95)_56%)] px-8 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/5 text-4xl text-cyan-200">◇</span>
              <span className="text-2xl font-black text-slate-100">{emptyTitle}</span>
              <span className="max-w-xl text-sm leading-6 text-slate-400">{emptyCopy}</span>
            </button>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_38%,rgba(39,66,92,0.35),rgba(8,13,19,0.95)_56%)] px-8 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full border border-slate-700 bg-slate-900/50 text-4xl text-slate-500">◇</span>
              <span className="text-2xl font-black text-slate-300">{emptyTitle}</span>
              <span className="max-w-xl text-sm leading-6 text-slate-500">{emptyCopy}</span>
            </div>
          )}
          {model ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-700/80 bg-slate-950/75 px-4 py-2 text-center text-[11px] font-semibold text-slate-400 backdrop-blur">
              Drag to orbit · wheel / pinch to zoom · right-drag / two fingers to pan
            </div>
          ) : null}
        </div>
      </div>

      <aside className="space-y-4">
        {allowFilePicker ? (
          <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-yellow-400">Miniature source</p>
            <h2 className="mt-2 text-xl font-black text-slate-100">STL preview</h2>
            <p className="mt-2 text-xs leading-5 text-slate-500">Choose a model here first. A parent manager can decide whether that preview should be uploaded and made current.</p>

            <input ref={inputRef} type="file" accept=".stl,model/stl,application/sla,application/octet-stream" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) acceptLocalFile(file); event.currentTarget.value = ""; }} />
            <button type="button" onClick={() => inputRef.current?.click()} className="mt-4 min-h-11 w-full rounded-xl bg-yellow-500 px-4 text-sm font-black text-slate-950">
              {model ? "Choose another STL" : "Choose STL"}
            </button>
          </div>
        ) : null}

        <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Material preview</p>
          <p className="mt-2 text-sm font-bold text-slate-200">{selectedMaterial}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {MATERIALS.map((entry) => (
              <button key={entry.value} type="button" aria-label={entry.name} title={entry.name} onClick={() => setMaterial(entry.value)} className={`aspect-square rounded-xl border-2 ${material === entry.value ? "border-cyan-300" : "border-slate-700"}`} style={{ background: entry.value }} />
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">STL has geometry but no painted texture, so these are viewer-only material previews.</p>
        </div>

        <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Model data</p>
          {model ? (
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-slate-800 bg-black/15 p-3"><dt className="text-slate-600">File</dt><dd className="mt-1 font-bold text-slate-300">{formatBytes(model.info.sizeBytes)}</dd></div>
              <div className="rounded-xl border border-slate-800 bg-black/15 p-3"><dt className="text-slate-600">Triangles</dt><dd className="mt-1 font-bold text-slate-300">{model.info.triangles.toLocaleString()}</dd></div>
              <div className="rounded-xl border border-slate-800 bg-black/15 p-3"><dt className="text-slate-600">Height</dt><dd className="mt-1 font-bold text-slate-300">{model.info.height.toFixed(1)} mm</dd></div>
              <div className="rounded-xl border border-slate-800 bg-black/15 p-3"><dt className="text-slate-600">Footprint</dt><dd className="mt-1 font-bold text-slate-300">{model.info.width.toFixed(1)} × {model.info.depth.toFixed(1)} mm</dd></div>
            </dl>
          ) : (
            <p className="mt-3 text-xs leading-5 text-slate-600">No model data is available yet.</p>
          )}
        </div>

        {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">{error}</p> : null}
      </aside>
    </div>
  );
}
