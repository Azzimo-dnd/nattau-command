import { MilitaryCard } from "@/components/military/MilitaryCard";
import { militaryUnits } from "@/components/military/militaryData";
import { specialUnitDefinitions, resolveSpecialUnitProfile, type SpecialUnitRosterRow } from "@/lib/strategic-map/specialUnits";

type Props={
 campaignId:string;
 canEdit:boolean;
 roster:SpecialUnitRosterRow[];
 liveUnavailable:boolean;
};
export function WarRoom({campaignId,canEdit,roster,liveUnavailable}:Props){
 const byKey=new Map(roster.map(row=>[row.unit_key,row]));
 return <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <div className="mb-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-bold text-yellow-500">⚔ War Room</h2>
        <span className="text-sm text-slate-500">{canEdit?"Expand a unit to edit its entire profile":"Click unit to inspect"}</span>
      </div>
      <p className="mt-2 text-sm text-slate-500">Durability represents how many major defeats a unit can survive. At 0 durability, the unit becomes wounded. If defeated again, it is lost.</p>
      <p className="mt-2 text-xs text-emerald-400/80">All War Room attributes, status and missions are shared with Strategic Map through Supabase.</p>
      {liveUnavailable&&<p role="alert" className="mt-3 rounded-lg border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-200">Live unit statuses could not be loaded. Original reference statuses are shown temporarily; edits are unavailable.</p>}
    </div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {militaryUnits.map(unit=>{
        const definition=specialUnitDefinitions.find(def=>def.name===unit.name);
        if(!definition)return null;
        const record=byKey.get(definition.key);
        const profile=resolveSpecialUnitProfile(definition.key,record?.unit_profile);
        const effectiveUnit=profile?{...unit,...profile}:unit;
        return <MilitaryCard key={definition.key} unit={effectiveUnit}
          unitKey={definition.key} campaignId={campaignId}
          canEdit={canEdit&&!liveUnavailable} liveRecord={record}/>;
      })}
    </div>
 </section>;
}
