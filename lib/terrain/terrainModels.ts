import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { readGlb } from "@/components/miniatures/miniatureGlb";
import { MAX_TERRAIN_BYTES, type TerrainRecipe } from "./terrainTypes";
import { createTerrainModel, disposeTerrainModel } from "./terrainGeometry";

export type TerrainModelMetrics = {
  width: number; depth: number; height: number;
  meshes: number; triangles: number; hasTextures: boolean;
};
export function terrainMetrics(object: THREE.Object3D): TerrainModelMetrics {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object, true);
  const size = bounds.getSize(new THREE.Vector3());
  if (![size.x,size.y,size.z].every((value) => Number.isFinite(value) && value > 0 && value < 1000)) {
    throw new Error("The model has invalid dimensions.");
  }
  let meshes = 0, triangles = 0, hasTextures = false;
  object.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    meshes++;
    const geometry = node.geometry;
    if (!geometry.getAttribute("position")) throw new Error("A mesh has no vertices.");
    triangles += Math.floor((geometry.index?.count ?? geometry.getAttribute("position").count) / 3);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach((mat) => {
      if (mat instanceof THREE.MeshStandardMaterial && mat.map) hasTextures = true;
    });
  });
  if (!meshes || triangles < 1 || triangles > 2000000) throw new Error("Empty or excessively complex model.");
  return { width: size.x, depth: size.z, height: size.y, meshes, triangles, hasTextures };
}
export function validateTerrainFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".glb")) throw new Error("Choose a self-contained .glb file.");
  if (file.size < 20 || file.size > MAX_TERRAIN_BYTES) throw new Error("GLB must be between 20 bytes and 75 MB.");
}
export async function readTerrainFile(file: File) {
  validateTerrainFile(file);
  const buffer = await file.arrayBuffer();
  const { json } = readGlb(buffer);
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith("blob:") || url.startsWith("data:")) return url;
    throw new Error("External resource links are not allowed in terrain GLBs.");
  });
  if (json.extensionsRequired?.includes("EXT_meshopt_compression")) throw new Error("Export the terrain GLB without meshopt compression.");
  const gltf = await new GLTFLoader(manager).parseAsync(buffer, "");
  const root = gltf.scene;
  try {
    const metrics = terrainMetrics(root);
    const normalized = new THREE.Group();
    root.position.set(-metrics.width/2,0,0); // overwritten below using actual transformed bounds
    root.position.set(0,0,0);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root, true);
    root.position.set(-(box.min.x + box.max.x)/2, -box.min.y, -(box.min.z + box.max.z)/2);
    normalized.add(root);
    root.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
    return { model: normalized, metrics };
  } catch (error) {
    disposeTerrainModel(root);
    throw error;
  }
}
export async function generateTerrainFile(recipe: TerrainRecipe, fileName: string) {
  const model = createTerrainModel(recipe);
  try {
    const metrics = terrainMetrics(model);
    const exported = await new GLTFExporter().parseAsync(model, { binary: true, onlyVisible: true, trs: true });
    if (!(exported instanceof ArrayBuffer)) throw new Error("GLB exporter returned an unexpected format.");
    const file = new File([exported], fileName.replace(/[^a-z0-9_-]+/gi,"_").replace(/_+$/,"") + ".glb", { type: "model/gltf-binary" });
    validateTerrainFile(file);
    return { file, metrics };
  } finally { disposeTerrainModel(model); }
}
