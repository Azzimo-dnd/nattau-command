"use client";

import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

type Tool = "smart" | "brush" | "triangle" | "shell" | "picker";
type Props = { sourceFile: File | null };
type Model = { geometry: THREE.BufferGeometry; name: string; triangles: number; height: number };
type Topology = { adjacency: Int32Array; normals: Float32Array; centroids: Float32Array };
type UndoEntry = { indices: Uint32Array; before: Uint8Array };

const PALETTE = [
  ["Primer", "#8f949b"],
  ["Skin", "#b98769"],
  ["Leather", "#69422f"],
  ["Steel", "#717d86"],
  ["Gold", "#c69a3c"],
  ["Red cloth", "#843f43"],
  ["Green cloth", "#536447"],
  ["Bone", "#c5b995"],
] as const;

function buildTopology(geometry: THREE.BufferGeometry): Topology {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const count = Math.floor(position.count / 3);
  const adjacency = new Int32Array(count * 3);
  adjacency.fill(-1);
  const normals = new Float32Array(count * 3);
  const centroids = new Float32Array(count * 3);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const maxDim = box ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) : 100;
  const q = 1 / Math.max(0.00001, maxDim * 0.00001);
  const vertexMap = new Map<string, number>();
  const ids = new Uint32Array(position.count);
  let nextId = 0;

  for (let i = 0; i < position.count; i += 1) {
    const key = `${Math.round(position.getX(i) * q)}|${Math.round(position.getY(i) * q)}|${Math.round(position.getZ(i) * q)}`;
    let id = vertexMap.get(key);
    if (id === undefined) { id = nextId++; vertexMap.set(key, id); }
    ids[i] = id;
  }

  const edgeBase = nextId + 1;
  const edges = new Map<number, number>();
  const edgeKey = (a: number, b: number) => Math.min(a, b) * edgeBase + Math.max(a, b);

  for (let t = 0; t < count; t += 1) {
    const o = t * 3;
    const a = new THREE.Vector3(position.getX(o), position.getY(o), position.getZ(o));
    const b = new THREE.Vector3(position.getX(o + 1), position.getY(o + 1), position.getZ(o + 1));
    const c = new THREE.Vector3(position.getX(o + 2), position.getY(o + 2), position.getZ(o + 2));
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    normals.set([n.x, n.y, n.z], o);
    centroids.set([(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3], o);
    const pairs = [[ids[o], ids[o + 1]], [ids[o + 1], ids[o + 2]], [ids[o + 2], ids[o]]] as const;
    for (let s = 0; s < 3; s += 1) {
      const key = edgeKey(pairs[s][0], pairs[s][1]);
      const packed = o + s;
      const previous = edges.get(key);
      if (previous === undefined) edges.set(key, packed);
      else {
        const pt = Math.floor(previous / 3);
        adjacency[packed] = pt;
        adjacency[previous] = t;
        edges.delete(key);
      }
    }
  }
  return { adjacency, normals, centroids };
}

function CameraRig({ height, paintMode, resetKey }: { height: number; paintMode: boolean; resetKey: number }) {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    ref.current = controls;
    let frame = 0;
    const tick = () => {
      controls.enableRotate = !paintMode;
      controls.enablePan = !paintMode;
      controls.enableZoom = true;
      controls.update();
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); controls.dispose(); };
  }, [camera, gl, paintMode]);
  useEffect(() => {
    const d = Math.max(52, height * 1.8);
    camera.position.set(d * 0.75, Math.max(24, height * 0.72), d * 0.92);
    camera.updateProjectionMatrix();
    ref.current?.target.set(0, Math.max(8, height * 0.42), 0);
    ref.current?.update();
  }, [camera, height, resetKey]);
  return null;
}

function PaintMesh({ model, topology, paintIds, tool, materialId, angle, radius, paintMode, resetKey, onPaint, onPick, onPreview }: {
  model: Model; topology: Topology; paintIds: Uint8Array; tool: Tool; materialId: number; angle: number; radius: number;
  paintMode: boolean; resetKey: number; onPaint: (indices: number[]) => void; onPick: (id: number) => void; onPreview: (count: number) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const previewRef = useRef<number[]>([]);
  const colors = useMemo(() => PALETTE.map(([, value]) => new THREE.Color(value)), []);

  const restore = useCallback(() => {
    const attr = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (const t of previewRef.current) {
      const c = colors[paintIds[t] ?? 0]; const o = t * 3;
      attr.setXYZ(o, c.r, c.g, c.b); attr.setXYZ(o + 1, c.r, c.g, c.b); attr.setXYZ(o + 2, c.r, c.g, c.b);
    }
    attr.needsUpdate = true; previewRef.current = []; onPreview(0);
  }, [colors, model.geometry, onPreview, paintIds]);

  const collect = useCallback((seed: number, point: THREE.Vector3) => {
    if (seed < 0 || seed >= paintIds.length) return [];
    if (tool === "triangle" || tool === "picker") return [seed];
    const queue = new Uint32Array(paintIds.length); const visited = new Uint8Array(paintIds.length); const out: number[] = [];
    let head = 0; let tail = 1; queue[0] = seed; visited[seed] = 1;
    const seedMaterial = paintIds[seed]; const cosThreshold = Math.cos((angle * Math.PI) / 180);
    while (head < tail) {
      const t = queue[head++]; const o = t * 3;
      if (tool === "brush") {
        const dx = topology.centroids[o] - point.x; const dy = topology.centroids[o + 1] - point.y; const dz = topology.centroids[o + 2] - point.z;
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
      }
      out.push(t);
      for (let s = 0; s < 3; s += 1) {
        const n = topology.adjacency[o + s]; if (n < 0 || visited[n]) continue;
        if (tool === "smart") {
          if (paintIds[n] !== seedMaterial) continue;
          const no = n * 3;
          const dot = topology.normals[o] * topology.normals[no] + topology.normals[o + 1] * topology.normals[no + 1] + topology.normals[o + 2] * topology.normals[no + 2];
          if (dot < cosThreshold) continue;
        }
        if (tool === "brush") {
          const no = n * 3; const dx = topology.centroids[no] - point.x; const dy = topology.centroids[no + 1] - point.y; const dz = topology.centroids[no + 2] - point.z;
          if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        }
        visited[n] = 1; queue[tail++] = n;
      }
    }
    return out;
  }, [angle, paintIds, radius, tool, topology]);

  const regionFromEvent = useCallback((event: ThreeEvent<MouseEvent | PointerEvent>) => {
    const face = event.faceIndex ?? -1; if (face < 0) return [];
    const local = meshRef.current.worldToLocal(event.point.clone());
    return collect(face, local);
  }, [collect]);

  const preview = useCallback((indices: number[]) => {
    restore(); previewRef.current = indices;
    const attr = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    const c = colors[materialId].clone().lerp(new THREE.Color("#55e7ff"), 0.42);
    for (const t of indices) { const o = t * 3; attr.setXYZ(o, c.r, c.g, c.b); attr.setXYZ(o + 1, c.r, c.g, c.b); attr.setXYZ(o + 2, c.r, c.g, c.b); }
    attr.needsUpdate = true; onPreview(indices.length);
  }, [colors, materialId, model.geometry, onPreview, restore]);

  return <>
    <mesh ref={meshRef} geometry={model.geometry} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow
      onPointerMove={(event) => { if (!paintMode || tool === "picker") return; event.stopPropagation(); preview(regionFromEvent(event)); }}
      onPointerOut={() => { if (paintMode) restore(); }}
      onClick={(event) => {
        if (!paintMode) return; event.stopPropagation(); const face = event.faceIndex ?? -1; if (face < 0) return;
        if (tool === "picker") { onPick(paintIds[face] ?? 0); restore(); return; }
        const region = regionFromEvent(event); restore(); onPaint(region);
      }}>
      <meshStandardMaterial vertexColors roughness={0.64} metalness={0.08} />
    </mesh>
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}><circleGeometry args={[46, 96]} /><meshStandardMaterial color="#151b22" roughness={0.96} /></mesh>
    <gridHelper args={[140, 28, "#344253", "#17202a"]} position={[0, -0.1, 0]} />
    <CameraRig height={model.height} paintMode={paintMode} resetKey={resetKey} />
  </>;
}

export function MiniaturePainterPrototypeV1({ sourceFile }: Props) {
  const [model, setModel] = useState<Model | null>(null); const modelRef = useRef<Model | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null); const [paintIds, setPaintIds] = useState<Uint8Array | null>(null);
  const [tool, setTool] = useState<Tool>("smart"); const [materialId, setMaterialId] = useState(5); const [angle, setAngle] = useState(28); const [radius, setRadius] = useState(3.5);
  const [paintMode, setPaintMode] = useState(false); const [previewCount, setPreviewCount] = useState(0); const [undo, setUndo] = useState<UndoEntry[]>([]); const [resetKey, setResetKey] = useState(0);
  const [status, setStatus] = useState("Choose a saved miniature above.");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (modelRef.current) { modelRef.current.geometry.dispose(); modelRef.current = null; }
      setModel(null); setTopology(null); setPaintIds(null); setUndo([]);
      if (!sourceFile) return;
      setStatus("Reading STL…");
      try {
        const geometry = new STLLoader().parse(await sourceFile.arrayBuffer()); geometry.computeVertexNormals(); geometry.computeBoundingBox();
        const box = geometry.boundingBox; if (!box) throw new Error("Could not read model bounds.");
        const height = box.max.z - box.min.z;
        geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z);
        const triangles = Math.floor((geometry.getAttribute("position")?.count ?? 0) / 3);
        const attr = new THREE.BufferAttribute(new Float32Array(triangles * 9), 3); geometry.setAttribute("color", attr);
        const ids = new Uint8Array(triangles); const primer = new THREE.Color(PALETTE[0][1]);
        for (let i = 0; i < attr.count; i += 1) attr.setXYZ(i, primer.r, primer.g, primer.b); attr.needsUpdate = true;
        setStatus(`Analyzing ${triangles.toLocaleString()} triangles…`);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const topo = buildTopology(geometry); if (cancelled) { geometry.dispose(); return; }
        const next = { geometry, name: sourceFile.name, triangles, height }; modelRef.current = next; setModel(next); setTopology(topo); setPaintIds(ids); setResetKey((v) => v + 1); setStatus("Ready. Use View to position the model, then Paint to color it.");
      } catch (e) { setStatus(e instanceof Error ? e.message : "Could not prepare painter."); }
    };
    void load(); return () => { cancelled = true; };
  }, [sourceFile]);
  useEffect(() => () => modelRef.current?.geometry.dispose(), []);

  const repaint = useCallback((indices: ArrayLike<number>) => {
    if (!model || !paintIds) return; const attr = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (let k = 0; k < indices.length; k += 1) { const t = indices[k]; const c = new THREE.Color(PALETTE[paintIds[t] ?? 0][1]); const o = t * 3; attr.setXYZ(o, c.r, c.g, c.b); attr.setXYZ(o + 1, c.r, c.g, c.b); attr.setXYZ(o + 2, c.r, c.g, c.b); }
    attr.needsUpdate = true;
  }, [model, paintIds]);

  const applyPaint = useCallback((indices: number[]) => {
    if (!paintIds || !indices.length) return; const before = new Uint8Array(indices.length); const list = new Uint32Array(indices.length);
    indices.forEach((t, i) => { list[i] = t; before[i] = paintIds[t]; paintIds[t] = materialId; });
    setUndo((items) => [...items.slice(-29), { indices: list, before }]); repaint(list);
  }, [materialId, paintIds, repaint]);
  const undoLast = () => { if (!paintIds || !undo.length) return; const entry = undo[undo.length - 1]; for (let i = 0; i < entry.indices.length; i += 1) paintIds[entry.indices[i]] = entry.before[i]; repaint(entry.indices); setUndo((items) => items.slice(0, -1)); };
  const resetPaint = () => {
    if (!paintIds || !model) return;
    paintIds.fill(0);
    const attr = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    const primer = new THREE.Color(PALETTE[0][1]);
    for (let i = 0; i < attr.count; i += 1) attr.setXYZ(i, primer.r, primer.g, primer.b);
    attr.needsUpdate = true;
    setUndo([]);
  };

  if (!sourceFile) return <div className="rounded-[28px] border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-slate-500">Choose a saved miniature above to start the painter experiment.</div>;

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
    <div className="overflow-hidden rounded-[30px] border border-slate-800 bg-[#080d13]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
        <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-300">Miniature Painter v0.1</p><p className="mt-1 text-sm font-bold text-slate-200">{model?.name ?? "Preparing model…"}</p></div>
        <div className="flex gap-2"><button onClick={() => setPaintMode(false)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${!paintMode ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-slate-700 text-slate-400"}`}>View</button><button onClick={() => setPaintMode(true)} disabled={!model} className={`rounded-xl border px-3 py-2 text-xs font-bold ${paintMode ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200" : "border-slate-700 text-slate-400"}`}>Paint</button><button onClick={() => setResetKey((v) => v + 1)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400">Reset view</button></div>
      </div>
      <div className="relative h-[68vh] min-h-[560px] max-h-[850px]">
        {model && topology && paintIds ? <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 32 }}><color attach="background" args={["#0a0f16"]} /><ambientLight intensity={1.25} /><directionalLight position={[40, 70, 35]} intensity={3} /><directionalLight position={[-30, 20, -25]} intensity={1.2} /><PaintMesh model={model} topology={topology} paintIds={paintIds} tool={tool} materialId={materialId} angle={angle} radius={radius} paintMode={paintMode} resetKey={resetKey} onPaint={applyPaint} onPick={setMaterialId} onPreview={setPreviewCount} /></Canvas> : <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-400">{status}</div>}
        {model ? <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-950/80 px-4 py-2 text-[11px] text-slate-400">{paintMode ? `${previewCount.toLocaleString()} triangles in preview · click to paint` : "Drag to orbit · wheel to zoom · switch to Paint when ready"}</div> : null}
      </div>
    </div>
    <aside className="space-y-4">
      <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Tools</p><div className="mt-3 grid grid-cols-2 gap-2">{([['smart','Smart'],['brush','Brush'],['triangle','Triangle'],['shell','Shell'],['picker','Picker']] as const).map(([id,label]) => <button key={id} onClick={() => setTool(id)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${tool===id?'border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-100':'border-slate-700 text-slate-400'}`}>{label}</button>)}</div>{tool==='smart'?<label className="mt-4 block text-xs text-slate-500">Edge threshold <b className="float-right text-slate-300">{angle}°</b><input type="range" min="3" max="80" value={angle} onChange={(e)=>setAngle(Number(e.target.value))} className="mt-2 w-full" /></label>:null}{tool==='brush'?<label className="mt-4 block text-xs text-slate-500">Brush radius <b className="float-right text-slate-300">{radius.toFixed(1)} mm</b><input type="range" min="0.5" max="12" step="0.5" value={radius} onChange={(e)=>setRadius(Number(e.target.value))} className="mt-2 w-full" /></label>:null}</div>
      <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5"><p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">Materials</p><div className="mt-3 grid grid-cols-4 gap-2">{PALETTE.map(([name,color],i)=><button key={name} title={name} aria-label={name} onClick={()=>setMaterialId(i)} className={`aspect-square rounded-xl border-2 ${materialId===i?'border-cyan-300':'border-slate-700'}`} style={{background:color}} />)}</div><p className="mt-3 text-xs font-bold text-slate-300">{PALETTE[materialId][0]}</p></div>
      <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5"><div className="grid grid-cols-2 gap-2"><button onClick={undoLast} disabled={!undo.length} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30">Undo</button><button onClick={resetPaint} disabled={!paintIds} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30">Reset paint</button></div><p className="mt-3 text-[11px] leading-5 text-slate-500">Temporary experiment only. It does not save paint to Supabase yet.</p></div>
    </aside>
  </div>;
}