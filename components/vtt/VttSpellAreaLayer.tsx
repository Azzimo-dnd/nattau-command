"use client";
import * as THREE from "three";
import type {VttSpellArea} from "./vttSpellAreas";
/** Spell circles are beneath fog (renderOrder=1, fog=2) so unexplored
 * portions of a permanent area remain hidden on player screens.
 */
export function VttSpellAreaLayer({areas}:{areas:VttSpellArea[]}){
 return <group name="persistent-spell-areas">
  {areas.map(a=><group key={a.id} position={[a.center_x,0,a.center_z]}>
   <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.012,0]} renderOrder={1} raycast={()=>undefined}>
    <circleGeometry args={[a.radius,96]}/>
    <meshBasicMaterial color={a.color} transparent opacity={0.20} depthWrite={false} depthTest={false} side={THREE.DoubleSide}/>
   </mesh>
   <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.014,0]} renderOrder={1} raycast={()=>undefined}>
    <ringGeometry args={[Math.max(0.01,a.radius-0.045),a.radius+0.045,96]}/>
    <meshBasicMaterial color={a.color} transparent opacity={0.95} depthWrite={false} depthTest={false} side={THREE.DoubleSide}/>
   </mesh>
  </group>)}
 </group>;
}
