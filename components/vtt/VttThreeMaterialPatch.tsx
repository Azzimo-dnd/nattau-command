"use client";

import * as THREE from "three";

const PATCH_FLAG = Symbol.for("nattau.vtt.mesh-basic-map-setter-patch");
const MAP_VALUE = Symbol.for("nattau.vtt.mesh-basic-map-value");

type PatchedPrototype = typeof THREE.MeshBasicMaterial.prototype & {
  [PATCH_FLAG]?: boolean;
};

type PatchedMaterial = THREE.MeshBasicMaterial & {
  [MAP_VALUE]?: THREE.Texture | null;
};

function installPatch() {
  const prototype = THREE.MeshBasicMaterial.prototype as PatchedPrototype;
  if (prototype[PATCH_FLAG]) return;

  const existing = Object.getOwnPropertyDescriptor(prototype, "map");
  if (existing && !existing.configurable) {
    console.warn("[VTT map] Could not install MeshBasicMaterial.map patch: property is not configurable.");
    prototype[PATCH_FLAG] = true;
    return;
  }

  Object.defineProperty(prototype, "map", {
    configurable: true,
    enumerable: true,
    get(this: PatchedMaterial) {
      return this[MAP_VALUE] ?? null;
    },
    set(this: PatchedMaterial, value: THREE.Texture | null | undefined) {
      const next = value ?? null;
      const previous = this[MAP_VALUE] ?? null;
      this[MAP_VALUE] = next;

      // WebGLRenderer.render is installed as an instance method by Three.js, so
      // patching WebGLRenderer.prototype.render does not reliably intercept R3F.
      // Intercept the map assignment itself instead. When R3F changes a material
      // from no map to a loaded battle-map texture, Three.js must compile a new
      // shader with USE_MAP enabled.
      if (previous !== next && typeof this.version === "number") {
        this.needsUpdate = true;
        if (next) {
          next.needsUpdate = true;
          console.info("[VTT map] Texture attached to MeshBasicMaterial", {
            texture: next.uuid,
            imageWidth: (next.image as { width?: number } | undefined)?.width ?? null,
            imageHeight: (next.image as { height?: number } | undefined)?.height ?? null,
            materialVersion: this.version,
          });
        }
      }
    },
  });

  prototype[PATCH_FLAG] = true;
  console.info("[VTT map] Installed MeshBasicMaterial.map setter patch.");
}

installPatch();

export function VttThreeMaterialPatch() {
  installPatch();
  return null;
}
