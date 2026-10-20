import { MAX_TERRAIN_BYTES, isTerrainCategory } from "./terrainTypes";
import type { TerrainCategory, TerrainRecipe, TerrainStatus, TerrainAssetRow } from "./terrainTypes";
import type { TerrainModelMetrics } from "./terrainModels";

export const TERRAIN_BUCKET = "vtt-terrain-assets";

export type TerrainRegistration = {
  campaign_id: string;
  name: string;
  category: TerrainCategory;
  status: TerrainStatus;
  source_kind: "generated" | "uploaded";
  storage_path: string;
  original_name: string;
  file_size_bytes: number;
  mesh_count: number;
  triangle_count: number;
  width_units: number;
  height_units: number;
  depth_units: number;
  default_scale: number;
  has_textures: boolean;
  pivot_mode: "centered_base";
  generator_recipe: TerrainRecipe | null;
};

export type TerrainAssetGateway = {
  upload(path: string, file: File): Promise<void>;
  register(metadata: TerrainRegistration): Promise<void>;
  removeFile(path: string): Promise<void>;
  deleteRecord(asset: Pick<TerrainAssetRow, "id" | "campaign_id">): Promise<boolean>;
};

export class TerrainCleanupError extends Error {
  constructor(public readonly orphanPath: string, original: unknown, cleanup: unknown) {
    const initial = original instanceof Error ? original.message : String(original);
    const last = cleanup instanceof Error ? cleanup.message : String(cleanup);
    super("Could not register terrain (" + initial + "). Storage rollback failed (" + last + "). Orphan path: " + orphanPath);
    this.name = "TerrainCleanupError";
  }
}

function ensureValidMetrics(metrics: TerrainModelMetrics) {
  const values = [metrics.width, metrics.height, metrics.depth];
  if (values.some((value) => !Number.isFinite(value) || value <= 0 || value > 1000)) {
    throw new Error("Invalid terrain dimensions.");
  }
  if (!Number.isSafeInteger(metrics.meshes) || metrics.meshes < 1 || metrics.meshes > 100000 ||
      !Number.isSafeInteger(metrics.triangles) || metrics.triangles < 1 || metrics.triangles > 2000000) {
    throw new Error("Invalid mesh or triangle count.");
  }
}

export function terrainRegistration(input: {
  campaignId: string; objectId: string; file: File; metrics: TerrainModelMetrics;
  name: string; category: TerrainCategory; sourceKind: "generated" | "uploaded";
  recipe: TerrainRecipe | null; scale: number;
}): TerrainRegistration {
  const { campaignId, objectId, file, metrics, category, sourceKind, recipe, scale } = input;
  const name = input.name.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(campaignId) || !uuid.test(objectId)) throw new Error("Invalid terrain storage identifier.");
  if (!name || name.length > 120) throw new Error("Name must have between 1 and 120 characters.");
  if (!isTerrainCategory(category)) throw new Error("Unsupported terrain category.");
  if (!file.name.toLowerCase().endsWith(".glb") || file.size < 20 || file.size > MAX_TERRAIN_BYTES) {
    throw new Error("Choose a valid self-contained GLB file up to 75 MB.");
  }
  if (file.name.trim().length > 180) throw new Error("Original file name is too long.");
  if (!Number.isFinite(scale) || scale < 0.1 || scale > 10) throw new Error("Invalid terrain scale.");
  if ((sourceKind === "generated") !== Boolean(recipe)) throw new Error("Generator recipe and source kind disagree.");
  ensureValidMetrics(metrics);
  return {
    campaign_id: campaignId, name, category, status: "draft", source_kind: sourceKind,
    storage_path: campaignId.toLowerCase() + "/" + objectId.toLowerCase() + ".glb",
    original_name: file.name, file_size_bytes: file.size,
    mesh_count: metrics.meshes, triangle_count: metrics.triangles,
    width_units: metrics.width, height_units: metrics.height, depth_units: metrics.depth,
    default_scale: scale, has_textures: metrics.hasTextures, pivot_mode: "centered_base",
    generator_recipe: recipe,
  };
}

/** Upload first, register second. A rejected metadata write rolls the upload back. */
export async function saveTerrainAsset(gateway: TerrainAssetGateway, input: Parameters<typeof terrainRegistration>[0]) {
  const metadata = terrainRegistration(input);
  await gateway.upload(metadata.storage_path, input.file);
  try {
    await gateway.register(metadata);
  } catch (error) {
    try { await gateway.removeFile(metadata.storage_path); }
    catch (cleanupError) { throw new TerrainCleanupError(metadata.storage_path, error, cleanupError); }
    throw error;
  }
  return metadata;
}

/** Remove metadata first, so an intermittent storage failure never leaves a broken library card.
 *  A failed file deletion must surface the orphan path so an admin can clean it up.
 */
export async function deleteTerrainAsset(gateway: TerrainAssetGateway, asset: Pick<TerrainAssetRow,"id"|"campaign_id"|"storage_path">) {
  const deleted = await gateway.deleteRecord(asset);
  if (!deleted) throw new Error("Terrain asset was not deleted. Refresh the library and try again.");
  try { await gateway.removeFile(asset.storage_path); }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new TerrainCleanupError(asset.storage_path, "Metadata has already been deleted", detail);
  }
}
