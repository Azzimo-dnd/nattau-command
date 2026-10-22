/** VTT floor coordinates are already expressed in grid squares:
 * one world-unit length is exactly one square; feetPerSquare comes from scene.
 */
export type AoEPoint=[number,number];

export function formatAoEDistance(squares:number,feetPerSquare:number):string{
 if(!Number.isFinite(squares)||squares<0||!Number.isFinite(feetPerSquare)||feetPerSquare<=0)return "—";
 const ft=squares*feetPerSquare;
 if(!Number.isFinite(ft))return "—";
 return `${Number(ft.toFixed(1)).toLocaleString("en-US",{maximumFractionDigits:1})} ft`;
}

/** Snap only the *distance*, keeping the dragged heading precise and the
 * origin unchanged. Measured geometry and its displayed number then match.
 */
export function snapAoEEdge(start:AoEPoint,end:AoEPoint,squaresStep=1):AoEPoint{
 const dx=end[0]-start[0],dz=end[1]-start[1];
 const raw=Math.hypot(dx,dz);
 if(![...start,...end,squaresStep,raw].every(Number.isFinite)||squaresStep<=0) return end;
 if(raw<0.02)return start;
 const snapped=Math.max(squaresStep,Math.round(raw/squaresStep)*squaresStep);
 return [start[0]+dx/raw*snapped,start[1]+dz/raw*snapped];
}
export function aoeLabelOffset(distance:number,direction:number):AoEPoint{
 if(!Number.isFinite(distance)||!Number.isFinite(direction)||distance<=0)return [0,0];
 return [Math.cos(direction)*distance*0.5,Math.sin(direction)*distance*0.5];
}
