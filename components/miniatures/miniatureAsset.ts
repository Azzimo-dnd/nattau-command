import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";
import { loadMiniatureGeometry } from "./miniatureModelFiles";
import { applyMiniaturePaintDocumentToGeometry, type MiniaturePaintDocument } from "./miniaturePaintData";
import { glbCalibration, MAX_MINIATURE_BYTES, MINIATURE_FOOTPRINT, miniatureFileFormat, readGlb } from "./miniatureGlb";

export type MiniatureAsset = {
  scene: THREE.Group;
  width: number;
  depth: number;
  height: number;
  triangles: number;
  meshCount: number;
  format: "stl" | "glb";
  baseScale: number;
  visualScale: number;
  originalMaterials: boolean;
};

/** Full, Y-up scene used by previews and the VTT. Never flatten imported GLBs. */
export async function loadMiniatureAsset(file: File, paint?: MiniaturePaintDocument | null): Promise<MiniatureAsset> {
  if (!file.size || file.size > MAX_MINIATURE_BYTES) throw new Error("Choose a non-empty miniature file up to 50 MB.");
  const format = miniatureFileFormat(file.name);
  let source: THREE.Object3D;
  let visualScale = 1;
  let originalMaterials = format === "glb";
  if (format === "glb" && !paint) {
    const buffer = await file.arrayBuffer();
    const { json } = readGlb(buffer);
    const calibration = glbCalibration(json);
    visualScale = calibration.visualScale;
    originalMaterials = calibration.sourceFormat !== "stl";
    const manager = new THREE.LoadingManager();
    let resourceFailed = false;
    manager.onError = () => { resourceFailed = true; };
    manager.setURLModifier((url) => {
      if (url.startsWith("blob:") || url.startsWith("data:")) return url;
      throw new Error("GLB textures must be embedded in the model.");
    });
    const loader = new GLTFLoader(manager);
    if (json.extensionsRequired?.includes("EXT_meshopt_compression")) {
      const { MeshoptDecoder } = await import("three/addons/libs/meshopt_decoder.module.js");
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
    const gltf = await loader.parseAsync(buffer, "");
    if (resourceFailed) { disposeMiniatureScene(gltf.scene); throw new Error("A GLB texture could not be decoded. Export with embedded PNG/JPEG textures."); }
    source = gltf.scene;
  } else {
    const loaded = await loadMiniatureGeometry(file);
    // Paint documents rely on the original STL triangle order.
    const painted = paint ? applyMiniaturePaintDocumentToGeometry(loaded.geometry, paint) : false;
    if (paint && !painted) { loaded.geometry.dispose(); throw new Error("This skin belongs to a different miniature version."); }
    source = new THREE.Mesh(loaded.geometry, new THREE.MeshStandardMaterial({ color: painted ? 0xffffff : 0x8f949b, vertexColors: painted, roughness: 0.68, metalness: 0.08 }));
    source.rotation.x = -Math.PI / 2;
    originalMaterials = false;
    if (format === "glb") visualScale = glbCalibration(readGlb(await file.arrayBuffer()).json).visualScale;
  }
  const scene = new THREE.Group();
  scene.add(source);
  try {
    scene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(scene, true);
    const size = box.getSize(new THREE.Vector3());
    if (![...size.toArray(), ...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite) || size.y <= 0 || Math.max(size.x, size.z) <= 0) throw new Error("The model has no usable geometry or has invalid dimensions.");
    // Translate the wrapper, preserving child transforms and skeleton bindings.
    const normalized = new THREE.Group();
    scene.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    normalized.add(scene);
    let triangles = 0;
    let meshCount = 0;
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      meshCount += 1;
      triangles += Math.floor((object.geometry.index?.count ?? object.geometry.getAttribute("position")?.count ?? 0) / 3);
      object.castShadow = true;
      object.receiveShadow = true;
    });
    if (!meshCount) throw new Error("The GLB does not contain a mesh.");
    return { scene: normalized, width: size.x, depth: size.z, height: size.y, triangles, meshCount, format, baseScale: MINIATURE_FOOTPRINT / Math.max(size.x, size.z), visualScale, originalMaterials };
  } catch (error) { disposeMiniatureScene(scene); throw error; }
}

/** Shared geometry/textures; independent materials and skeletons per token. */
export function instantiateMiniature(asset: MiniatureAsset, opacity = 1) {
  const scene = cloneSkeleton(asset.scene);
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const cloneMaterial = (original: THREE.Material) => {
      const material = original.clone();
      if (opacity < 1) {
        material.transparent = true;
        material.opacity *= opacity;
        material.depthWrite = false;
      }
      return material;
    };
    object.material = Array.isArray(object.material) ? object.material.map(cloneMaterial) : cloneMaterial(object.material);
  });
  return scene;
}

export function disposeMiniatureScene(scene: THREE.Object3D, sharedResources = false) {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const images = new Set<ImageBitmap>();
  const skeletons = new Set<THREE.Skeleton>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton);
  });
  materials.forEach((material) => {
    if (!sharedResources) Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
    material.dispose();
  });
  if (!sharedResources) {
    geometries.forEach((geometry) => geometry.dispose());
    textures.forEach((texture) => { if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) images.add(texture.image); texture.dispose(); });
    images.forEach((image) => image.close());
  }
  skeletons.forEach((skeleton) => skeleton.dispose());
}
