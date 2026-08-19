"use client";

import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

export type PainterTool = "smart" | "brush" | "triangle" | "shell" | "picker";

type PaletteEntry = {
  name: string;
  color: string;
};

type LoadedPaintModel = {
  geometry: THREE.BufferGeometry;
  info: {
    name: string;
    triangles: number;
    height: number;
  };
};

type Topology = {
  adjacency: Int32Array;
  normals: Float32Array;
  centroids: Float32Array;
};

type PaintAction = {
  triangles: Uint32Array;
  before: Uint8Array;
  after: number;
};

type Props = {
  sourceFile: File | null;
};

const PALETTE: PaletteEntry[] = [
  { name: "Primer", color: "#8f949b" },
  { name: "Skin", color: "#b98769" },
  { name: "Leather", color: "#69422f" },
  { name: "Steel", color: "#717d86" },
  { name: "Gold", color: "#c69a3c" },
  { name: "Red cloth", color: "#843f43" },
  { name: "Green cloth", color: "#536447" },
  { name: "Bone", color: "#c5b995" },
];

const HIGHLIGHT = new THREE.Color("#55e7ff");
const MAX_UNDO = 30;

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function buildTopology(geometry: THREE.BufferGeometry): Topology {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const triangleCount = Math.floor(position.count / 3);
  const adjacency = new Int32Array(triangleCount * 3);
  adjacency.fill(-1);
  const normals = new Float32Array(triangleCount * 3);
  const centroids = new Float32Array(triangleCount * 3);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const maxDimension = box
    ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z)
    : 100;
  const epsilon = Math.max(0.00001, maxDimension * 0.00001);
  const inverseEpsilon = 1 / epsilon;

  const vertexMap = new Map<string, number>();
  const vertexIds = new Uint32Array(position.count);
  let nextVertexId = 0;

  for (let index = 0; index < position.count; index += 1) {
    const key = `${Math.round(position.getX(index) * inverseEpsilon)}|${Math.round(position.getY(index) * inverseEpsilon)}|${Math.round(position.getZ(index) * inverseEpsilon)}`;
    const existing = vertexMap.get(key);
    if (existing === undefined) {
      vertexMap.set(key, nextVertexId);
      vertexIds[index] = nextVertexId;
      nextVertexId += 1;
    } else {
      vertexIds[index] = existing;
    }
  }

  const edgeMap = new Map<bigint, number>();
  const edgeKey = (left: number, right: number) => {
    const low = Math.min(left, right);
    const high = Math.max(left, right);
    return (BigInt(low) << 32n) | BigInt(high);
  };

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const ax = position.getX(offset);
    const ay = position.getY(offset);
    const az = position.getZ(offset);
    const bx = position.getX(offset + 1);
    const by = position.getY(offset + 1);
    const bz = position.getZ(offset + 1);
    const cx = position.getX(offset + 2);
    const cy = position.getY(offset + 2);
    const cz = position.getZ(offset + 2);

    const abx = bx - ax;
    const aby = by - ay;
    const abz = bz - az;
    const acx = cx - ax;
    const acy = cy - ay;
    const acz = cz - az;
    let nx = aby * acz - abz * acy;
    let ny = abz * acx - abx * acz;
    let nz = abx * acy - aby * acx;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    normals[offset] = nx;
    normals[offset + 1] = ny;
    normals[offset + 2] = nz;
    centroids[offset] = (ax + bx + cx) / 3;
    centroids[offset + 1] = (ay + by + cy) / 3;
    centroids[offset + 2] = (az + bz + cz) / 3;

    const ids = [vertexIds[offset], vertexIds[offset + 1], vertexIds[offset + 2]];
    const pairs: [number, number][] = [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]];
    for (let slot = 0; slot < 3; slot += 1) {
      const key = edgeKey(pairs[slot][0], pairs[slot][1]);
      const packed = triangle * 3 + slot;
      const previous = edgeMap.get(key);
      if (previous === undefined) {
        edgeMap.set(key, packed);
      } else {
        const previousTriangle = Math.floor(previous / 3);
        const previousSlot = previous % 3;
        adjacency[packed] = previousTriangle;
        adjacency[previousTriangle * 3 + previousSlot] = triangle;
        edgeMap.delete(key);
      }
    }
  }

  return { adjacency, normals, centroids };
}

function CameraRig({ height, resetKey, paintMode }: { height: number; resetKey: number; paintMode: boolean }) {
  const { camera, gl } = useThree();
  const controls = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const next = new OrbitControls(camera, gl.domElement);
    next.enableDamping = true;
    next.dampingFactor = 0.06;
    next.screenSpacePanning = true;
    controls.current = next;

    let frame = 0;
    const tick = () => {
      next.enableRotate = !paintMode;
      next.enablePan = !paintMode;
      next.enableZoom = true;
      next.update();
      frame = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(frame);
      next.dispose();
      controls.current = null;
    };
  }, [camera, gl, paintMode]);

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

function PainterMesh({
  model,
  topology,
  paintIds,
  tool,
  selectedMaterial,
  smartAngle,
  brushRadius,
  paintMode,
  resetKey,
  onRegionChange,
  onApply,
  onPick,
}: {
  model: LoadedPaintModel;
  topology: Topology;
  paintIds: Uint8Array;
  tool: PainterTool;
  selectedMaterial: number;
  smartAngle: number;
  brushRadius: number;
  paintMode: boolean;
  resetKey: number;
  onRegionChange: (count: number) => void;
  onApply: (triangles: number[]) => void;
  onPick: (material: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const previewRef = useRef<number[]>([]);
  const hoverKeyRef = useRef("");
  const paletteColors = useMemo(() => PALETTE.map((entry) => new THREE.Color(entry.color)), []);

  const restoreTriangles = useCallback((triangles: number[]) => {
    const colors = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (const triangle of triangles) {
      const color = paletteColors[paintIds[triangle] ?? 0];
      const offset = triangle * 3;
      colors.setXYZ(offset, color.r, color.g, color.b);
      colors.setXYZ(offset + 1, color.r, color.g, color.b);
      colors.setXYZ(offset + 2, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
  }, [model.geometry, paintIds, paletteColors]);

  const showPreview = useCallback((triangles: number[]) => {
    if (previewRef.current.length) restoreTriangles(previewRef.current);
    previewRef.current = triangles;
    const colors = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    const selected = paletteColors[selectedMaterial].clone().lerp(HIGHLIGHT, 0.45);
    for (const triangle of triangles) {
      const offset = triangle * 3;
      colors.setXYZ(offset, selected.r, selected.g, selected.b);
      colors.setXYZ(offset + 1, selected.r, selected.g, selected.b);
      colors.setXYZ(offset + 2, selected.r, selected.g, selected.b);
    }
    colors.needsUpdate = true;
    onRegionChange(triangles.length);
  }, [model.geometry, onRegionChange, paletteColors, restoreTriangles, selectedMaterial]);

  const clearPreview = useCallback(() => {
    if (previewRef.current.length) restoreTriangles(previewRef.current);
    previewRef.current = [];
    hoverKeyRef.current = "";
    onRegionChange(0);
  }, [onRegionChange, restoreTriangles]);

  useEffect(() => () => clearPreview(), [clearPreview]);

  const collectRegion = useCallback((seed: number, hitPoint: THREE.Vector3) => {
    const triangleCount = paintIds.length;
    if (seed < 0 || seed >= triangleCount) return [];
    if (tool === "triangle" || tool === "picker") return [seed];

    const queue = new Uint32Array(triangleCount);
    const visited = new Uint8Array(triangleCount);
    const result: number[] = [];
    let head = 0;
    let tail = 0;
    queue[tail] = seed;
    tail += 1;
    visited[seed] = 1;
    const seedMaterial = paintIds[seed];
    const threshold = Math.cos((smartAngle * Math.PI) / 180);

    while (head < tail) {
      const triangle = queue[head];
      head += 1;
      const normalOffset = triangle * 3;

      if (tool === "brush") {
        const dx = topology.centroids[normalOffset] - hitPoint.x;
        const dy = topology.centroids[normalOffset + 1] - hitPoint.y;
        const dz = topology.centroids[normalOffset + 2] - hitPoint.z;
        if ((dx * dx + dy * dy + dz * dz) > brushRadius * brushRadius) continue;
      }

      result.push(triangle);

      for (let slot = 0; slot < 3; slot += 1) {
        const neighbor = topology.adjacency[normalOffset + slot];
        if (neighbor < 0 || visited[neighbor]) continue;

        if (tool === "smart") {
          if (paintIds[neighbor] !== seedMaterial) continue;
          const neighborOffset = neighbor * 3;
          const dot =
            topology.normals[normalOffset] * topology.normals[neighborOffset]
            + topology.normals[normalOffset + 1] * topology.normals[neighborOffset + 1]
            + topology.normals[normalOffset + 2] * topology.normals[neighborOffset + 2];
          if (dot < threshold) continue;
        }

        if (tool === "brush") {
          const neighborOffset = neighbor * 3;
          const dx = topology.centroids[neighborOffset] - hitPoint.x;
          const dy = topology.centroids[neighborOffset + 1] - hitPoint.y;
          const dz = topology.centroids[neighborOffset + 2] - hitPoint.z;
          if ((dx * dx + dy * dy + dz * dz) > brushRadius * brushRadius) continue;
        }

        visited[neighbor] = 1;
        queue[tail] = neighbor;
        tail += 1;
      }
    }

    return result;
  }, [brushRadius, paintIds, smartAngle, tool, topology]);

  const regionFromEvent = useCallback((event: ThreeEvent<PointerEvent>) => {
    const faceIndex = event.faceIndex ?? -1;
    if (faceIndex < 0 || !meshRef.current) return [];
    const localPoint = meshRef.current.worldToLocal(event.point.clone());
    return collectRegion(faceIndex, localPoint);
  }, [collectRegion]);

  return (
    <>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        geometry={model.geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(event) => {
          if (!paintMode || tool === "picker") return;
          event.stopPropagation();
          const faceIndex = event.faceIndex ?? -1;
          if (faceIndex < 0) return;
          const hit = event.point;
          const key = `${faceIndex}:${tool}:${smartAngle}:${brushRadius}:${selectedMaterial}:${Math.round(hit.x * 2)}:${Math.round(hit.y * 2)}:${Math.round(hit.z * 2)}`;
          if (key === hoverKeyRef.current) return;
          hoverKeyRef.current = key;
          showPreview(regionFromEvent(event));
        }}
        onPointerOut={() => {
          if (paintMode) clearPreview();
        }}
        onClick={(event) => {
          if (!paintMode) return;
          event.stopPropagation();
          const faceIndex = event.faceIndex ?? -1;
          if (faceIndex < 0) return;
          if (tool === "picker") {
            onPick(paintIds[faceIndex] ?? 0);
            clearPreview();
            return;
          }
          const region = regionFromEvent(event);
          clearPreview();
          onApply(region);
        }}
      >
        <meshStandardMaterial vertexColors roughness={0.64} metalness={0.08} />
      </mesh>

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <circleGeometry args={[46, 96]} />
        <meshStandardMaterial color="#151b22" roughness={0.96} metalness={0.02} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.28, 0]}>
        <circleGeometry args={[51, 96]} />
        <meshStandardMaterial color="#090c10" roughness={1} />
      </mesh>
      <gridHelper args={[140, 28, "#344253", "#17202a"]} position={[0, -0.1, 0]} />
      <CameraRig height={model.info.height} resetKey={resetKey} paintMode={paintMode} />
    </>
  );
}

export function MiniaturePainterPrototype({ sourceFile }: Props) {
  const [model, setModel] = useState<LoadedPaintModel | null>(null);
  const modelRef = useRef<LoadedPaintModel | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [paintIds, setPaintIds] = useState<Uint8Array | null>(null);
  const [tool, setTool] = useState<PainterTool>("smart");
  const [selectedMaterial, setSelectedMaterial] = useState(5);
  const [smartAngle, setSmartAngle] = useState(32);
  const [brushRadius, setBrushRadius] = useState(2.5);
  const [paintMode, setPaintMode] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [regionCount, setRegionCount] = useState(0);
  const [phase, setPhase] = useState("Waiting for a miniature");
  const [error, setError] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<PaintAction[]>([]);
  const [redoStack, setRedoStack] = useState<PaintAction[]>([]);
  const [, setPaintVersion] = useState(0);

  const paletteColors = useMemo(() => PALETTE.map((entry) => new THREE.Color(entry.color)), []);

  const paintTriangles = useCallback((triangles: ArrayLike<number>, material: number) => {
    if (!model || !paintIds) return;
    const color = paletteColors[material];
    const colors = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (let index = 0; index < triangles.length; index += 1) {
      const triangle = triangles[index];
      paintIds[triangle] = material;
      const offset = triangle * 3;
      colors.setXYZ(offset, color.r, color.g, color.b);
      colors.setXYZ(offset + 1, color.r, color.g, color.b);
      colors.setXYZ(offset + 2, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
    setPaintVersion((value) => value + 1);
  }, [model, paintIds, paletteColors]);

  const applyRegion = useCallback((region: number[]) => {
    if (!paintIds || region.length === 0) return;
    const changed = region.filter((triangle) => paintIds[triangle] !== selectedMaterial);
    if (changed.length === 0) return;
    const triangles = Uint32Array.from(changed);
    const before = new Uint8Array(changed.length);
    changed.forEach((triangle, index) => { before[index] = paintIds[triangle]; });
    paintTriangles(triangles, selectedMaterial);
    const action: PaintAction = { triangles, before, after: selectedMaterial };
    setUndoStack((stack) => [...stack.slice(-(MAX_UNDO - 1)), action]);
    setRedoStack([]);
  }, [paintIds, paintTriangles, selectedMaterial]);

  const undo = useCallback(() => {
    if (!model || !paintIds || undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    const colors = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (let index = 0; index < action.triangles.length; index += 1) {
      const triangle = action.triangles[index];
      const material = action.before[index];
      paintIds[triangle] = material;
      const color = paletteColors[material];
      const offset = triangle * 3;
      colors.setXYZ(offset, color.r, color.g, color.b);
      colors.setXYZ(offset + 1, color.r, color.g, color.b);
      colors.setXYZ(offset + 2, color.r, color.g, color.b);
    }
    colors.needsUpdate = true;
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack, action]);
    setPaintVersion((value) => value + 1);
  }, [model, paintIds, paletteColors, undoStack]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    paintTriangles(action.triangles, action.after);
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack, action]);
  }, [paintTriangles, redoStack]);

  const resetPaint = useCallback(() => {
    if (!paintIds) return;
    const all = new Uint32Array(paintIds.length);
    for (let index = 0; index < all.length; index += 1) all[index] = index;
    paintTriangles(all, 0);
    setUndoStack([]);
    setRedoStack([]);
  }, [paintIds, paintTriangles]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setTopology(null);
    setPaintIds(null);
    setUndoStack([]);
    setRedoStack([]);
    setPaintMode(false);
    setRegionCount(0);

    if (!sourceFile) {
      if (modelRef.current) {
        modelRef.current.geometry.dispose();
        modelRef.current = null;
      }
      setModel(null);
      setPhase("Waiting for a miniature");
      return () => { cancelled = true; };
    }

    const load = async () => {
      try {
        setPhase("Reading STL…");
        await nextFrame();
        const buffer = await sourceFile.arrayBuffer();
        if (cancelled) return;
        const geometry = new STLLoader().parse(buffer);
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        if (!box) throw new Error("Could not determine miniature bounds.");
        const height = box.max.z - box.min.z;
        geometry.translate(
          -(box.min.x + box.max.x) / 2,
          -(box.min.y + box.max.y) / 2,
          -box.min.z,
        );
        const triangleCount = Math.floor((geometry.getAttribute("position")?.count ?? 0) / 3);
        const ids = new Uint8Array(triangleCount);
        const colorAttribute = new THREE.BufferAttribute(new Float32Array(triangleCount * 9), 3);
        const primer = paletteColors[0];
        for (let vertex = 0; vertex < triangleCount * 3; vertex += 1) {
          colorAttribute.setXYZ(vertex, primer.r, primer.g, primer.b);
        }
        geometry.setAttribute("color", colorAttribute);

        if (modelRef.current) modelRef.current.geometry.dispose();
        const nextModel = { geometry, info: { name: sourceFile.name, triangles: triangleCount, height } };
        modelRef.current = nextModel;
        setModel(nextModel);
        setPaintIds(ids);
        setResetKey((value) => value + 1);
        setPhase(`Analyzing ${triangleCount.toLocaleString()} triangles…`);
        await nextFrame();
        const nextTopology = buildTopology(geometry);
        if (cancelled) {
          geometry.dispose();
          return;
        }
        setTopology(nextTopology);
        setPhase("Ready to paint");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not prepare this STL for painting.");
        setPhase("Painter unavailable");
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [paletteColors, sourceFile]);

  useEffect(() => () => {
    modelRef.current?.geometry.dispose();
    modelRef.current = null;
  }, []);

  const ready = Boolean(model && topology && paintIds);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-hidden rounded-[30px] border border-slate-800 bg-[#080d13] shadow-2xl shadow-black/30">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/75 px-4 py-3 sm:px-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-fuchsia-300">Miniature Painter · prototype</p>
            <p className="mt-1 text-sm font-bold text-slate-200">{model?.info.name ?? "No current miniature"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!ready}
              onClick={() => setPaintMode(false)}
              className={`rounded-xl border px-3 py-2 text-xs font-black ${!paintMode ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-slate-700 text-slate-500"} disabled:opacity-30`}
            >
              View
            </button>
            <button
              type="button"
              disabled={!ready}
              onClick={() => setPaintMode(true)}
              className={`rounded-xl border px-3 py-2 text-xs font-black ${paintMode ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200" : "border-slate-700 text-slate-500"} disabled:opacity-30`}
            >
              Paint
            </button>
            <button type="button" disabled={!model} onClick={() => setResetKey((value) => value + 1)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400 disabled:opacity-30">
              Reset view
            </button>
          </div>
        </header>

        <div className="relative h-[66vh] min-h-[560px] max-h-[860px]">
          {model && topology && paintIds ? (
            <Canvas shadows dpr={[1, 1.55]} camera={{ fov: 32, position: [55, 34, 62] }} gl={{ antialias: true, alpha: false }}>
              <color attach="background" args={["#0a0f16"]} />
              <fog attach="fog" args={["#0a0f16", 95, 220]} />
              <ambientLight intensity={1.15} />
              <hemisphereLight args={["#d8e7ff", "#281d16", 1.35]} />
              <directionalLight castShadow position={[40, 70, 35]} intensity={3.1} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
              <directionalLight position={[-35, 30, -25]} intensity={1.35} />
              <PainterMesh
                model={model}
                topology={topology}
                paintIds={paintIds}
                tool={tool}
                selectedMaterial={selectedMaterial}
                smartAngle={smartAngle}
                brushRadius={brushRadius}
                paintMode={paintMode}
                resetKey={resetKey}
                onRegionChange={setRegionCount}
                onApply={applyRegion}
                onPick={(material) => {
                  setSelectedMaterial(material);
                  setTool("smart");
                }}
              />
            </Canvas>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_38%,rgba(80,47,92,0.32),rgba(8,13,19,0.96)_58%)] px-8 text-center">
              <div className="text-4xl">◇</div>
              <p className="mt-4 text-xl font-black text-slate-200">{phase}</p>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                {sourceFile ? "The first analysis builds triangle adjacency so Smart Paint can follow the model surface instead of flooding blindly." : "Choose a character with a saved current miniature above."}
              </p>
            </div>
          )}

          {ready ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-700/80 bg-slate-950/80 px-4 py-2 text-center text-[11px] font-semibold text-slate-400 backdrop-blur">
              {paintMode
                ? `Hover previews the region · click paints · wheel zooms · ${regionCount.toLocaleString()} triangles selected`
                : "Drag to orbit · wheel / pinch to zoom · switch to Paint when the camera is positioned"}
            </div>
          ) : null}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-[26px] border border-fuchsia-500/20 bg-fuchsia-500/[0.05] p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.23em] text-fuchsia-300">Prototype scope</p>
          <h2 className="mt-2 text-xl font-black text-slate-100">Test the selection first</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">This first pass deliberately keeps paint in browser memory only. We are testing whether Smart Paint chooses useful regions on real STL miniatures before adding saved paint jobs and advanced PBR materials.</p>
          <div className="mt-4 rounded-xl border border-slate-800 bg-black/20 px-3 py-2 text-xs font-bold text-slate-400">{phase}</div>
        </section>

        <section className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Tools</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              ["smart", "Smart"],
              ["brush", "Brush"],
              ["triangle", "Triangle"],
              ["shell", "Shell"],
              ["picker", "Picker"],
            ] as [PainterTool, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={!ready}
                onClick={() => setTool(value)}
                className={`min-h-11 rounded-xl border px-3 text-xs font-black transition ${tool === value ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-100" : "border-slate-700 text-slate-400 hover:border-slate-600"} disabled:opacity-30`}
              >
                {label}
              </button>
            ))}
          </div>

          {tool === "smart" ? (
            <label className="mt-4 block text-xs font-bold text-slate-400">
              Edge threshold <span className="float-right text-cyan-300">{smartAngle}°</span>
              <input type="range" min="5" max="80" step="1" value={smartAngle} onChange={(event) => setSmartAngle(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-400" />
              <span className="mt-1 flex justify-between text-[10px] font-medium text-slate-600"><span>Stops on sharper edges</span><span>Flows farther</span></span>
            </label>
          ) : null}

          {tool === "brush" ? (
            <label className="mt-4 block text-xs font-bold text-slate-400">
              Surface radius <span className="float-right text-cyan-300">{brushRadius.toFixed(1)} mm</span>
              <input type="range" min="0.7" max="8" step="0.1" value={brushRadius} onChange={(event) => setBrushRadius(Number(event.target.value))} className="mt-2 w-full accent-fuchsia-400" />
            </label>
          ) : null}
        </section>

        <section className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Color</p>
          <p className="mt-2 text-sm font-black text-slate-200">{PALETTE[selectedMaterial].name}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {PALETTE.map((entry, index) => (
              <button
                key={entry.name}
                type="button"
                title={entry.name}
                aria-label={entry.name}
                onClick={() => setSelectedMaterial(index)}
                className={`aspect-square rounded-xl border-2 ${selectedMaterial === index ? "border-cyan-300 ring-2 ring-cyan-300/20" : "border-slate-700"}`}
                style={{ background: entry.color }}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-slate-500">For this prototype every painted zone shares one neutral surface material. Metalness, roughness, washes and highlights come after we prove region selection.</p>
        </section>

        <section className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={!ready || undoStack.length === 0} onClick={undo} className="min-h-11 rounded-xl border border-slate-700 text-xs font-black text-slate-300 disabled:opacity-30">↶ Undo</button>
            <button type="button" disabled={!ready || redoStack.length === 0} onClick={redo} className="min-h-11 rounded-xl border border-slate-700 text-xs font-black text-slate-300 disabled:opacity-30">Redo ↷</button>
          </div>
          <button type="button" disabled={!ready} onClick={resetPaint} className="mt-2 min-h-11 w-full rounded-xl border border-rose-500/25 bg-rose-500/[0.05] text-xs font-black text-rose-200 disabled:opacity-30">Reset paint</button>
          <p className="mt-3 text-[11px] leading-5 text-slate-600">Refresh or change character to discard the prototype paint job.</p>
        </section>

        {error ? <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">{error}</p> : null}
      </aside>
    </div>
  );
}
