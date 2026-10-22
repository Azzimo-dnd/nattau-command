import { snapTokenCoordinate } from "./vttGridMath";

export type MoveToken = {
  id: string;
  x: number;
  z: number;
  size_squares: number;
};

export type GroupMovePlan = {
  valid: boolean;
  positions: Map<string, {x:number;z:number}>;
  dx: number;
  dz: number;
  reason?: string;
};

/**
 * One integer-grid displacement for every selected miniature.
 * Previews reject overlaps using *grid footprints*, not just token center points.
 * The database independently validates the same entire formation before commit.
 */
export function planTokenGroupMove(
  tokens: readonly MoveToken[], selectedIds: readonly string[], anchorId: string,
  requestedX: number, requestedZ: number, boardWidth: number, boardHeight: number,
): GroupMovePlan {
  const invalid = (reason: string): GroupMovePlan => ({valid:false,positions:new Map(),dx:0,dz:0,reason});
  if (![requestedX,requestedZ,boardWidth,boardHeight].every(Number.isFinite) || boardWidth<1 || boardHeight<1) return invalid("Invalid battlefield coordinates.");
  const ids=new Set(selectedIds);
  if(!ids.has(anchorId)) return invalid("Drag an already selected miniature.");
  const moved=tokens.filter(t=>ids.has(t.id));
  if(moved.length!==ids.size || !moved.length) return invalid("Selection contains unavailable miniatures.");
  const lead=moved.find(t=>t.id===anchorId)!;
  const goalX=snapTokenCoordinate(requestedX,boardWidth,lead.size_squares);
  const goalZ=snapTokenCoordinate(requestedZ,boardHeight,lead.size_squares);
  const dx=Math.round(goalX-lead.x), dz=Math.round(goalZ-lead.z);
  const positions=new Map<string,{x:number;z:number}>();
  const footprints: Array<{id:string;x:number;z:number;size:number}> = [];
  for(const token of tokens){
    if(!Number.isFinite(token.x)||!Number.isFinite(token.z)||!Number.isFinite(token.size_squares)||token.size_squares<0.5) return invalid("Invalid miniature footprint.");
    const x=ids.has(token.id)?token.x+dx:token.x;
    const z=ids.has(token.id)?token.z+dz:token.z;
    if(ids.has(token.id)){
      if(x-token.size_squares/2 < -boardWidth/2-1e-8 || x+token.size_squares/2 > boardWidth/2+1e-8 ||
         z-token.size_squares/2 < -boardHeight/2-1e-8 || z+token.size_squares/2 > boardHeight/2+1e-8)
        return invalid("The entire formation must fit inside the map.");
      positions.set(token.id,{x,z});
    }
    footprints.push({id:token.id,x,z,size:token.size_squares});
  }
  // Both moving and stationary figures are checked, including hidden GM actors.
  for(let i=0;i<footprints.length;i++) for(let j=i+1;j<footprints.length;j++){
    const a=footprints[i],b=footprints[j];
    if(!ids.has(a.id)&&!ids.has(b.id)) continue; // existing stationary overlaps are not modified
    const half=(a.size+b.size)/2;
    if(Math.abs(a.x-b.x)<half-1e-8 && Math.abs(a.z-b.z)<half-1e-8)
      return invalid("Destination occupied by another miniature; move the group to free squares.");
  }
  return {valid:true,positions,dx,dz};
}

/** Token centers inside a dragged box; the box may be dragged in any direction. */
export function tokensInSelectionBox(tokens: readonly MoveToken[], start:readonly [number,number], end:readonly [number,number]): string[] {
  const minX=Math.min(start[0],end[0]),maxX=Math.max(start[0],end[0]);
  const minZ=Math.min(start[1],end[1]),maxZ=Math.max(start[1],end[1]);
  return tokens.filter(t=>t.x>=minX&&t.x<=maxX&&t.z>=minZ&&t.z<=maxZ).map(t=>t.id);
}
