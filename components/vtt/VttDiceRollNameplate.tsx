"use client";
import {useEffect,useRef} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import * as THREE from "three";
import {VTT_DICE_LANE_COLORS} from "./vttDiceLayout";

/** A readable nameplate over each rolling participant's area of the map.
 * HTML is pointer-transparent; labels scale in screen pixels, not with zoom.
 */
export function VttDiceRollNameplate({name,expression,slot,x,z}:{
  name:string;expression:string;slot:number;x:number;z:number;
}){
 const {gl,camera,size}=useThree();
 const world=useRef<THREE.Group>(null);
 const div=useRef<HTMLDivElement|null>(null);
 const projected=useRef(new THREE.Vector3());
 useEffect(()=>{
  const host=gl.domElement.parentElement;if(!host)return;
  const el=document.createElement("div");
  el.setAttribute("role","note");
  el.setAttribute("aria-label",`${name} rolling ${expression}`);
  el.textContent=`🎲 ${name} · ${expression}`;
  Object.assign(el.style,{
    position:"absolute",left:"0px",top:"0px",zIndex:"8",
    pointerEvents:"none",whiteSpace:"nowrap",userSelect:"none",
    maxWidth:"210px",overflow:"hidden",textOverflow:"ellipsis",
    color:"#fff",background:"rgba(2,6,23,0.96)",
    font:"800 13px/1.25 system-ui,sans-serif",padding:"6px 10px",
    borderRadius:"9px",border:`2px solid ${VTT_DICE_LANE_COLORS[slot]}`,
    boxShadow:"0 4px 18px rgba(0,0,0,0.85)",
    transform:"translate(-10000px,-10000px)",
  });
  host.appendChild(el);div.current=el;
  return ()=>{if(div.current===el)div.current=null;el.remove();};
 },[gl,name,expression,slot]);
 useFrame(()=>{
  const element=div.current,anchor=world.current;
  if(!element||!anchor)return;
  anchor.getWorldPosition(projected.current);
  projected.current.project(camera);
  const p=projected.current;
  if(p.z<-1||p.z>1||Math.abs(p.x)>1.1||Math.abs(p.y)>1.1){
    element.style.visibility="hidden";return;
  }
  element.style.visibility="visible";
  const sx=Math.round((p.x*0.5+0.5)*size.width);
  const sy=Math.round((-p.y*0.5+0.5)*size.height);
  element.style.transform=`translate(-50%,-125%) translate(${sx}px,${sy}px)`;
 });
 return <group ref={world} position={[x,1.1,z]}/>;
}
