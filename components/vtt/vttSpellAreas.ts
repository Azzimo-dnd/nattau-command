import type {SpellShape} from "./vttConeMath";
export const SPELL_AREA_COLORS = [
  {label:"Fire",hex:"#f97316"},
  {label:"Poison",hex:"#84cc16"},
  {label:"Frost",hex:"#38bdf8"},
  {label:"Shadow",hex:"#a78bfa"},
  {label:"Holy",hex:"#facc15"},
  {label:"Blood",hex:"#f43f5e"},
] as const;
export type VttSpellArea = {
 id:string;campaign_id:string;scene_id:string;label:string;color:string;
 center_x:number;center_z:number;radius:number;shape_type:SpellShape;direction_rad:number;
 visible_to_players:boolean;created_at:string;
};
export type SharedMeasure = {
 senderId:string;mode:"ruler"|"radius"|"cone";
 start:[number,number];end:[number,number];
};
export function safeSpellRadius(start:[number,number],end:[number,number],width:number,height:number):number{
 const r=Math.hypot(end[0]-start[0],end[1]-start[1]);
 if (![...start,...end,width,height,r].every(Number.isFinite)||r<0.1||r>Math.max(width,height))throw Error("Choose a valid radius within this scene.");
 return Math.round(r*100)/100;
}
export function validSharedMeasure(value:unknown): value is Omit<SharedMeasure,"senderId"> {
 if(!value||typeof value!=="object")return false;
 const item=value as Record<string,unknown>;
 return (item.mode==="ruler"||item.mode==="radius"||item.mode==="cone") &&
  [item.start,item.end].every(point=>Array.isArray(point)&&point.length===2&&
  point.every(n=>typeof n==="number"&&Number.isFinite(n)&&Math.abs(n)<1000));
}
