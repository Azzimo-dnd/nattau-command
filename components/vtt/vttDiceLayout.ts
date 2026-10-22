/** Assign each concurrent throw a stable 4x3 area of the floor.
 * Slot assignments live for the lifetime of the roll, never change while dice move.
 * Each roll has its own Rapier world and walls, so separate players' throws don't
 * interfere with each other's authoritative results.
 */
export const VTT_DICE_COLUMNS=4;
export const VTT_DICE_ROWS=3;
export const VTT_DICE_MAX_CONCURRENT=VTT_DICE_COLUMNS*VTT_DICE_ROWS;
export function vttDiceLaneOffset(slot:number,width:number,height:number):[number,number]{
 if(!Number.isInteger(slot)||slot<0||slot>=VTT_DICE_MAX_CONCURRENT||
    !Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)
  throw new Error("Invalid VTT dice lane");
 const col=slot%VTT_DICE_COLUMNS,row=Math.floor(slot/VTT_DICE_COLUMNS);
 return [((col+0.5)/VTT_DICE_COLUMNS-0.5)*width,
         ((row+0.5)/VTT_DICE_ROWS-0.5)*height];
}
export const VTT_DICE_LANE_COLORS=[
 "#38bdf8","#fb923c","#a3e635","#c084fc",
 "#f472b6","#facc15","#2dd4bf","#f87171",
 "#93c5fd","#fdba74","#bef264","#d8b4fe",
];
