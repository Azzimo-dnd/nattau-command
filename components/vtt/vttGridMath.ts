/** Keep this formula aligned with public.vtt_snap_token_coordinate. */
export function snapTokenCoordinate(value: number, totalSquares: number, sizeSquares: number) {
  const halfExtent = totalSquares / 2;
  const halfFootprint = Math.min(totalSquares, Math.max(1, sizeSquares)) / 2;
  const firstCenter = -halfExtent + halfFootprint;
  const lastCenter = halfExtent - halfFootprint;
  return Math.max(firstCenter, Math.min(lastCenter, firstCenter + Math.round(value - firstCenter)));
}
