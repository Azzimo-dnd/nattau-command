"use client";

import * as THREE from "three";

const MAP_PATCH_FLAG = Symbol.for("nattau.vtt.mesh-basic-map-setter-patch");
const MAP_VALUE = Symbol.for("nattau.vtt.mesh-basic-map-value");
const FACING_PATCH_FLAG = Symbol.for("nattau.vtt.facing-marker-axis-patch");

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

      if (previous !== next && typeof this.version === "number") {
        this.needsUpdate = true;
        if (next) next.needsUpdate = true;
      }
    },
  });

  prototype[MAP_PATCH_FLAG] = true;
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
        const distance = Math.abs(this.position.z);

        // The tested Nattau miniature assets face local +X on the VTT board.
        // Keep token.rotation as the only authoritative rotation value and only
        // move/rotate the visual facing marker into that same local direction.
        this.position.set(distance, 0.045, 0);
        this.rotation.set(0, 0, -Math.PI / 2);
      }
    }

    return originalUpdateMatrix.call(this);
  };

  prototype[FACING_PATCH_FLAG] = true;
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
