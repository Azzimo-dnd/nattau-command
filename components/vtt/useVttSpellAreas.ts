"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {createClient} from "@/lib/supabase/client";
import {safeSpellRadius,type VttSpellArea} from "./vttSpellAreas";

const FIELDS="id,campaign_id,scene_id,label,color,center_x,center_z,radius,visible_to_players,created_at";
export function useVttSpellAreas(
 campaignId:string,sceneId:string|null,width:number,height:number,isDm:boolean,
 refreshNonce:number,onChanged:()=>void,
){
 const supabase=useMemo(()=>createClient(),[]);
 const [areas,setAreas]=useState<VttSpellArea[]>([]);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState<string|null>(null);
 const [notice,setNotice]=useState<string|null>(null);
 const serial=useRef(0);
 const refresh=useCallback(async()=>{
  const request=++serial.current;
  if(!sceneId){setAreas([]);return;}
  setLoading(true);
  try{
   const {data,error:readError}=await supabase.from("vtt_spell_areas").select(FIELDS)
     .eq("campaign_id",campaignId).eq("scene_id",sceneId).order("created_at",{ascending:true});
   if(readError)throw readError;
   if(request===serial.current){setAreas((data??[]) as VttSpellArea[]);setError(null);}
  }catch(e){if(request===serial.current){setError(e instanceof Error?e.message:"Cannot load spell areas.");setAreas([]);}}
  finally{if(request===serial.current)setLoading(false);}
 },[supabase,campaignId,sceneId]);
 useEffect(()=>{void refresh();return()=>{++serial.current;};},[refresh,refreshNonce]);
 const mutate=useCallback(async(run:()=>Promise<void>,success:string)=>{
  if(!sceneId||!isDm||busy)return false;
  setBusy(true);setError(null);setNotice(null);
  try{await run();await refresh();onChanged();setNotice(success);return true;}
  catch(e){setError(e instanceof Error?e.message:"Spell area operation failed.");return false;}
  finally{setBusy(false);}
 },[sceneId,isDm,busy,refresh,onChanged]);
 const add=useCallback((label:string,color:string,center:[number,number],edge:[number,number],visible:boolean)=>{
  return mutate(async()=>{
   if(!label.trim()||label.trim().length>80)throw Error("Enter a name (1–80 characters).");
   if(!/^#[0-9a-fA-F]{6}$/.test(color))throw Error("Invalid spell area color.");
   const radius=safeSpellRadius(center,edge,width,height);
   const {error:writeError}=await supabase.from("vtt_spell_areas").insert({
    campaign_id:campaignId,scene_id:sceneId,label:label.trim(),color,
    center_x:center[0],center_z:center[1],radius,visible_to_players:visible,
   });
   if(writeError)throw writeError;
  },"Persistent spell area added.");
 },[campaignId,sceneId,width,height,mutate,supabase]);
 const remove=useCallback((id:string)=>mutate(async()=>{
  const {data,error:writeError}=await supabase.from("vtt_spell_areas")
   .delete().eq("id",id).eq("campaign_id",campaignId).eq("scene_id",sceneId!)
   .select("id");
  if(writeError)throw writeError;
  if(data?.length!==1)throw Error("Area was not removed.");
 },"Spell area removed."),[mutate,supabase,campaignId,sceneId]);
 const setVisible=useCallback((id:string,visible:boolean)=>mutate(async()=>{
  const {data,error:writeError}=await supabase.from("vtt_spell_areas")
   .update({visible_to_players:visible})
   .eq("id",id).eq("campaign_id",campaignId).eq("scene_id",sceneId!).select("id");
  if(writeError)throw writeError;
  if(data?.length!==1)throw Error("Area visibility was not changed.");
 },"Visibility updated."),[mutate,supabase,campaignId,sceneId]);
 return {areas,loading,busy,error,notice,add,remove,setVisible,refresh};
}
