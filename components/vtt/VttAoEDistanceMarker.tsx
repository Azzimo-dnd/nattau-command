"use client";
import {useEffect,useMemo,useRef} from "react";
import {useFrame,useThree} from "@react-three/fiber";
import * as THREE from "three";
import {aoeLabelOffset,formatAoEDistance} from "./vttAoEMath";

/** Stable, high-contrast screen-pixel label anchored to the measured position.
 * Unlike a perspective-sized 3D sprite, text stays readable when zooming out.
 * Its DOM element is pointer-transparent so it never blocks table controls.
 */
export function VttAoEDistanceMarker({distance,feetPerSquare,direction,color="#d8b4fe",lineHeight=0.045,kind="radius"}:{
 distance:number;feetPerSquare:number;direction:number;color?:string;lineHeight?:number;kind?:"radius"|"cone";
}){
 const {gl,camera,size}=useThree();
 const anchor=useRef<THREE.Group>(null);
 const element=useRef<HTMLDivElement|null>(null);
 const projection=useRef(new THREE.Vector3());
 const offset=useMemo(()=>aoeLabelOffset(distance,direction),[distance,direction]);
 const label=formatAoEDistance(distance,feetPerSquare);
 const visible=distance>=0.02&&Number.isFinite(distance)&&label!=="—"&&Number.isFinite(direction);
 const text=`${kind==="cone"?"CONE":"RADIUS"} · ${label}`;
 useEffect(()=>{
  if(!visible)return;
  const host=gl.domElement.parentElement;
  if(!host)return;
  const node=document.createElement("div");
  node.className="vtt-distance-label";
  node.setAttribute("role","note");
  node.setAttribute("aria-label",text);
  node.textContent=text;
  Object.assign(node.style,{
   position:"absolute",left:"0px",top:"0px",zIndex:"5",
   whiteSpace:"nowrap",pointerEvents:"none",userSelect:"none",
   font:"800 15px/1.2 system-ui, -apple-system, sans-serif",
   letterSpacing:"0.035em",color:"#ffffff",textShadow:"0 1px 2px #020617",
   background:"rgba(2,6,23,0.97)",border:`2px solid ${color}`,borderRadius:"10px",
   padding:"7px 11px",boxShadow:"0 4px 16px rgba(0,0,0,0.85)",
   transform:"translate(-10000px,-10000px)",willChange:"transform",
  });
  host.appendChild(node);
  element.current=node;
  return ()=>{if(element.current===node)element.current=null;node.remove();};
 },[gl,visible,color,text]);
 useFrame(()=>{
  const labelNode=element.current,marker=anchor.current;
  if(!labelNode||!marker)return;
  marker.getWorldPosition(projection.current);
  projection.current.project(camera);
  const p=projection.current;
  if(p.z<-1||p.z>1||Math.abs(p.x)>1.15||Math.abs(p.y)>1.15){
   if(labelNode.style.visibility!=="hidden")labelNode.style.visibility="hidden";
   return;
  }
  if(labelNode.style.visibility!=="visible")labelNode.style.visibility="visible";
  const x=(p.x*0.5+0.5)*size.width;
  const y=(-p.y*0.5+0.5)*size.height;
  labelNode.style.transform=`translate(-50%, -115%) translate(${Math.round(x)}px, ${Math.round(y)}px)`;
 });
 const line=useMemo(()=>{
  if(!visible)return null;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute([
   0,lineHeight,0,Math.cos(direction)*distance,lineHeight,Math.sin(direction)*distance,
  ],3));
  return geometry;
 },[visible,lineHeight,direction,distance]);
 useEffect(()=>()=>line?.dispose(),[line]);
 if(!visible)return null;
 return <group name="area-distance-marker">
  {line&&<lineSegments geometry={line} raycast={()=>undefined} renderOrder={1}>
   <lineBasicMaterial color={color} transparent opacity={0.86} depthWrite={false} depthTest={false}/>
  </lineSegments>}
  <group ref={anchor} position={[offset[0],0.34,offset[1]]}/>
 </group>;
}
