import {
  GALLEON_STATS, canGalleonFly, canGalleonTravelForward, galleonStatusLabel,
  type StrategicGalleon,
} from "@/lib/strategic-map/galleon";

function PartHealth({name,hp,max,ac}:{name:string;hp:number;max:number;ac:number}) {
  const fraction=Math.min(100,Math.max(0,hp/max*100));
  const color=hp===0?"bg-red-500":fraction<=25?"bg-orange-500":"bg-emerald-500";
  return <div className="rounded-xl border border-slate-700/70 bg-slate-950/70 p-3">
    <div className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold text-slate-200">{name}</span><span className="text-slate-400">AC {ac}</span></div>
    <div className="mt-2 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700"><div className={`h-full ${color}`} style={{width:`${fraction}%`}} /></div><span className="min-w-20 text-right text-sm font-bold text-white">{hp} / {max}</span></div>
  </div>;
}

export function GalleonDossier({galleon}:{galleon:StrategicGalleon}) {
  const flying=canGalleonFly(galleon);
  const advancing=canGalleonTravelForward(galleon);
  return <article className="rounded-xl border border-amber-600/35 bg-slate-950/70 p-4 md:p-5" aria-label="Kainite flying galleon information">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3"><span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full border border-amber-400/60 bg-amber-950/40 text-2xl">⛵</span><div><p className="text-xs uppercase tracking-widest text-amber-400">Party vessel · Kainites</p><h3 className="mt-1 text-xl font-bold text-white">{galleon.name}</h3></div></div>
      <div className="flex flex-wrap gap-2"><span className="rounded-full border border-slate-600 px-3 py-1 text-xs text-slate-200">{galleonStatusLabel(galleon.status)}</span><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${flying?"border-emerald-500/50 text-emerald-300":"border-red-500/50 text-red-300"}`}>{flying?"Flight capable":"Unable to fly"}</span></div>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3">
      <PartHealth name="Hull" ac={GALLEON_STATS.hull.ac} hp={galleon.hull_hp} max={GALLEON_STATS.hull.maxHp}/>
      <PartHealth name="Magic Core" ac={GALLEON_STATS.core.ac} hp={galleon.core_hp} max={GALLEON_STATS.core.maxHp}/>
      <PartHealth name="Aether Sails" ac={GALLEON_STATS.sails.ac} hp={galleon.sails_hp} max={GALLEON_STATS.sails.maxHp}/>
    </div>
    <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
      <div><span className="text-slate-500">Movement:</span> {advancing?"120 ft flight · ascent 30 ft · descent 60 ft":flying?"No forward/backward movement":"Flight unavailable"}</div>
      <div><span className="text-slate-500">Crew:</span> {galleon.crew_status || "Unknown"}</div>
    </div>
    {galleon.condition_notes && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-sm text-slate-300">{galleon.condition_notes}</p>}
    {galleon.core_hp===0&&<p className="mt-3 rounded-lg border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-200">Magic core destroyed: falling 200 ft per round. Critical effect: 20d10 fire + force explosion, 30 ft radius.</p>}
    {galleon.sails_hp===0&&<p className="mt-3 rounded-lg border border-orange-500/50 bg-orange-950/20 p-3 text-sm text-orange-200">Aether sails destroyed: no forward or backward movement.</p>}
    <details className="mt-4 rounded-xl border border-slate-700 bg-slate-900/50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-amber-300">Full vessel statistics, defenses and weapons</summary>
      <div className="space-y-4 border-t border-slate-700 px-4 py-4 text-sm leading-6 text-slate-300">
        <section><h4 className="font-bold text-white">Hull defenses</h4><p>Damage threshold: {GALLEON_STATS.hull.damageThreshold} (damage below the threshold is ignored).</p><p>Resistances: {GALLEON_STATS.hull.resistances}.</p><p>Vulnerabilities: {GALLEON_STATS.hull.vulnerabilities}.</p><p>Immunities: {GALLEON_STATS.hull.immunities}.</p></section>
        <section><h4 className="font-bold text-white">Magic Core</h4><p>Destroyed: {GALLEON_STATS.core.onDestroyed}</p><p>Critical: {GALLEON_STATS.core.criticalEffect}</p></section>
        <section><h4 className="font-bold text-white">Aether Sails</h4><p>Destroyed: {GALLEON_STATS.sails.onDestroyed}</p></section>
        <section><h4 className="font-bold text-white">{GALLEON_STATS.ballistae.name} ({GALLEON_STATS.ballistae.count})</h4><p>Weapon attack: {GALLEON_STATS.ballistae.attackBonus} · Range: {GALLEON_STATS.ballistae.range} · Damage: {GALLEON_STATS.ballistae.damage}</p></section>
        <section><h4 className="font-bold text-white">{GALLEON_STATS.turret.name} ({GALLEON_STATS.turret.mount})</h4><p>Weapon attack: {GALLEON_STATS.turret.attackBonus} · Range: {GALLEON_STATS.turret.range} · Damage: {GALLEON_STATS.turret.damage} · Recharge {GALLEON_STATS.turret.recharge}</p></section>
      </div>
    </details>
  </article>;
}
