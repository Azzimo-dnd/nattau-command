"use client";

import {useEffect,useMemo} from "react";
import * as THREE from "three";

/** Reusable distance label for the preview and all persisted templates.
 * Distances are stored in map squares; the scene supplies feet per square.
 */
export function formatAoEDistance(squares:number,feetPerSquare:number):string {
 if(!Number.isFinite(squares)||squares<0||!Number.isFinite(feetPerSquare)||feetPerSquare<=0)return "—";
 const show=(value:number)=>Number(value.toFixed(1)).toLocaleString("en-US",{maximumFractionDigits:1});
 return `${show(squares*feetPerSquare)} ft · ${show(squares)} sq`;
}

/** Where the distance annotation sits. Center the label halfway along the
 * radius/axis so it remains inside the area rather than spilling off the tip.
 */
export function aoeLabelOffset(distance:number,direction:number):[number,number] {
 if(!Number.isFinite(distance)||!Number.isFinite(direction)||distance<=0)return [0,0];
 return [Math.cos(direction)*distance*0.5,Math.sin(direction)*distance*0.5];
}

export function VttAoEDistanceMarker({distance,feetPerSquare,direction,color="#d8b4fe",lineHeight=0.045}:{
 distance:number;feetPerSquare:number;direction:number;color?:string;lineHeight?:number;
}){
 const label=formatAoEDistance(distance,feetPerSquare);
 const offset=aoeLabelOffset(distance,direction);
 const texture=useMemo(()=>{
  if(typeof document==="undefined"||label==="—")return null;
  const canvas=document.createElement("canvas");canvas.width=384;canvas.height=92;
  const ctx=canvas.getContext("2d");if(!ctx)return null;
  ctx.fillStyle="rgba(2,6,23,0.92)";
  ctx.beginPath();ctx.roundRect(3,3,378,86,18);ctx.fill();
  ctx.strokeStyle=color;ctx.lineWidth=4;ctx.stroke();
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.font="bold 32px sans-serif";ctx.fillStyle="#f8fafc";
  ctx.fillText(label,192,47,354);
  const t=new THREE.CanvasTexture(canvas);
  t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;
  return t;
 },[label,color]);
 useEffect(()=>()=>texture?.dispose(),[texture]);
 const line=useMemo(()=>{
  if(!Number.isFinite(distance)||distance<0.02||!Number.isFinite(direction))return null;
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute([
   0,lineHeight,0,Math.cos(direction)*distance,lineHeight,Math.sin(direction)*distance,
  ],3));
  return g;
 },[distance,direction,lineHeight]);
 useEffect(()=>()=>line?.dispose(),[line]);
 if(distance<0.02||!Number.isFinite(distance)||!Number.isFinite(feetPerSquare)||
   feetPerSquare<=0||!Number.isFinite(direction)||!texture)return null;
 return <group name="area-distance-marker">
  {line&&<lineSegments geometry={line} raycast={()=>undefined} renderOrder={1}>
   <lineBasicMaterial color={color} transparent opacity={0.8} depthWrite={false} depthTest={false}/>
  </lineSegments>}
  <sprite position={[offset[0],0.34,offset[1]]} scale={[1.4,0.335,1]}
   raycast={()=>undefined} renderOrder={3}>
   <spriteMaterial map={texture} transparent depthWrite={false} depthTest={false}
     sizeAttenuation={true} toneMapped={false}/>
  </sprite>
 </group>;
}
