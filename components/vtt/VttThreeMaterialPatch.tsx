"use client";

import * as THREE from "three";

const PATCH_FLAG = Symbol.for("nattau.vtt.dynamic-map-material-patch");
const lastMapByMaterial = new WeakMap<THREE.Material, THREE.Texture | null>();

type PatchedRendererPrototype = typeof THREE.WebGLRenderer.prototype & {
  [PATCH_FLAG]?: boolean;
};

function refreshDynamicTextureMaterials(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!("map" in material)) continue;

      const currentMap = ((material as THREE.MeshBasicMaterial).map ?? null) as THREE.Texture | null;
      const previousMap = lastMapByMaterial.get(material);

      // Three.js compiles a different shader when a material changes between
      // "no texture" and "has texture". R3F updates the property for us, but
      // Three still needs an explicit material recompile for this transition.
      if (previousMap !== undefined && previousMap !== currentMap) {
        material.needsUpdate = true;
      }
      lastMapByMaterial.set(material, currentMap);
    }
  });
}

function installPatch() {
  const prototype = THREE.WebGLRenderer.prototype as PatchedRendererPrototype;
  if (prototype[PATCH_FLAG]) return;

  const originalRender = prototype.render;
  prototype.render = function patchedRender(
    this: THREE.WebGLRenderer,
    scene: THREE.Object3D,
    camera: THREE.Camera,
  ) {
    refreshDynamicTextureMaterials(scene);
    return originalRender.call(this, scene, camera);
  };

  prototype[PATCH_FLAG] = true;
}

installPatch();

export function VttThreeMaterialPatch() {
  installPatch();
  return null;
}
