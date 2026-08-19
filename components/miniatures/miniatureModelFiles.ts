import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

export type LoadedMiniatureGeometry = {
  geometry: THREE.BufferGeometry;
  name: string;
  format: "stl" | "glb";
  triangles: number;
  height: number;
};

function fileFormat(file: File): "stl" | "glb" {
  return file.name.toLowerCase().endsWith(".glb") ? "glb" : "stl";
}

function normalizeZUpGeometry(geometry: THREE.BufferGeometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) throw new Error("Could not determine model bounds.");
  geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -box.min.z);
  geometry.computeBoundingBox();
  geometry.computeVertexNormals();
  return geometry;
}

async function geometryFromGlb(buffer: ArrayBuffer) {
  const gltf = await new GLTFLoader().parseAsync(buffer, "");
  gltf.scene.updateMatrixWorld(true);

  let sourceMesh: THREE.Mesh | null = null;
  gltf.scene.traverse((object) => {
    if (!sourceMesh && object instanceof THREE.Mesh && object.geometry) sourceMesh = object;
  });
  if (!sourceMesh) throw new Error("The GLB does not contain a mesh.");

  const mesh = sourceMesh as THREE.Mesh;
  let geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  if (geometry.index) {
    const nonIndexed = geometry.toNonIndexed();
    geometry.dispose();
    geometry = nonIndexed;
  }

  // Web derivatives are exported Y-up. Convert back to the painter's canonical Z-up space.
  geometry.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2));
  return normalizeZUpGeometry(geometry);
}

export async function loadMiniatureGeometry(file: File): Promise<LoadedMiniatureGeometry> {
  const format = fileFormat(file);
  let geometry: THREE.BufferGeometry;

  if (format === "glb") {
    geometry = await geometryFromGlb(await file.arrayBuffer());
  } else {
    geometry = new STLLoader().parse(await file.arrayBuffer());
    geometry = normalizeZUpGeometry(geometry);
  }

  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  if (!box) {
    geometry.dispose();
    throw new Error("Could not determine model bounds.");
  }

  return {
    geometry,
    name: file.name,
    format,
    triangles: Math.floor((geometry.getAttribute("position")?.count ?? 0) / 3),
    height: box.max.z - box.min.z,
  };
}

export async function createWebGlbFromStl(file: File): Promise<{ blob: Blob; triangles: number }> {
  if (!file.name.toLowerCase().endsWith(".stl")) throw new Error("A source STL is required to generate the web GLB.");

  const loaded = await loadMiniatureGeometry(file);
  const sourceTriangles = loaded.triangles;
  let indexed: THREE.BufferGeometry | null = null;
  let material: THREE.MeshStandardMaterial | null = null;

  try {
    // STL is non-indexed and repeats every vertex per face. Merging positions gives GLB a much smaller indexed mesh.
    // Drop STL face normals first, then regenerate smooth vertex normals after welding.
    loaded.geometry.deleteAttribute("normal");
    indexed = mergeVertices(loaded.geometry, 1e-5);
    indexed.computeVertexNormals();

    // Canonical painter data is Z-up; glTF is delivered Y-up.
    indexed.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    indexed.computeBoundingBox();
    indexed.computeBoundingSphere();

    const indexedTriangleCount = Math.floor((indexed.index?.count ?? indexed.getAttribute("position")?.count ?? 0) / 3);
    if (indexedTriangleCount !== sourceTriangles) {
      throw new Error(`GLB conversion changed triangle order/count (${sourceTriangles.toLocaleString()} → ${indexedTriangleCount.toLocaleString()}).`);
    }

    material = new THREE.MeshStandardMaterial({ color: 0x8f949b, roughness: 0.68, metalness: 0.08 });
    const mesh = new THREE.Mesh(indexed, material);
    mesh.name = file.name.replace(/\.stl$/i, "");
    const scene = new THREE.Scene();
    scene.add(mesh);

    const result = await new GLTFExporter().parseAsync(scene, {
      binary: true,
      onlyVisible: true,
    });
    if (!(result instanceof ArrayBuffer)) throw new Error("GLB exporter returned an unexpected text payload.");

    return {
      blob: new Blob([result], { type: "model/gltf-binary" }),
      triangles: sourceTriangles,
    };
  } finally {
    loaded.geometry.dispose();
    indexed?.dispose();
    material?.dispose();
  }
}
