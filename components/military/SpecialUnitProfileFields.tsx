"use client";

import type { SpecialUnitProfile } from "@/lib/strategic-map/specialUnits";
import type { DeploymentCost, MilitaryDurability, Headquarters } from "@/components/military/militaryData";

type Props={ value:SpecialUnitProfile; onChange:(next:SpecialUnitProfile)=>void; disabled?:boolean };
const input="mt-1 w-full min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none disabled:opacity-50";
const field="block text-xs font-medium text-slate-300";
const btn="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-200 hover:border-amber-500 disabled:opacity-50";

export function SpecialUnitProfileFields({value,onChange,disabled=false}:Props){
  function change<K extends keyof SpecialUnitProfile>(key:K,next:SpecialUnitProfile[K]){
    onChange({...value,[key]:next});
  }
  const resource=value.cost.type==="resource"?value.cost:null;
  const finite=value.durability.type==="finite"?value.durability:null;
  const infinite=value.durability.type==="infinite"?value.durability:null;
  const built=value.headquarters.state==="built"?value.headquarters:null;
  const available=value.headquarters.state==="available"?value.headquarters:null;
  const unavailable=value.headquarters.state==="unavailable"?value.headquarters:null;
  const resourceOptions=resource?.options??[];

  const numberField=(name:string,current:number,set:(n:number)=>void,min=0,max=100000)=>
    <label className={field}>{name}<input className={input} disabled={disabled} type="number" step={1} min={min} max={max} value={current} onChange={e=>set(Number(e.target.value))}/></label>;
  return <div className="space-y-4">
    <section className="space-y-3">
      <h4 className="border-b border-slate-700 pb-1 text-xs font-bold uppercase tracking-widest text-amber-400">Identity & description</h4>
      <label className={field}>Unit name<input disabled={disabled} maxLength={120} className={input} value={value.name} onChange={e=>change("name",e.target.value)}/></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={field}>Commander<input disabled={disabled} maxLength={150} className={input} value={value.commander} onChange={e=>change("commander",e.target.value)}/></label>
        <label className={field}>Composition / size<input disabled={disabled} maxLength={120} className={input} value={value.size} onChange={e=>change("size",e.target.value)}/></label>
      </div>
      <label className={field}>Unit description<textarea disabled={disabled} maxLength={3500} rows={3} className={input} value={value.detail} onChange={e=>change("detail",e.target.value)}/></label>
      <label className={field}>Card theme<select disabled={disabled} className={input} value={value.theme??"standard"} onChange={e=>change("theme",e.target.value as "standard"|"azzimo")}><option value="standard">Standard</option><option value="azzimo">Azzimo</option></select></label>
    </section>

    <section className="space-y-3">
      <h4 className="border-b border-slate-700 pb-1 text-xs font-bold uppercase tracking-widest text-amber-400">Deployment cost</h4>
      <label className={field}>Cost type<select disabled={disabled} className={input} value={value.cost.type} onChange={e=>{
        const cost:DeploymentCost=e.target.value==="resource"
          ?{type:"resource",resource:"RP",options:[{amount:1}]}
          :{type:"session-debuff",amount:1,timing:"next-session"};
        change("cost",cost);
      }}><option value="resource">Resources (RP)</option><option value="session-debuff">Debuffs (next session)</option></select></label>
      {resource&&<div className="space-y-2">
        <p className="text-xs text-slate-400">Separate RP options are alternatives, not cumulative charges.</p>
        {resourceOptions.map((option,i)=><div key={i} className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)_auto] items-end gap-2">
          {numberField(`Option ${i+1}: RP`,option.amount,n=>change("cost",{...resource,options:resourceOptions.map((o,index)=>index===i?{...o,amount:n}:o)}))}
          <label className={field}>Optional label<input disabled={disabled} className={input} maxLength={120} value={option.label??""} onChange={e=>change("cost",{...resource,options:resourceOptions.map((o,index)=>index===i?{...o,label:e.target.value}:o)})}/></label>
          <button type="button" disabled={disabled||resourceOptions.length===1} className={btn} onClick={()=>change("cost",{...resource,options:resourceOptions.filter((_,index)=>index!==i)})}>Remove</button>
        </div>)}
        <button type="button" disabled={disabled||resourceOptions.length>=12} className={btn} onClick={()=>change("cost",{...resource,options:[...resourceOptions,{amount:1}]})}>+ Add RP option</button>
      </div>}
      {value.cost.type==="session-debuff"&&numberField("Debuff count",value.cost.amount,n=>change("cost",{type:"session-debuff",amount:n,timing:"next-session"}))}
    </section>

    <section className="space-y-3">
      <h4 className="border-b border-slate-700 pb-1 text-xs font-bold uppercase tracking-widest text-amber-400">Durability</h4>
      <label className={field}>Durability type<select disabled={disabled} className={input} value={value.durability.type} onChange={e=>{
        const next:MilitaryDurability=e.target.value==="finite"
          ?{type:"finite",current:1,max:1}
          :{type:"infinite",label:"Eternal",description:""};
        change("durability",next);
      }}><option value="finite">Finite</option><option value="infinite">Infinite</option></select></label>
      {finite&&<div className="grid grid-cols-2 gap-3">
        {numberField("Current",finite.current,n=>change("durability",{...finite,current:n}))}
        {numberField("Maximum",finite.max,n=>change("durability",{...finite,max:n}),1)}
      </div>}
      {infinite&&<><label className={field}>Durability label<input disabled={disabled} maxLength={100} className={input} value={infinite.label} onChange={e=>change("durability",{...infinite,label:e.target.value})}/></label>
      <label className={field}>Durability description<textarea disabled={disabled} maxLength={2000} rows={2} className={input} value={infinite.description} onChange={e=>change("durability",{...infinite,description:e.target.value})}/></label></>}
    </section>

    <section className="space-y-3">
      <h4 className="border-b border-slate-700 pb-1 text-xs font-bold uppercase tracking-widest text-amber-400">Headquarters</h4>
      <label className={field}>Headquarters state<select disabled={disabled} className={input} value={value.headquarters.state} onChange={e=>{
        const next:Headquarters=e.target.value==="built"
          ?{state:"built",name:"Headquarters"}
          :e.target.value==="available"
          ?{state:"available",constructionCost:"3 RP"}
          :{state:"unavailable",reason:"Not available"};
        change("headquarters",next);
      }}><option value="built">Built</option><option value="available">Available to build</option><option value="unavailable">Unavailable</option></select></label>
      {built&&<label className={field}>Headquarters name<input disabled={disabled} className={input} maxLength={250} value={built.name} onChange={e=>change("headquarters",{...built,name:e.target.value})}/></label>}
      {available&&<label className={field}>Construction cost / description<input disabled={disabled} className={input} maxLength={250} value={available.constructionCost} onChange={e=>change("headquarters",{...available,constructionCost:e.target.value})}/></label>}
      {unavailable&&<label className={field}>Reason unavailable<textarea disabled={disabled} className={input} rows={2} maxLength={1500} value={unavailable.reason} onChange={e=>change("headquarters",{...unavailable,reason:e.target.value})}/></label>}
    </section>

    <section className="space-y-3">
      <h4 className="border-b border-slate-700 pb-1 text-xs font-bold uppercase tracking-widest text-amber-400">Named members</h4>
      {value.members.map((member,i)=><div key={i} className="flex items-end gap-2">
        <label className={`${field} min-w-0 flex-1`}>Member {i+1}<input disabled={disabled} maxLength={160} className={input} value={member} onChange={e=>change("members",value.members.map((v,index)=>index===i?e.target.value:v))}/></label>
        <button type="button" disabled={disabled} className={btn} onClick={()=>change("members",value.members.filter((_,index)=>index!==i))}>Remove</button>
      </div>)}
      <button type="button" disabled={disabled||value.members.length>=60} className={btn} onClick={()=>change("members",[...value.members,"New member"])}>+ Add member</button>
    </section>
  </div>;
}
