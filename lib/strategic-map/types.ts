import type { FactionId, Province } from "@/components/map/provinceData";

export type StrategicFactionId = Exclude<FactionId, "unknown">;

export type StrategicFaction = {
  id: StrategicFactionId;
  name: string;
  shortName: string;
  description: string;
  status: string;
  armyCount: number;
  relations: string[];
};

export type StrategicMapState = {
  mapUrl: string;
  mapStoragePath: string | null;
  mapOriginalName: string | null;
  provinces: Province[];
  provinceControl: Record<number, FactionId[]>;
  factions: StrategicFaction[];
};
