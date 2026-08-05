export type PhysicsDieKind = "d4" | "d6" | "d8" | "d10" | "d12" | "d20";
export type DiceLabTheme = "nattau" | "barovia";
export type DiceCameraMode = "table" | "top" | "close";
export type DiceLabStatus = "idle" | "rolling" | "rerolling" | "settled";
export type DiceNumberSize = "standard" | "large" | "extra-large";
export type DiceCosmeticId = string;
export type PhysicsDieTone = "normal" | "hope" | "fear";
export type PercentilePart = "tens" | "ones";

export type CampaignDicePhysicsSettings = {
  throwForce: number;
  spinForce: number;
  dieFriction: number;
  trayFriction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  gravity: number;
  cockedThreshold: number;
};

export type DiceAppearanceSettings = {
  cosmeticId: DiceCosmeticId;
  numberSize: DiceNumberSize;
  sound: boolean;
};

export type DiceRuntimeSettings = CampaignDicePhysicsSettings &
  DiceAppearanceSettings & {
    debug: boolean;
    cameraMode: DiceCameraMode;
  };

export type DiceLabSettings = DiceRuntimeSettings & {
  dieKind: PhysicsDieKind;
  count: number;
};

export type PhysicsDieRequest = {
  id: string;
  kind: PhysicsDieKind;
  groupIndex: number;
  logicalDieIndex: number;
  tone?: PhysicsDieTone;
  percentilePart?: PercentilePart;
};

export type PhysicsDieResult = {
  id: string;
  kind: PhysicsDieKind;
  groupIndex: number;
  logicalDieIndex: number;
  tone: PhysicsDieTone;
  percentilePart: PercentilePart | null;
  faceValue: number;
  value: number;
  alignment: number;
  cocked: boolean;
  automaticRerolls: number;
  quaternion: { x: number; y: number; z: number; w: number };
};

export type PhysicsRollResult = {
  rollId: string;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  dice: PhysicsDieResult[];
  physicalTotal: number;
  peakImpact: number;
  forcedSettles: number;
};

export type PhysicsRollRequest = {
  rollId: string;
  startedAt: number;
  dice: PhysicsDieRequest[];
  settings: DiceRuntimeSettings;
};
