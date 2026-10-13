export const GALLEON_STATS = {
  flightSpeedFt: 120,
  ascentFt: 30,
  descentFt: 60,
  hull: {
    ac: 15, maxHp: 400, damageThreshold: 15,
    resistances: "Bludgeoning, piercing and slashing from nonmagical attacks",
    vulnerabilities: "Lightning and fire",
    immunities: "Poison, necrotic; exhaustion, charmed, frightened",
  },
  core: {
    ac: 17, maxHp: 120,
    onDestroyed: "The ship starts falling 200 ft per round.",
    criticalEffect: "Explosion: 20d10 fire + force damage, 30 ft radius.",
  },
  sails: {
    ac: 13, maxHp: 100,
    onDestroyed: "The ship loses forward and backward movement.",
  },
  ballistae: {
    name: "Kainite Ballistae", count: "4 per side",
    attackBonus: "+6", range: "120/480 ft", damage: "3d10 piercing",
  },
  turret: {
    name: "Baldar's Aether Turret", mount: "Bow",
    attackBonus: "+7", range: "150 ft",
    damage: "6d12 force + 4d8 fire", recharge: "5–6",
  },
} as const;

export type GalleonStatus = "airborne" | "anchored" | "landed" | "under_repair";

export type StrategicGalleon = {
  campaign_id: string;
  name: string;
  pos_x: number | null;
  pos_y: number | null;
  status: GalleonStatus;
  flight_ready: boolean;
  hull_hp: number;
  core_hp: number;
  sails_hp: number;
  crew_status: string;
  condition_notes: string;
  visible_to_players?: boolean;
  gm_notes?: string;
};

export function canGalleonFly(galleon: StrategicGalleon): boolean {
  return galleon.flight_ready && galleon.core_hp > 0 && galleon.hull_hp > 0;
}

export function canGalleonTravelForward(galleon: StrategicGalleon): boolean {
  return canGalleonFly(galleon) && galleon.sails_hp > 0;
}

export function galleonStatusLabel(status: GalleonStatus): string {
  switch (status) {
    case "airborne": return "Airborne";
    case "anchored": return "Anchored";
    case "landed": return "Landed";
    case "under_repair": return "Under repair";
  }
}

export function defaultGalleon(campaignId: string): StrategicGalleon {
  return {
    campaign_id: campaignId,
    name: "Latający Galeon Kainitów",
    pos_x: null,
    pos_y: null,
    status: "landed",
    flight_ready: true,
    hull_hp: GALLEON_STATS.hull.maxHp,
    core_hp: GALLEON_STATS.core.maxHp,
    sails_hp: GALLEON_STATS.sails.maxHp,
    crew_status: "Ready",
    condition_notes: "",
    visible_to_players: true,
    gm_notes: "",
  };
}
