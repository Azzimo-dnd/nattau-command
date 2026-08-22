import type { VttFogBaseState, VttFogPoint, VttFogRegion } from "./vttTypes";

function pointInRectangle(points: VttFogPoint[], x: number, z: number) {
  if (points.length !== 2) return false;
  const [[x1, z1], [x2, z2]] = points;
  return x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && z >= Math.min(z1, z2) && z <= Math.max(z1, z2);
}

function pointInPolygon(points: VttFogPoint[], x: number, z: number) {
  if (points.length < 3) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, zi] = points[i];
    const [xj, zj] = points[j];
    const crosses = (zi > z) !== (zj > z);
    if (!crosses) continue;
    const crossX = ((xj - xi) * (z - zi)) / (zj - zi || Number.EPSILON) + xi;
    if (x < crossX) inside = !inside;
  }
  return inside;
}

export function fogRegionContains(region: Pick<VttFogRegion, "shape" | "points">, x: number, z: number) {
  if (region.shape === "all") return true;
  if (region.shape === "rectangle") return pointInRectangle(region.points, x, z);
  return pointInPolygon(region.points, x, z);
}

export function isFogPointRevealed(
  enabled: boolean,
  baseState: VttFogBaseState,
  regions: VttFogRegion[],
  x: number,
  z: number,
) {
  if (!enabled) return true;
  let revealed = baseState === "revealed";
  for (const region of regions) {
    if (fogRegionContains(region, x, z)) revealed = region.operation === "reveal";
  }
  return revealed;
}
