"use client";

import * as THREE from "three";

const MAP_PATCH_FLAG = Symbol.for("nattau.vtt.mesh-basic-map-setter-patch");
const MAP_VALUE = Symbol.for("nattau.vtt.mesh-basic-map-value");
const FACING_PATCH_FLAG = Symbol.for("nattau.vtt.facing-marker-axis-patch-v2");

type PatchedMaterialPrototype = typeof THREE.MeshBasicMaterial.prototype & {
  [MAP_PATCH_FLAG]?: boolean;
};

type PatchedObjectPrototype = typeof THREE.Object3D.prototype & {
  [FACING_PATCH_FLAG]?: boolean;
};

type PatchedMaterial = THREE.MeshBasicMaterial & {
  [MAP_VALUE]?: THREE.Texture | null;
};

function installMapMaterialPatch() {
  const prototype = THREE.MeshBasicMaterial.prototype as PatchedMaterialPrototype;
  if (prototype[MAP_PATCH_FLAG]) return;

  const existing = Object.getOwnPropertyDescriptor(prototype, "map");
  if (existing && !existing.configurable) {
    console.warn("[VTT map] Could not install MeshBasicMaterial.map patch: property is not configurable.");
    prototype[MAP_PATCH_FLAG] = true;
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

  prototype[MAP_PATCH_FLAG] = true;
  console.info("[VTT map] Installed MeshBasicMaterial.map setter patch.");
}

function installFacingMarkerPatch() {
  const prototype = THREE.Object3D.prototype as PatchedObjectPrototype;
  if (prototype[FACING_PATCH_FLAG]) return;

  const originalUpdateMatrix = prototype.updateMatrix;
  prototype.updateMatrix = function patchedUpdateMatrix(this: THREE.Object3D) {
    if (this instanceof THREE.Mesh && this.geometry instanceof THREE.ConeGeometry) {
      const markerGeometry = this.geometry as THREE.ConeGeometry;
      const isVttFacingMarker =
        markerGeometry.parameters.radialSegments === 3
        && Math.abs(this.position.x) < 0.0001
        && Math.abs(this.position.y - 0.045) < 0.0001
        && this.position.z < 0;

      if (isVttFacingMarker) {
        // The screenshot-confirmed miniature front is the opposite side of the
        // local X axis from the previous attempt. Keep token.rotation authoritative
        // and move only the visual marker from the legacy -Z definition to local -X.
        const distance = Math.abs(this.position.z);
        this.position.set(-distance, this.position.y, 0);
        this.rotation.set(0, 0, Math.PI / 2);
      }
    }

    return originalUpdateMatrix.call(this);
  };

  prototype[FACING_PATCH_FLAG] = true;
  console.info("[VTT facing] Installed miniature facing-marker -X patch.");
}

function installPatches() {
  installMapMaterialPatch();
  installFacingMarkerPatch();
}

installPatches();

export function VttThreeMaterialPatch() {
  installPatches();
  return null;
}
