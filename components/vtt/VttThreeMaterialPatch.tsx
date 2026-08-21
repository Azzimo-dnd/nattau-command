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

      // MeshBasicMaterial is first compiled while the asynchronous battle-map texture
      // is still null. Three.js uses a different shader program when USE_MAP is present.
      // Force a compile on the first observation as well as on every later map change;
      // otherwise a patch installed after the first frame can remember nothing and leave
      // Chrome rendering the material's white base color forever.
      if (previousMap !== currentMap) {
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
