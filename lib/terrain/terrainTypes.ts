export const TERRAIN_CATEGORIES = ["cargo", "cover", "wreckage", "nature", "structures", "scatter"] as const;
export type TerrainCategory = (typeof TERRAIN_CATEGORIES)[number];
export type TerrainStatus = "draft" | "approved" | "archived";

export type TerrainRecipe =
  | { kind: "crate"; seed: number; width: number; depth: number; height: number; count: number; wear: number; reinforced: boolean }
  | { kind: "barrel"; seed: number; radius: number; height: number; hoops: number; wear: number }
  | { kind: "fence"; seed: number; length: number; height: number; posts: number; broken: boolean; wear: number }
  | { kind: "barricade"; seed: number; width: number; height: number; clutter: number; broken: boolean }
  | { kind: "planks"; seed: number; width: number; depth: number; beams: number; damage: number }
  | { kind: "hull"; seed: number; width: number; height: number; damage: number };

export type TerrainPreset = {
  id: string;
  name: string;
  category: TerrainCategory;
  description: string;
  recipe: TerrainRecipe;
};

export type TerrainAssetRow = {
  id: string;
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
  created_at: string;
};

export const TERRAIN_PRESETS: TerrainPreset[] = [
  { id: "crate-small", name: "Small cargo crate", category: "cargo", description: "Reinforced wooden freight crate.", recipe: { kind: "crate", seed: 101, width: 0.68, depth: 0.66, height: 0.68, count: 1, wear: 0.17, reinforced: true } },
  { id: "crate-large", name: "Large supply crate", category: "cargo", description: "Heavy crate used at the flying galleon dock.", recipe: { kind: "crate", seed: 102, width: 1.12, depth: 0.9, height: 0.9, count: 1, wear: 0.24, reinforced: true } },
  { id: "crate-stack", name: "Stacked cargo", category: "cargo", description: "Three assorted cargo crates.", recipe: { kind: "crate", seed: 103, width: 0.68, depth: 0.7, height: 0.62, count: 3, wear: 0.32, reinforced: false } },
  { id: "barrel", name: "Wooden barrel", category: "cargo", description: "Storage barrel with iron hoops.", recipe: { kind: "barrel", seed: 104, radius: 0.3, height: 0.88, hoops: 3, wear: 0.2 } },
  { id: "fence-short", name: "Timber fence", category: "cover", description: "Rough defensive fence segment.", recipe: { kind: "fence", seed: 105, length: 2.1, height: 1.18, posts: 6, broken: false, wear: 0.35 } },
  { id: "barricade", name: "Dock barricade", category: "cover", description: "A hurried obstacle made from broken timber.", recipe: { kind: "barricade", seed: 106, width: 2.4, height: 1.35, clutter: 7, broken: true } },
  { id: "wreck-planks", name: "Scattered wreckage", category: "wreckage", description: "Splintered planks left by the destroyed galleon.", recipe: { kind: "planks", seed: 107, width: 2.6, depth: 1.7, beams: 13, damage: 0.72 } },
  { id: "wreck-hull", name: "Broken hull section", category: "wreckage", description: "A rough section of the galleon's shattered side.", recipe: { kind: "hull", seed: 108, width: 2.65, height: 1.8, damage: 0.62 } },
];

export const MAX_TERRAIN_BYTES = 50 * 1024 * 1024;
export function isTerrainCategory(value: string): value is TerrainCategory {
  return (TERRAIN_CATEGORIES as readonly string[]).includes(value);
}
