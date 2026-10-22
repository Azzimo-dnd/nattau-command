import type { TerrainAssetRow } from "@/lib/terrain/terrainTypes";

export type VttSceneTerrainInstance = {
  id: string;
  campaign_id: string;
  scene_id: string;
  terrain_asset_id: string;
  position_x: number;
  position_z: number;
  rotation_y: number;
  scale: number;
  visible_to_players: boolean;
  created_at: string;
};

export type TerrainSceneSelection = {
  asset: TerrainAssetRow;
  instance: VttSceneTerrainInstance;
};

export function clampTerrainPoint(x: number, z: number, width: number, height: number): [number, number] {
  if (![x,z,width,height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error("Invalid terrain coordinates or scene bounds.");
  }
  // 0.5 margin keeps the center of common cargo objects away from the map edge.
  return [Math.max(-width/2 + 0.5, Math.min(width/2 - 0.5, x)),
          Math.max(-height/2 + 0.5, Math.min(height/2 - 0.5, z))];
}

export function normalizeTerrainRotation(value: number) {
  if (!Number.isFinite(value)) throw new Error("Invalid terrain rotation.");
  const tau = Math.PI * 2;
  return ((value % tau) + tau) % tau;
}

/** Calculate a new terrain pivot from a ground-plane drag, preserving where the GM grabbed it. */
export function terrainDragPoint(
  original: readonly [number,number],
  originHit: readonly [number,number],
  currentHit: readonly [number,number],
  width:number,height:number,
  snap:boolean,
): [number,number] {
  if (![...original,...originHit,...currentHit].every(Number.isFinite)) {
    throw new Error("Invalid terrain pointer position.");
  }
  const rawX=original[0]+currentHit[0]-originHit[0];
  const rawZ=original[1]+currentHit[1]-originHit[1];
  const [x,z]=clampTerrainPoint(rawX,rawZ,width,height);
  if (!snap) return [x,z];
  const center=(value:number,extent:number) => {
    const min=-extent/2+0.5;
    const max=extent/2-0.5;
    return Math.max(min,Math.min(max,min+Math.round(value-min)));
  };
  return [center(x,width),center(z,height)];
}
