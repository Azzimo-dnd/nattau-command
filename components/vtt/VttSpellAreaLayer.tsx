"use client";
import {useEffect,useMemo} from "react";
import * as THREE from "three";
import {coneCorners} from "./vttConeMath";
import type {VttSpellArea} from "./vttSpellAreas";

/** A true 5e flat-ended triangle, width L at distance L from the origin.
 * No raycasting: this is an overlay and must never intercept token selection.
 * Render order remains below the fog layer as for existing saved circles.
 */
export function VttConeShape({length,direction,color="#d8b4fe",opacity=0.2}:{
 length:number;direction:number;color?:string;opacity?:number;
}){
 const triangles=useMemo(()=>{
  if(!Number.isFinite(length)||length<0.02||!Number.isFinite(direction))return null;
  const [o,l,r]=coneCorners(length,direction);
  const fill=new THREE.BufferGeometry();
  fill.setAttribute("position",new THREE.Float32BufferAttribute([o[0],0,o[1],l[0],0,l[1],r[0],0,r[1]],3));
  fill.setIndex([0,1,2]);fill.computeVertexNormals();
  const outline=new THREE.BufferGeometry();
  outline.setAttribute("position",new THREE.Float32BufferAttribute([
   o[0],0.003,o[1],l[0],0.003,l[1],
   l[0],0.003,l[1],r[0],0.003,r[1],
   r[0],0.003,r[1],o[0],0.003,o[1],
  ],3));
  return {fill,outline};
 },[length,direction]);
 useEffect(()=>()=>{triangles?.fill.dispose();triangles?.outline.dispose();},[triangles]);
 if(!triangles)return null;
 return <group renderOrder={1}>
  <mesh geometry={triangles.fill} raycast={()=>undefined} renderOrder={1}>
   <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} depthTest={false} side={THREE.DoubleSide}/>
  </mesh>
  <lineSegments geometry={triangles.outline} raycast={()=>undefined} renderOrder={1}>
   <lineBasicMaterial color={color} transparent opacity={0.97} depthWrite={false} depthTest={false}/>
  </lineSegments>
 </group>;
}

export function VttSpellAreaLayer({areas}:{areas:VttSpellArea[]}){
 return <group name="persistent-spell-areas">
  {areas.map(a=><group key={a.id} position={[a.center_x,0.015,a.center_z]}>
   {a.shape_type==="cone"
     ? <VttConeShape length={a.radius} direction={a.direction_rad} color={a.color}/>
     : <>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.012,0]} renderOrder={1} raycast={()=>undefined}>
       <circleGeometry args={[a.radius,96]}/>
       <meshBasicMaterial color={a.color} transparent opacity={0.20} depthWrite={false} depthTest={false} side={THREE.DoubleSide}/>
      </mesh>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.014,0]} renderOrder={1} raycast={()=>undefined}>
       <ringGeometry args={[Math.max(0.01,a.radius-0.045),a.radius+0.045,96]}/>
       <meshBasicMaterial color={a.color} transparent opacity={0.95} depthWrite={false} depthTest={false} side={THREE.DoubleSide}/>
      </mesh>
     </>}
  </group>)}
 </group>;
}
