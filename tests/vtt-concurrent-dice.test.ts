import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {test} from "node:test";
import {allocateVttDiceSlot,vttDiceLaneOffset,VTT_DICE_MAX_CONCURRENT} from "../components/vtt/vttDiceLayout";

test("Eight players and GM can all have separate physical dice on the same VTT scene",()=>{
 const assigned=new Set<number>();
 for(let i=0;i<9;i++){
   const slot=allocateVttDiceSlot(assigned);
   assert.ok(slot>=0);
   assert.equal(assigned.has(slot),false);
   assigned.add(slot);
 }
 assert.equal(assigned.size,9);
 assert.equal(VTT_DICE_MAX_CONCURRENT,12);
 const locations=[...assigned].map(s=>vttDiceLaneOffset(s,30,30));
 assert.equal(new Set(locations.map(x=>x.join(","))).size,9);
});
test("Slots are stable when other participants finish",()=>{
 const busy=new Set([0,1,2,3,4,5,6,7]);
 busy.delete(3);
 assert.equal(allocateVttDiceSlot(busy),3);
 assert.ok(busy.has(6));
});
test("At the safety limit new rolls are explicitly capped, not silently overlaid",()=>{
 const busy=new Set(Array.from({length:VTT_DICE_MAX_CONCURRENT},(_,i)=>i));
 assert.equal(allocateVttDiceSlot(busy),-1);
 assert.throws(()=>vttDiceLaneOffset(-1,30,30),/Invalid/);
 assert.throws(()=>vttDiceLaneOffset(12,30,30),/Invalid/);
 assert.throws(()=>vttDiceLaneOffset(0,0,30),/Invalid/);
});
test("Each roll has independent physics and is rendered with its own name and colored slot",()=>{
 const layer=readFileSync(new URL("../components/vtt/VttCanvas.tsx",import.meta.url),"utf8");
 const physics=readFileSync(new URL("../components/vtt/VttDiceLayer.tsx",import.meta.url),"utf8");
 const bar=readFileSync(new URL("../components/vtt/VttDiceBar.tsx",import.meta.url),"utf8");
 assert.match(layer,/diceRolls\.map\(\(\{envelope,slot\}\)/);
 assert.match(layer,/spawnOffsetX=\{spawnOffsetX\}/);
 assert.match(layer,/<VttDiceRollNameplate/);
 assert.match(physics,/<Physics[\s\S]*key=\{request\.rollId\}/);
 assert.match(bar,/activeRolls\.map\(/);
 assert.match(bar,/resultToasts\.map\(/);
});
test("Concurrent results use a per-roll map and never drop other players' pending throws",()=>{
 const src=readFileSync(new URL("../components/vtt/useVttDice.ts",import.meta.url),"utf8");
 assert.match(src,/activeRollsRef=useRef\(new Map<string,VttActiveDiceRoll>\(\)\)/);
 assert.match(src,/activeRollsRef\.current\.set\(envelope\.rollId,\{envelope,slot\}\)/);
 assert.match(src,/activeRollsRef\.current\.get\(physicsResult\.rollId\)/);
 assert.match(src,/clearActiveAfter\(payload\.rollId,3200\)/);
 assert.match(src,/showResult\(payload\)/);
 assert.doesNotMatch(src,/A second simultaneous\s+broadcast is ignored/);
});
test("GM secret dice remain unbroadcast even during concurrent public rolls",()=>{
 const src=readFileSync(new URL("../components/vtt/useVttDice.ts",import.meta.url),"utf8");
 assert.match(src,/if\(visibleToPlayers\)void channelRef\.current\?\.send/);
 assert.match(src,/if\(pending\.visibleToPlayers\)void channelRef\.current\?\.send/);
});
