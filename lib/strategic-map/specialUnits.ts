import { militaryUnits, type MilitaryUnit } from "@/components/military/militaryData";

export type StrategicSpecialUnit = {
  campaign_id?: string;
  unit_key: string;
  status: string;
  mission: string;
  location_note: string;
  gm_notes?: string;
  pos_x: number | null;
  pos_y: number | null;
  visible_to_players?: boolean;
  updated_at?: string;
  unit_profile?: unknown;
};

const registry = [
  { key: "defensive-detachment", name: "Defensive Detachment", icon: "🛡️", color: "border-sky-400 text-sky-100 bg-sky-950" },
  { key: "artillery-corps", name: "Artillery Corps", icon: "💣", color: "border-orange-400 text-orange-100 bg-orange-950" },
  { key: "hunters-of-ared", name: "Hunters of Ared", icon: "🏹", color: "border-green-400 text-green-100 bg-green-950" },
  { key: "daughters-of-kain", name: "Daughters of Kain", icon: "✦", color: "border-amber-400 text-amber-100 bg-amber-950" },
  { key: "pavise-brothers-of-kain", name: "Pavise Brothers of Kain", icon: "⚔", color: "border-slate-300 text-slate-100 bg-slate-800" },
  { key: "triboar-guard", name: "Triboar Guard", icon: "🏰", color: "border-indigo-400 text-indigo-100 bg-indigo-950" },
  { key: "pit-stop-crew", name: "Pit Stop Crew", icon: "🔧", color: "border-teal-400 text-teal-100 bg-teal-950" },
  { key: "azzimos-carnival", name: "Azzimo's Carnival", icon: "🎭", color: "border-fuchsia-400 text-fuchsia-100 bg-fuchsia-950" },
] as const;

export type SpecialUnitDefinition = (typeof registry)[number] & { unit: MilitaryUnit };
export const specialUnitDefinitions: SpecialUnitDefinition[] = registry.map(def => {
  const unit = militaryUnits.find(item => item.name === def.name);
  if (!unit) throw new Error(`War Room unit is missing: ${def.name}`);
  return { ...def, unit };
});
export function specialUnitByKey(key: string) {
  return specialUnitDefinitions.find(def => def.key === key);
}
export function specialUnitDefaults(campaignId: string): StrategicSpecialUnit[] {
  return specialUnitDefinitions.map(def => ({
    campaign_id:campaignId,
    unit_key:def.key,status:def.unit.status,mission:"",
    location_note:"",gm_notes:"",pos_x:null,pos_y:null,visible_to_players:false,
  }));
}

/** Canonical roster state is saved in campaign_strategic_special_units. */
export type SpecialUnitRosterRow = {
  unit_key: string;
  status: string;
  mission: string | null;
  updated_at?: string;
  unit_profile?: unknown;
};

export const specialUnitStatusOptions = [
  "Ready", "Operational", "Expanded", "On Mission", "Travelling",
  "Reconnaissance", "Garrisoned", "Supporting", "Resting",
  "Inactive", "Wounded", "Missing",
] as const;

/** Only identity is the immutable unit_key; the displayed War Room data is editable. */
export type SpecialUnitProfile = Pick<
  MilitaryUnit,
  "name" | "commander" | "size" | "detail" | "cost" |
  "durability" | "headquarters" | "members" | "theme"
>;

function validText(value:unknown,max:number,required=false){
  return typeof value==="string" && value.length<=max && (!required||value.trim().length>0);
}
function validWhole(value:unknown,min:number,max:number){
  return typeof value==="number" && Number.isInteger(value) && value>=min && value<=max;
}

/** Client validation also protects the render path from malformed stored JSON. */
export function validateSpecialUnitProfile(input:SpecialUnitProfile):string|null{
  if(!validText(input.name,120,true))return "Name must have 1–120 characters.";
  if(!validText(input.commander,150))return "Commander must have at most 150 characters.";
  if(!validText(input.size,120))return "Unit size must have at most 120 characters.";
  if(!validText(input.detail,3500))return "Description must have at most 3500 characters.";
  if(input.theme!=="standard"&&input.theme!=="azzimo"&&input.theme!==undefined)return "Invalid unit theme.";
  if(!Array.isArray(input.members)||input.members.length>60||input.members.some(m=>!validText(m,160,true)))return "Provide up to 60 named members, each with 1–160 characters.";
  if(!input.cost||!["resource","session-debuff"].includes(input.cost.type))return "Choose a valid deployment cost type.";
  if(input.cost.type==="resource"){
    if(input.cost.resource!=="RP"||!Array.isArray(input.cost.options)||input.cost.options.length<1||input.cost.options.length>12||input.cost.options.some(o=>!validWhole(o.amount,0,100000)||!validText(o.label??"",120)))return "Use 1–12 valid RP cost options (0–100000).";
  }else if(!validWhole(input.cost.amount,0,100000)||input.cost.timing!=="next-session")return "Invalid next-session debuff cost.";
  if(!input.durability||!["finite","infinite"].includes(input.durability.type))return "Choose a valid durability type.";
  if(input.durability.type==="finite"){
    if(!validWhole(input.durability.max,1,100000)||!validWhole(input.durability.current,0,input.durability.max))return "Durability must satisfy 0 ≤ current ≤ maximum; max 100000.";
  }else if(!validText(input.durability.label,100,true)||!validText(input.durability.description,2000))return "Invalid infinite-durability description.";
  if(!input.headquarters||!["built","available","unavailable"].includes(input.headquarters.state))return "Choose a valid headquarters state.";
  if(input.headquarters.state==="built"&&!validText(input.headquarters.name,250,true))return "Headquarters name must have 1–250 characters.";
  if(input.headquarters.state==="available"&&!validText(input.headquarters.constructionCost,250,true))return "Headquarters construction cost must have 1–250 characters.";
  if(input.headquarters.state==="unavailable"&&!validText(input.headquarters.reason,1500,true))return "Headquarters reason must have 1–1500 characters.";
  return null;
}

/** Resolve an editable profile over its original War Room data, without changing the stable key. */
export function resolveSpecialUnitProfile(unitKey:string,stored:unknown):SpecialUnitProfile|null{
  const def=specialUnitByKey(unitKey);
  if(!def)return null;
  const fallback:SpecialUnitProfile={
    name:def.unit.name,commander:def.unit.commander,size:def.unit.size,
    detail:def.unit.detail,cost:def.unit.cost,durability:def.unit.durability,
    headquarters:def.unit.headquarters,members:def.unit.members,
    theme:def.unit.theme??"standard",
  };
  if(!stored||typeof stored!=="object"||Array.isArray(stored))return fallback;
  if(Object.keys(stored).length===0)return fallback;
  const input={...fallback,...stored} as SpecialUnitProfile;
  return validateSpecialUnitProfile(input)?fallback:input;
}

export function resolvedDisplayName(unitKey:string,stored:unknown):string{
  return resolveSpecialUnitProfile(unitKey,stored)?.name??
    specialUnitByKey(unitKey)?.name??unitKey;
}
