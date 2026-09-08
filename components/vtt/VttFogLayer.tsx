"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { VttFogBaseState, VttFogDrawShape, VttFogOperation, VttFogPoint, VttFogRegion } from "./vttTypes";

type FogLayerProps = {
  width: number;
  height: number;
  enabled: boolean;
  baseState: VttFogBaseState;
  regions: VttFogRegion[];
  isDm: boolean;
};

type DraftProps = {
  points: VttFogPoint[];
  shape: VttFogDrawShape;
  operation: VttFogOperation;
};

function textureSize(width: number, height: number) {
  const maxSide = 768;
  if (width >= height) return [maxSide, Math.max(256, Math.round(maxSide * height / Math.max(width, 1)))] as const;
  return [Math.max(256, Math.round(maxSide * width / Math.max(height, 1))), maxSide] as const;
}

function drawRegion(
  context: CanvasRenderingContext2D,
  region: Pick<VttFogRegion, "operation" | "shape" | "points">,
  width: number,
  height: number,
  pixelWidth: number,
  pixelHeight: number,
) {
  context.fillStyle = region.operation === "cover" ? "#ffffff" : "#000000";
  if (region.shape === "all") {
    context.fillRect(0, 0, pixelWidth, pixelHeight);
    return;
  }

  const toPixel = ([x, z]: VttFogPoint) => [
    ((x + width / 2) / Math.max(width, 0.001)) * pixelWidth,
    ((z + height / 2) / Math.max(height, 0.001)) * pixelHeight,
  ] as const;

  if (region.shape === "rectangle" && region.points.length === 2) {
    const [a, b] = region.points.map(toPixel);
    context.fillRect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    return;
  }

  if (region.shape === "polygon" && region.points.length >= 3) {
    const points = region.points.map(toPixel);
    context.beginPath();
    context.moveTo(points[0][0], points[0][1]);
    for (let index = 1; index < points.length; index += 1) context.lineTo(points[index][0], points[index][1]);
    context.closePath();
    context.fill();
  }
}

export function VttFogLayer({ width, height, enabled, baseState, regions, isDm }: FogLayerProps) {
  const texture = useMemo(() => {
    if (!enabled || typeof document === "undefined") return null;
    const [pixelWidth, pixelHeight] = textureSize(width, height);
    const canvas = document.createElement("canvas");
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.fillStyle = baseState === "covered" ? "#ffffff" : "#000000";
    context.fillRect(0, 0, pixelWidth, pixelHeight);
    for (const region of regions) drawRegion(context, region, width, height, pixelWidth, pixelHeight);

    const next = new THREE.CanvasTexture(canvas);
    next.wrapS = THREE.ClampToEdgeWrapping;
    next.wrapT = THREE.ClampToEdgeWrapping;
    next.minFilter = THREE.LinearFilter;
    next.magFilter = THREE.LinearFilter;
    next.generateMipmaps = false;
    next.needsUpdate = true;
    return next;
  }, [baseState, enabled, height, regions, width]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!enabled || !texture) return null;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.002, 0]}
      raycast={() => undefined}
      renderOrder={2}
    >
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        color={isDm ? "#172235" : "#07101d"}
        alphaMap={texture}
        transparent
        opacity={isDm ? 0.58 : 0.985}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

export function VttFogDraftOverlay({ points, shape, operation }: DraftProps) {
  const geometry = useMemo(() => {
    if (points.length === 0) return null;
    const segments: number[] = [];
    if (shape === "rectangle" && points.length >= 2) {
      const [a, b] = points;
      const corners: VttFogPoint[] = [a, [b[0], a[1]], b, [a[0], b[1]]];
      for (let index = 0; index < 4; index += 1) {
        const start = corners[index];
        const end = corners[(index + 1) % 4];
        segments.push(start[0], 0.045, start[1], end[0], 0.045, end[1]);
      }
    } else if (shape === "polygon") {
      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        segments.push(start[0], 0.045, start[1], end[0], 0.045, end[1]);
      }
      if (points.length >= 3) {
        const start = points[points.length - 1];
        const end = points[0];
        segments.push(start[0], 0.045, start[1], end[0], 0.045, end[1]);
      }
    }
    if (segments.length === 0) return null;
    const next = new THREE.BufferGeometry();
    next.setAttribute("position", new THREE.Float32BufferAttribute(segments, 3));
    return next;
  }, [points, shape]);

  useEffect(() => () => geometry?.dispose(), [geometry]);
  const color = operation === "reveal" ? "#34d399" : "#f59e0b";

  return (
    <group>
      {geometry ? <lineSegments geometry={geometry} renderOrder={20}><lineBasicMaterial color={color} depthTest={false} /></lineSegments> : null}
      {points.map((point, index) => (
        <mesh key={`${index}:${point[0]}:${point[1]}`} position={[point[0], 0.052, point[1]]} renderOrder={21}>
          <sphereGeometry args={[0.085, 12, 8]} />
          <meshBasicMaterial color={color} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}
