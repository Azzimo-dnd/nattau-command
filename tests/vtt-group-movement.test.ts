import assert from "node:assert/strict";
import {test} from "node:test";
import {planTokenGroupMove,tokensInSelectionBox} from "../components/vtt/vttGroupMovement";
const troops=[
 {id:"a",x:-3.5,z:-1.5,size_squares:1},
 {id:"b",x:-2.5,z:-1.5,size_squares:1},
 {id:"c",x: 2.5,z: 1.5,size_squares:1},
];
test("simple click selection cannot alter token position (planner pure)",()=>{
 const before=JSON.stringify(troops);
 const plan=planTokenGroupMove(troops,["a"],"a",-4.5,-1.5,24,18);
 assert.equal(plan.valid,true);
 assert.equal(JSON.stringify(troops),before);
});
test("moves two selected troops preserving formation and grid alignment",()=>{
 const plan=planTokenGroupMove(troops,["a","b"],"a",-1.5,-1.5,24,18);
 assert.equal(plan.valid,true);
 assert.deepEqual(plan.positions.get("a"),{x:-1.5,z:-1.5});
 assert.deepEqual(plan.positions.get("b"),{x:-0.5,z:-1.5});
 assert.equal(plan.dx,2);
});
test("reject occupied destination by stationary miniature",()=>{
 const plan=planTokenGroupMove(troops,["a","b"],"a",1.5,1.5,24,18);
 assert.equal(plan.valid,false);
 assert.match(plan.reason!,/occupied/);
});
test("reject partial overlap for large grid footprints",()=>{
 const group=[{id:"a",x:-2.5,z:-0.5,size_squares:1},{id:"b",x:0.5,z:-0.5,size_squares:2}];
 const plan=planTokenGroupMove(group,["a"],"a",-0.5,-0.5,24,18);
 assert.equal(plan.valid,false);
});
test("reject group moving outside board without compressing formation",()=>{
 const plan=planTokenGroupMove(troops,["a","b"],"a",11.5,-1.5,24,18);
 assert.equal(plan.valid,false);
 assert.match(plan.reason!,/fit inside/);
});
test("marquee finds units regardless of box drag direction",()=>{
 assert.deepEqual(tokensInSelectionBox(troops,[-4,-2],[-2,-1]),["a","b"]);
 assert.deepEqual(tokensInSelectionBox(troops,[-2,-1],[-4,-2]),["a","b"]);
});
test("group motion rejects invalid IDs and nonnumeric coordinates",()=>{
 assert.equal(planTokenGroupMove(troops,["missing"],"missing",1,1,24,18).valid,false);
 assert.equal(planTokenGroupMove(troops,["a"],"a",NaN,1,24,18).valid,false);
});
