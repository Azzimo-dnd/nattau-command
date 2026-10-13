export type ArmyVisibility = "public" | "rumored" | "hidden";
export type ArmyGroup = {
 id: string; name: string; faction_key: string; commander: string | null;
 composition: string | null; strength: number | null; orders: string | null;
 condition: string | null; gm_notes?: string; visibility: ArmyVisibility;
 province_number: number | null; pos_x: number | null; pos_y: number | null;
 archived_at?: string | null;
};
export function provinceCenter(points: string): {x:number;y:number} {
 const coords = points.trim().split(/\s+/).map(pair => pair.split(",").map(Number)).filter(pair=>pair.length===2&&pair.every(Number.isFinite));
 if (!coords.length) return {x:50,y:50};
 return {x:coords.reduce((sum,p)=>sum+p[0],0)/coords.length,y:coords.reduce((sum,p)=>sum+p[1],0)/coords.length};
}
