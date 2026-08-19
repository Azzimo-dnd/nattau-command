"use client";

import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import {
  createMiniaturePaintDocument,
  decodeMiniaturePaintIds,
  type MiniaturePaintDocument,
  type MiniaturePaintPaletteEntry,
  type PaletteCategory,
} from "./miniaturePaintData";

type Tool = "smart" | "brush" | "triangle" | "shell" | "picker";
type BrushMode = "surface" | "volume";
type Model = { geometry: THREE.BufferGeometry; name: string; triangles: number; height: number };
type Topology = { adjacency: Int32Array; normals: Float32Array; centroids: Float32Array };
type UndoEntry = { indices: Uint32Array; before: Uint8Array };
type FocusRequest = { id: number; point: [number, number, number] } | null;

type Props = {
  sourceFile: File | null;
  loadedPaintDocument?: MiniaturePaintDocument | null;
  paintLoadKey?: string | number | null;
  loadedSkinName?: string | null;
  canSave?: boolean;
  canMakeDefault?: boolean;
  saveActionLabel?: string;
  saveHelperText?: string;
  saving?: boolean;
  onSavePaintJob?: (document: MiniaturePaintDocument, name: string, makeDefault: boolean) => void | Promise<void>;
};

const BASE_PALETTE: MiniaturePaintPaletteEntry[] = [
  { name: "Primer", color: "#8f949b", category: "Primer" },
  { name: "Pale skin", color: "#e7c5ae", category: "Skin" },
  { name: "Fair skin", color: "#d6a98c", category: "Skin" },
  { name: "Warm skin", color: "#c58d6c", category: "Skin" },
  { name: "Tan skin", color: "#a96f50", category: "Skin" },
  { name: "Olive skin", color: "#9a7657", category: "Skin" },
  { name: "Brown skin", color: "#704a37", category: "Skin" },
  { name: "Deep skin", color: "#4c3029", category: "Skin" },
  { name: "Orc green", color: "#70845a", category: "Skin" },
  { name: "Tiefling red", color: "#8e4648", category: "Skin" },
  { name: "White cloth", color: "#d8d4c8", category: "Cloth" },
  { name: "Black cloth", color: "#252a30", category: "Cloth" },
  { name: "Crimson", color: "#9d343d", category: "Cloth" },
  { name: "Burgundy", color: "#632f3b", category: "Cloth" },
  { name: "Rust orange", color: "#a85f36", category: "Cloth" },
  { name: "Ochre", color: "#b58a3c", category: "Cloth" },
  { name: "Forest green", color: "#485d43", category: "Cloth" },
  { name: "Emerald", color: "#39705d", category: "Cloth" },
  { name: "Royal blue", color: "#405f94", category: "Cloth" },
  { name: "Navy", color: "#303e61", category: "Cloth" },
  { name: "Purple", color: "#67466f", category: "Cloth" },
  { name: "Rose", color: "#a65b6f", category: "Cloth" },
  { name: "Light leather", color: "#94684c", category: "Leather" },
  { name: "Leather", color: "#69422f", category: "Leather" },
  { name: "Dark leather", color: "#402c25", category: "Leather" },
  { name: "Red leather", color: "#6f3b34", category: "Leather" },
  { name: "Iron", color: "#555d62", category: "Metal" },
  { name: "Steel", color: "#7c8991", category: "Metal" },
  { name: "Silver", color: "#abb4b7", category: "Metal" },
  { name: "Gold", color: "#c69a3c", category: "Metal" },
  { name: "Bronze", color: "#8b6442", category: "Metal" },
  { name: "Copper", color: "#a36248", category: "Metal" },
  { name: "Blackened steel", color: "#353b40", category: "Metal" },
  { name: "Bone", color: "#c5b995", category: "Natural" },
  { name: "Ivory", color: "#d5c9aa", category: "Natural" },
  { name: "Oak", color: "#866344", category: "Natural" },
  { name: "Dark wood", color: "#4b3528", category: "Natural" },
  { name: "Stone", color: "#76736d", category: "Natural" },
  { name: "Obsidian", color: "#252a31", category: "Natural" },
  { name: "Arcane blue", color: "#3d8fc2", category: "Magic" },
  { name: "Ghost cyan", color: "#63c7c6", category: "Magic" },
  { name: "Poison green", color: "#72a84f", category: "Magic" },
  { name: "Infernal red", color: "#b44332", category: "Magic" },
  { name: "Void purple", color: "#704ba2", category: "Magic" },
];

const CATEGORY_TABS: Array<"All" | PaletteCategory> = ["All", "Skin", "Cloth", "Leather", "Metal", "Natural", "Magic", "Custom"];
const SURFACE_EDGE_ANGLE = 62;
const MAX_PALETTE_SIZE = 250;

function buildTopology(geometry: THREE.BufferGeometry): Topology {
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  const triangleCount = Math.floor(position.count / 3);
  const adjacency = new Int32Array(triangleCount * 3);
  adjacency.fill(-1);
  const normals = new Float32Array(triangleCount * 3);
  const centroids = new Float32Array(triangleCount * 3);

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const maxDimension = box ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) : 100;
  const quantize = 1 / Math.max(0.00001, maxDimension * 0.00001);
  const vertexMap = new Map<string, number>();
  const vertexIds = new Uint32Array(position.count);
  let nextVertexId = 0;

  for (let index = 0; index < position.count; index += 1) {
    const key = `${Math.round(position.getX(index) * quantize)}|${Math.round(position.getY(index) * quantize)}|${Math.round(position.getZ(index) * quantize)}`;
    let vertexId = vertexMap.get(key);
    if (vertexId === undefined) {
      vertexId = nextVertexId;
      nextVertexId += 1;
      vertexMap.set(key, vertexId);
    }
    vertexIds[index] = vertexId;
  }

  const edgeBase = nextVertexId + 1;
  const edgeMap = new Map<number, number>();
  const edgeKey = (left: number, right: number) => Math.min(left, right) * edgeBase + Math.max(left, right);

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const a = new THREE.Vector3(position.getX(offset), position.getY(offset), position.getZ(offset));
    const b = new THREE.Vector3(position.getX(offset + 1), position.getY(offset + 1), position.getZ(offset + 1));
    const c = new THREE.Vector3(position.getX(offset + 2), position.getY(offset + 2), position.getZ(offset + 2));
    const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    normals.set([normal.x, normal.y, normal.z], offset);
    centroids.set([(a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3, (a.z + b.z + c.z) / 3], offset);

    const pairs = [
      [vertexIds[offset], vertexIds[offset + 1]],
      [vertexIds[offset + 1], vertexIds[offset + 2]],
      [vertexIds[offset + 2], vertexIds[offset]],
    ] as const;

    for (let slot = 0; slot < 3; slot += 1) {
      const key = edgeKey(pairs[slot][0], pairs[slot][1]);
      const packed = offset + slot;
      const previous = edgeMap.get(key);
      if (previous === undefined) edgeMap.set(key, packed);
      else {
        adjacency[packed] = Math.floor(previous / 3);
        adjacency[previous] = triangle;
        edgeMap.delete(key);
      }
    }
  }

  return { adjacency, normals, centroids };
}

function CameraRig({ height, paintMode, resetKey, spaceHeld, shiftHeld, focusRequest }: {
  height: number;
  paintMode: boolean;
  resetKey: number;
  spaceHeld: boolean;
  shiftHeld: boolean;
  focusRequest: FocusRequest;
}) {
  const { camera, gl } = useThree();
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.screenSpacePanning = true;
    controls.zoomToCursor = true;
    controls.minPolarAngle = 0.08;
    controls.maxPolarAngle = Math.PI * 0.98;
    controlsRef.current = controls;

    let frame = 0;
    const tick = () => {
      controls.update();
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
      controlsRef.current = null;
    };
  }, [camera, gl]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (paintMode) {
      controls.mouseButtons.LEFT = spaceHeld ? (shiftHeld ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE) : null;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
      controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    } else {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    }
  }, [paintMode, shiftHeld, spaceHeld]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const distance = Math.max(52, height * 1.8);
    camera.position.set(distance * 0.75, Math.max(24, height * 0.72), distance * 0.92);
    camera.near = 0.1;
    camera.far = 2000;
    camera.updateProjectionMatrix();
    controls.target.set(0, Math.max(8, height * 0.42), 0);
    controls.minDistance = Math.max(10, height * 0.22);
    controls.maxDistance = Math.max(140, height * 5.2);
    controls.update();
  }, [camera, height, resetKey]);

  useEffect(() => {
    if (!focusRequest || !controlsRef.current) return;
    controlsRef.current.target.set(...focusRequest.point);
    controlsRef.current.update();
  }, [focusRequest]);

  return null;
}

function PaintMesh({ model, topology, paintIds, palette, tool, materialId, angle, radius, brushMode, paintMode, navigationActive, resetKey, spaceHeld, shiftHeld, focusRequest, onPaint, onPick, onPreview, onHoverPoint }: {
  model: Model;
  topology: Topology;
  paintIds: Uint8Array;
  palette: MiniaturePaintPaletteEntry[];
  tool: Tool;
  materialId: number;
  angle: number;
  radius: number;
  brushMode: BrushMode;
  paintMode: boolean;
  navigationActive: boolean;
  resetKey: number;
  spaceHeld: boolean;
  shiftHeld: boolean;
  focusRequest: FocusRequest;
  onPaint: (indices: number[]) => void;
  onPick: (id: number) => void;
  onPreview: (count: number) => void;
  onHoverPoint: (point: [number, number, number] | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const previewRef = useRef<number[]>([]);
  const hoverKeyRef = useRef("");
  const colors = useMemo(() => palette.map((entry) => new THREE.Color(entry.color)), [palette]);

  const restore = useCallback((clearHoverKey = true) => {
    const colorAttribute = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (const triangle of previewRef.current) {
      const color = colors[paintIds[triangle] ?? 0] ?? colors[0];
      const offset = triangle * 3;
      colorAttribute.setXYZ(offset, color.r, color.g, color.b);
      colorAttribute.setXYZ(offset + 1, color.r, color.g, color.b);
      colorAttribute.setXYZ(offset + 2, color.r, color.g, color.b);
    }
    colorAttribute.needsUpdate = true;
    previewRef.current = [];
    if (clearHoverKey) hoverKeyRef.current = "";
    onPreview(0);
  }, [colors, model.geometry, onPreview, paintIds]);

  const collect = useCallback((seed: number, point: THREE.Vector3, activeTool: Tool) => {
    if (seed < 0 || seed >= paintIds.length) return [];
    if (activeTool === "triangle" || activeTool === "picker") return [seed];

    const queue = new Uint32Array(paintIds.length);
    const visited = new Uint8Array(paintIds.length);
    const result: number[] = [];
    let head = 0;
    let tail = 1;
    queue[0] = seed;
    visited[seed] = 1;
    const seedMaterial = paintIds[seed];
    const smartThreshold = Math.cos((angle * Math.PI) / 180);
    const surfaceThreshold = Math.cos((SURFACE_EDGE_ANGLE * Math.PI) / 180);
    const radiusSquared = radius * radius;

    while (head < tail) {
      const triangle = queue[head++];
      const offset = triangle * 3;
      if (activeTool === "brush") {
        const dx = topology.centroids[offset] - point.x;
        const dy = topology.centroids[offset + 1] - point.y;
        const dz = topology.centroids[offset + 2] - point.z;
        if (dx * dx + dy * dy + dz * dz > radiusSquared) continue;
      }
      result.push(triangle);

      for (let slot = 0; slot < 3; slot += 1) {
        const neighbor = topology.adjacency[offset + slot];
        if (neighbor < 0 || visited[neighbor]) continue;
        const neighborOffset = neighbor * 3;
        if (activeTool === "smart") {
          if (paintIds[neighbor] !== seedMaterial) continue;
          const dot = topology.normals[offset] * topology.normals[neighborOffset]
            + topology.normals[offset + 1] * topology.normals[neighborOffset + 1]
            + topology.normals[offset + 2] * topology.normals[neighborOffset + 2];
          if (dot < smartThreshold) continue;
        }
        if (activeTool === "brush") {
          const dx = topology.centroids[neighborOffset] - point.x;
          const dy = topology.centroids[neighborOffset + 1] - point.y;
          const dz = topology.centroids[neighborOffset + 2] - point.z;
          if (dx * dx + dy * dy + dz * dz > radiusSquared) continue;
          if (brushMode === "surface") {
            const dot = topology.normals[offset] * topology.normals[neighborOffset]
              + topology.normals[offset + 1] * topology.normals[neighborOffset + 1]
              + topology.normals[offset + 2] * topology.normals[neighborOffset + 2];
            if (dot < surfaceThreshold) continue;
          }
        }
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    return result;
  }, [angle, brushMode, paintIds, radius, topology]);

  const regionFromEvent = useCallback((event: ThreeEvent<MouseEvent | PointerEvent>, activeTool: Tool) => {
    const face = event.faceIndex ?? -1;
    if (face < 0) return [];
    return collect(face, meshRef.current.worldToLocal(event.point.clone()), activeTool);
  }, [collect]);

  const preview = useCallback((indices: number[]) => {
    if (previewRef.current.length) restore(false);
    previewRef.current = indices;
    const colorAttribute = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    const base = colors[materialId] ?? colors[0];
    const highlight = base.clone().lerp(new THREE.Color("#55e7ff"), 0.42);
    for (const triangle of indices) {
      const offset = triangle * 3;
      colorAttribute.setXYZ(offset, highlight.r, highlight.g, highlight.b);
      colorAttribute.setXYZ(offset + 1, highlight.r, highlight.g, highlight.b);
      colorAttribute.setXYZ(offset + 2, highlight.r, highlight.g, highlight.b);
    }
    colorAttribute.needsUpdate = true;
    onPreview(indices.length);
  }, [colors, materialId, model.geometry, onPreview, restore]);

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={model.geometry}
        rotation={[-Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
        onPointerMove={(event) => {
          onHoverPoint([event.point.x, event.point.y, event.point.z]);
          if (!paintMode || navigationActive || tool === "picker" || event.buttons !== 0) {
            if (previewRef.current.length) restore();
            return;
          }
          event.stopPropagation();
          const face = event.faceIndex ?? -1;
          if (face < 0) return;
          const hit = event.point;
          const key = `${face}:${tool}:${brushMode}:${angle}:${radius}:${materialId}:${Math.round(hit.x * 2)}:${Math.round(hit.y * 2)}:${Math.round(hit.z * 2)}`;
          if (key === hoverKeyRef.current) return;
          hoverKeyRef.current = key;
          preview(regionFromEvent(event, tool));
        }}
        onPointerOut={() => {
          onHoverPoint(null);
          if (paintMode) restore();
        }}
        onClick={(event) => {
          if (!paintMode || navigationActive) return;
          event.stopPropagation();
          const face = event.faceIndex ?? -1;
          if (face < 0) return;
          const native = event.nativeEvent;
          if (native.altKey || tool === "picker") {
            onPick(paintIds[face] ?? 0);
            restore();
            return;
          }
          const activeTool: Tool = native.ctrlKey || native.metaKey ? "smart" : tool;
          const region = regionFromEvent(event, activeTool);
          restore();
          onPaint(region);
        }}
      >
        <meshStandardMaterial vertexColors roughness={0.64} metalness={0.08} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.18, 0]}>
        <circleGeometry args={[46, 96]} />
        <meshStandardMaterial color="#151b22" roughness={0.96} />
      </mesh>
      <gridHelper args={[140, 28, "#344253", "#17202a"]} position={[0, -0.1, 0]} />
      <CameraRig height={model.height} paintMode={paintMode} resetKey={resetKey} spaceHeld={spaceHeld} shiftHeld={shiftHeld} focusRequest={focusRequest} />
    </>
  );
}

function paintAll(geometry: THREE.BufferGeometry, ids: Uint8Array, palette: MiniaturePaintPaletteEntry[]) {
  const colorAttribute = geometry.getAttribute("color") as THREE.BufferAttribute;
  const colors = palette.map((entry) => new THREE.Color(entry.color));
  for (let triangle = 0; triangle < ids.length; triangle += 1) {
    const color = colors[ids[triangle] ?? 0] ?? colors[0];
    const offset = triangle * 3;
    colorAttribute.setXYZ(offset, color.r, color.g, color.b);
    colorAttribute.setXYZ(offset + 1, color.r, color.g, color.b);
    colorAttribute.setXYZ(offset + 2, color.r, color.g, color.b);
  }
  colorAttribute.needsUpdate = true;
}

export function MiniaturePainter({
  sourceFile,
  loadedPaintDocument = null,
  paintLoadKey = null,
  loadedSkinName = null,
  canSave = false,
  canMakeDefault = false,
  saveActionLabel = "Save as new skin",
  saveHelperText = "Saved skins never alter the STL. Loading an existing skin and saving again creates a new version.",
  saving = false,
  onSavePaintJob,
}: Props) {
  const [model, setModel] = useState<Model | null>(null);
  const modelRef = useRef<Model | null>(null);
  const [topology, setTopology] = useState<Topology | null>(null);
  const [paintIds, setPaintIds] = useState<Uint8Array | null>(null);
  const [palette, setPalette] = useState<MiniaturePaintPaletteEntry[]>(() => [...BASE_PALETTE]);
  const paletteColors = useMemo(() => palette.map((entry) => new THREE.Color(entry.color)), [palette]);
  const [tool, setTool] = useState<Tool>("smart");
  const [materialId, setMaterialId] = useState(12);
  const [angle, setAngle] = useState(28);
  const [radius, setRadius] = useState(3.5);
  const [brushMode, setBrushMode] = useState<BrushMode>("surface");
  const [paintMode, setPaintMode] = useState(false);
  const [previewCount, setPreviewCount] = useState(0);
  const [undo, setUndo] = useState<UndoEntry[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [status, setStatus] = useState("Choose a saved miniature above.");
  const [activeCategory, setActiveCategory] = useState<"All" | PaletteCategory>("All");
  const [customColor, setCustomColor] = useState("#d16b9e");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const [skinName, setSkinName] = useState("");
  const hoverPointRef = useRef<[number, number, number] | null>(null);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => target instanceof HTMLElement
      && Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
    const keyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      if (event.key === "Shift") setShiftHeld(true);
      if (event.code === "Space") {
        event.preventDefault();
        setSpaceHeld(true);
        setShiftHeld(event.shiftKey);
      }
      if (event.key.toLowerCase() === "f" && hoverPointRef.current) {
        event.preventDefault();
        const point: [number, number, number] = [...hoverPointRef.current];
        setFocusRequest((previous) => ({ id: (previous?.id ?? 0) + 1, point }));
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") setShiftHeld(false);
      if (event.code === "Space") setSpaceHeld(false);
    };
    const blur = () => { setSpaceHeld(false); setShiftHeld(false); };
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (modelRef.current) {
        modelRef.current.geometry.dispose();
        modelRef.current = null;
      }
      setModel(null);
      setTopology(null);
      setPaintIds(null);
      setPalette([...BASE_PALETTE]);
      setUndo([]);
      setPreviewCount(0);
      setSkinName("");
      hoverPointRef.current = null;
      if (!sourceFile) return;

      setStatus("Reading STL…");
      try {
        const geometry = new STLLoader().parse(await sourceFile.arrayBuffer());
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;
        if (!box) throw new Error("Could not read model bounds.");
        const height = box.max.z - box.min.z;
        geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z);
        const triangles = Math.floor((geometry.getAttribute("position")?.count ?? 0) / 3);
        const colorAttribute = new THREE.BufferAttribute(new Float32Array(triangles * 9), 3);
        geometry.setAttribute("color", colorAttribute);
        const ids = new Uint8Array(triangles);
        paintAll(geometry, ids, BASE_PALETTE);

        setStatus(`Analyzing ${triangles.toLocaleString()} triangles…`);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const nextTopology = buildTopology(geometry);
        if (cancelled) {
          geometry.dispose();
          return;
        }
        const nextModel = { geometry, name: sourceFile.name, triangles, height };
        modelRef.current = nextModel;
        setModel(nextModel);
        setTopology(nextTopology);
        setPaintIds(ids);
        setResetKey((value) => value + 1);
        setStatus("Ready. Camera remains available while painting.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not prepare painter.");
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [sourceFile]);

  useEffect(() => () => modelRef.current?.geometry.dispose(), []);

  useEffect(() => {
    if (!model || !paintIds) return;
    if (!loadedPaintDocument) {
      paintIds.fill(0);
      setPalette([...BASE_PALETTE]);
      paintAll(model.geometry, paintIds, BASE_PALETTE);
      setUndo([]);
      setMaterialId(12);
      setSkinName("");
      setStatus("Original unpainted miniature loaded.");
      return;
    }
    if (loadedPaintDocument.triangleCount !== model.triangles) {
      setStatus("This skin belongs to a different miniature version and cannot be applied.");
      return;
    }
    try {
      const nextIds = decodeMiniaturePaintIds(loadedPaintDocument);
      paintIds.set(nextIds);
      setPalette(loadedPaintDocument.palette.map((entry) => ({ ...entry })));
      paintAll(model.geometry, paintIds, loadedPaintDocument.palette);
      setUndo([]);
      setMaterialId(0);
      setSkinName(loadedSkinName && loadedSkinName !== "Original / unpainted" ? loadedSkinName : "");
      setStatus(`${loadedSkinName ?? "Saved skin"} loaded. Changes can be saved from here.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not apply saved skin.");
    }
  }, [loadedPaintDocument, loadedSkinName, model, paintIds, paintLoadKey]);

  const repaint = useCallback((indices: ArrayLike<number>) => {
    if (!model || !paintIds) return;
    const colorAttribute = model.geometry.getAttribute("color") as THREE.BufferAttribute;
    for (let index = 0; index < indices.length; index += 1) {
      const triangle = indices[index];
      const color = paletteColors[paintIds[triangle] ?? 0] ?? paletteColors[0];
      const offset = triangle * 3;
      colorAttribute.setXYZ(offset, color.r, color.g, color.b);
      colorAttribute.setXYZ(offset + 1, color.r, color.g, color.b);
      colorAttribute.setXYZ(offset + 2, color.r, color.g, color.b);
    }
    colorAttribute.needsUpdate = true;
  }, [model, paintIds, paletteColors]);

  const applyPaint = useCallback((indices: number[]) => {
    if (!paintIds || !indices.length) return;
    const before = new Uint8Array(indices.length);
    const list = new Uint32Array(indices.length);
    indices.forEach((triangle, index) => {
      list[index] = triangle;
      before[index] = paintIds[triangle];
      paintIds[triangle] = materialId;
    });
    setUndo((items) => [...items.slice(-29), { indices: list, before }]);
    repaint(list);
  }, [materialId, paintIds, repaint]);

  const undoLast = () => {
    if (!paintIds || !undo.length) return;
    const entry = undo[undo.length - 1];
    for (let index = 0; index < entry.indices.length; index += 1) paintIds[entry.indices[index]] = entry.before[index];
    repaint(entry.indices);
    setUndo((items) => items.slice(0, -1));
  };

  const resetPaint = () => {
    if (!paintIds || !model) return;
    paintIds.fill(0);
    setPalette([...BASE_PALETTE]);
    paintAll(model.geometry, paintIds, BASE_PALETTE);
    setMaterialId(12);
    setUndo([]);
  };

  const addCustomSwatch = () => {
    if (palette.length >= MAX_PALETTE_SIZE) return;
    const existing = palette.findIndex((entry) => entry.category === "Custom" && entry.color.toLowerCase() === customColor.toLowerCase());
    if (existing >= 0) {
      setMaterialId(existing);
      setActiveCategory("Custom");
      return;
    }
    const nextIndex = palette.length;
    setPalette((entries) => [...entries, {
      name: `Custom ${entries.filter((entry) => entry.category === "Custom").length + 1}`,
      color: customColor,
      category: "Custom",
    }]);
    setMaterialId(nextIndex);
    setActiveCategory("Custom");
  };

  const saveSkin = async (makeDefault: boolean) => {
    if (!model || !paintIds || !onSavePaintJob || !skinName.trim()) return;
    const document = createMiniaturePaintDocument(model.triangles, palette, paintIds);
    await onSavePaintJob(document, skinName.trim(), makeDefault);
  };

  const visiblePalette = palette
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => activeCategory === "All" || entry.category === activeCategory);

  if (!sourceFile) return <div className="rounded-[28px] border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center text-slate-500">Choose a saved miniature above to start painting.</div>;

  const navigationActive = paintMode && spaceHeld;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="overflow-hidden rounded-[30px] border border-slate-800 bg-[#080d13]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-fuchsia-300">Miniature Painter v0.4</p>
            <p className="mt-1 text-sm font-bold text-slate-200">{model?.name ?? "Preparing model…"}</p>
            <p className="mt-1 text-[11px] text-slate-600">{status}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPaintMode(false)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${!paintMode ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200" : "border-slate-700 text-slate-400"}`}>View</button>
            <button type="button" onClick={() => setPaintMode(true)} disabled={!model} className={`rounded-xl border px-3 py-2 text-xs font-bold ${paintMode ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-200" : "border-slate-700 text-slate-400"}`}>Paint</button>
            <button type="button" onClick={() => setResetKey((value) => value + 1)} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-400">Reset view</button>
          </div>
        </div>

        <div className={`relative h-[70vh] min-h-[580px] max-h-[900px] ${navigationActive ? "cursor-grabbing" : paintMode ? "cursor-crosshair" : "cursor-grab"}`} onContextMenu={(event) => event.preventDefault()}>
          {model && topology && paintIds ? (
            <Canvas shadows dpr={[1, 1.5]} camera={{ fov: 32 }}>
              <color attach="background" args={["#0a0f16"]} />
              <ambientLight intensity={1.25} />
              <directionalLight position={[40, 70, 35]} intensity={3} />
              <directionalLight position={[-30, 20, -25]} intensity={1.2} />
              <PaintMesh model={model} topology={topology} paintIds={paintIds} palette={palette} tool={tool} materialId={materialId} angle={angle} radius={radius} brushMode={brushMode} paintMode={paintMode} navigationActive={navigationActive} resetKey={resetKey} spaceHeld={spaceHeld} shiftHeld={shiftHeld} focusRequest={focusRequest} onPaint={applyPaint} onPick={setMaterialId} onPreview={setPreviewCount} onHoverPoint={(point) => { hoverPointRef.current = point; }} />
            </Canvas>
          ) : <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-400">{status}</div>}
          {model ? <div className="pointer-events-none absolute bottom-4 left-1/2 max-w-[92%] -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-950/85 px-4 py-2 text-center text-[11px] leading-5 text-slate-400 backdrop-blur">{paintMode ? `${previewCount.toLocaleString()} triangles · LMB paint · RMB orbit · MMB pan · wheel zoom-to-cursor · Space+LMB orbit · Shift+Space+LMB pan · F focus · Alt+click pick · Ctrl+click Smart` : "LMB orbit · MMB zoom · RMB pan · wheel zoom-to-cursor · hover a detail and press F to make it the camera pivot"}</div> : null}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">Tools</p>
          <div className="mt-3 grid grid-cols-2 gap-2">{([['smart', 'Smart'], ['brush', 'Brush'], ['triangle', 'Triangle'], ['shell', 'Shell'], ['picker', 'Picker']] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setTool(id)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${tool === id ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-100" : "border-slate-700 text-slate-400"}`}>{label}</button>)}</div>
          {tool === "smart" ? <label className="mt-4 block text-xs text-slate-500">Edge threshold <b className="float-right text-slate-300">{angle}°</b><input type="range" min="3" max="80" value={angle} onChange={(event) => setAngle(Number(event.target.value))} className="mt-2 w-full" /></label> : null}
          {tool === "brush" ? <div className="mt-4 space-y-4"><div><p className="text-xs font-semibold text-slate-500">Brush behaviour</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setBrushMode("surface")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${brushMode === "surface" ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100" : "border-slate-700 text-slate-400"}`}>Surface</button><button type="button" onClick={() => setBrushMode("volume")} className={`rounded-xl border px-3 py-2 text-xs font-bold ${brushMode === "volume" ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-100" : "border-slate-700 text-slate-400"}`}>Volume</button></div></div><label className="block text-xs text-slate-500">Brush radius <b className="float-right text-slate-300">{radius.toFixed(1)} mm</b><input type="range" min="0.5" max="12" step="0.5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} className="mt-2 w-full" /></label></div> : null}
        </div>

        <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">Colors</p><p className="mt-1 text-[11px] text-slate-600">{palette.length} swatches</p></div><div className="h-9 w-9 rounded-xl border-2 border-cyan-300" style={{ background: palette[materialId]?.color ?? palette[0].color }} /></div>
          <div className="mt-3 flex flex-wrap gap-1.5">{CATEGORY_TABS.map((category) => <button key={category} type="button" onClick={() => setActiveCategory(category)} className={`rounded-lg border px-2 py-1 text-[10px] font-bold ${activeCategory === category ? "border-yellow-400/40 bg-yellow-400/10 text-yellow-100" : "border-slate-800 text-slate-500"}`}>{category}</button>)}</div>
          <div className="mt-3 max-h-64 overflow-y-auto pr-1"><div className="grid grid-cols-5 gap-2">{visiblePalette.map(({ entry, index }) => <button key={`${entry.name}-${index}`} type="button" title={entry.name} aria-label={entry.name} onClick={() => setMaterialId(index)} className={`aspect-square rounded-xl border-2 ${materialId === index ? "border-cyan-300 ring-2 ring-cyan-300/20" : "border-slate-700"}`} style={{ background: entry.color }} />)}</div></div>
          <p className="mt-3 text-xs font-bold text-slate-300">{palette[materialId]?.name ?? "Primer"}</p>
          <div className="mt-4 rounded-2xl border border-slate-800 bg-black/15 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Custom swatch</p><div className="mt-2 flex items-center gap-3"><input type="color" value={customColor} onChange={(event) => setCustomColor(event.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-700 bg-transparent p-1" aria-label="Custom color" /><span className="text-xs font-bold uppercase text-slate-400">{customColor}</span></div><button type="button" onClick={addCustomSwatch} className="mt-2 min-h-9 w-full rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 text-xs font-bold text-cyan-100">Add custom color</button></div>
        </div>

        <div className="rounded-[26px] border border-slate-800 bg-slate-900/75 p-5"><div className="grid grid-cols-2 gap-2"><button type="button" onClick={undoLast} disabled={!undo.length} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30">Undo</button><button type="button" onClick={resetPaint} disabled={!paintIds} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-30">Reset paint</button></div></div>

        {canSave ? (
          <div className="rounded-[26px] border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Save skin</p>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{saveHelperText}</p>
            <input value={skinName} maxLength={80} onChange={(event) => setSkinName(event.target.value)} placeholder="e.g. Kainalia armour" className="mt-3 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 outline-none focus:border-emerald-400/60" />
            <div className="mt-3 grid gap-2">
              <button type="button" disabled={!model || !skinName.trim() || saving} onClick={() => void saveSkin(false)} className="min-h-11 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 text-xs font-black text-emerald-100 disabled:opacity-30">{saving ? "Saving…" : saveActionLabel}</button>
              {canMakeDefault ? <button type="button" disabled={!model || !skinName.trim() || saving} onClick={() => void saveSkin(true)} className="min-h-11 rounded-xl bg-emerald-400 px-4 text-xs font-black text-slate-950 disabled:opacity-30">Save & make default</button> : null}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
