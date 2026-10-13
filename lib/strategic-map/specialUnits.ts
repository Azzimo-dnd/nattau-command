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
