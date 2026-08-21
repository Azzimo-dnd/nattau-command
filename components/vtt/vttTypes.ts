export type VttScene = {
  id: string;
  campaign_id: string;
  name: string;
  grid_width: number;
  grid_height: number;
  feet_per_square: number;
  is_active: boolean;
};

export type VttToken = {
  id: string;
  name: string;
  source_kind: "character" | "enemy";
  x: number;
  z: number;
  rotation: number;
  scale: number;
  size_squares: number;
  visible_to_players: boolean;
  model_storage_path: string;
  model_file_name: string;
  model_format: "stl" | "glb";
  paint_storage_path: string | null;
  revision: number;
};

export type VttEnemyModel = {
  id: string;
  campaign_id: string;
  name: string;
  storage_path: string;
  web_storage_path: string | null;
  original_name: string;
  file_size_bytes: number;
  web_file_size_bytes: number | null;
  triangle_count: number | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  created_at: string;
};

export type VttEnemyPaintJob = {
  id: string;
  enemy_model_id: string;
  storage_path: string;
  name: string;
  schema_version: number;
  file_size_bytes: number;
  is_default: boolean;
  created_at: string;
};
