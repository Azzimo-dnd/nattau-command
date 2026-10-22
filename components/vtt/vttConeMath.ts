/** Spell template geometry in map coordinates (x,z).
 * For 5e a cone's width at length L is L; we use a triangle with a flat far edge,
 * i.e. a half-width of L/2 at the base, rather than a circular sector.
 */
export type MapPoint=[number,number];
export type SpellShape="circle"|"cone";
export function coneDirection(start:MapPoint,end:MapPoint):number {
 return Math.atan2(end[1]-start[1],end[0]-start[0]);
}
export function coneCorners(length:number,direction:number):[MapPoint,MapPoint,MapPoint] {
 if(!Number.isFinite(length)||length<=0||!Number.isFinite(direction))throw new Error("Invalid cone geometry.");
 const cos=Math.cos(direction),sin=Math.sin(direction),half=length/2;
 return [[0,0],[length*cos-half*sin,length*sin+half*cos],
   [length*cos+half*sin,length*sin-half*cos]];
}
export function safeConeTemplate(start:MapPoint,end:MapPoint,width:number,height:number) {
 const length=Math.hypot(end[0]-start[0],end[1]-start[1]);
 if (![...start,...end,width,height,length].every(Number.isFinite)||
   start[0]<-width/2||start[0]>width/2||
   start[1]<-height/2||start[1]>height/2||
   length<0.1||length>Math.min(100,Math.max(width,height))) {
   throw new Error("Choose a valid cone origin and length within this scene.");
 }
 return {length:Math.round(length*100)/100,direction:coneDirection(start,end)};
}
/** Polygon intersection test for VTT's future target highlighting. */
export function isInsideCone(point:MapPoint,origin:MapPoint,length:number,direction:number):boolean {
 if(length<=0||!Number.isFinite(length)||!Number.isFinite(direction))return false;
 const dx=point[0]-origin[0],dz=point[1]-origin[1];
 const forward=dx*Math.cos(direction)+dz*Math.sin(direction);
 const lateral=-dx*Math.sin(direction)+dz*Math.cos(direction);
 return forward>=0&&forward<=length&&Math.abs(lateral)<=forward/2+1e-9;
}
