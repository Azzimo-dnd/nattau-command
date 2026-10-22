import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {aoeLabelOffset,formatAoEDistance} from "../components/vtt/VttAoEDistanceMarker";
import {isFogPointRevealed} from "../components/vtt/vttFogMath";

test("AoE distance uses each scene's feet-per-square scale for circle radius and cone length",()=>{
 assert.equal(formatAoEDistance(6,5),"30 ft · 6 sq");
 assert.equal(formatAoEDistance(3.5,5),"17.5 ft · 3.5 sq");
 assert.equal(formatAoEDistance(6,10),"60 ft · 6 sq");
 assert.equal(formatAoEDistance(6,1),"6 ft · 6 sq");
 assert.equal(formatAoEDistance(0.333,5),"1.7 ft · 0.3 sq");
});

test("Invalid scales and measurements cannot render deceptive distances",()=>{
 assert.equal(formatAoEDistance(6,0),"—");
 assert.equal(formatAoEDistance(Infinity,5),"—");
 assert.equal(formatAoEDistance(-2,5),"—");
 assert.equal(formatAoEDistance(6,NaN),"—");
});
test("Label anchor lies halfway down a cone axis and inside circle's radius",()=>{
 assert.deepEqual(aoeLabelOffset(6,0),[3,0]);
 assert.ok(Math.abs(aoeLabelOffset(8,Math.PI/2)[1]-4)<1e-10);
 assert.deepEqual(aoeLabelOffset(0,0),[0,0]);
 assert.deepEqual(aoeLabelOffset(Infinity,0),[0,0]);
});
test("Fog handling can suppress saved distance labels on player-hidden positions",()=>{
 const regions=[{id:1,scene_id:"s",operation:"reveal" as const,shape:"rectangle" as const,
  points:[[1,1],[3,3]] as [number,number][],created_at:"2026-10-22"}];
 assert.equal(isFogPointRevealed(true,"covered",regions,2,2),true);
 assert.equal(isFogPointRevealed(true,"covered",regions,4,2),false);
 assert.equal(isFogPointRevealed(false,"covered",regions,4,2),true);
});
test("Saved circles, saved cones and temporary shared measurements all receive map labels",()=>{
 const layer=readFileSync(new URL("../components/vtt/VttSpellAreaLayer.tsx",import.meta.url),"utf8");
 const canvas=readFileSync(new URL("../components/vtt/VttCanvas.tsx",import.meta.url),"utf8");
 assert.match(layer,/labelRevealed\(a\).*<VttAoEDistanceMarker/s);
 assert.match(layer,/a\.shape_type==="cone"\?a\.direction_rad:0/);
 assert.match(canvas,/mode==="cone"[\s\S]*?<VttAoEDistanceMarker/);
 assert.match(canvas,/distance=\{radius\}[\s\S]*?feetPerSquare=\{feetPerSquare\}/);
 assert.match(canvas,/<MeasurementOverlay mode=\{toolMode\}[\s\S]*?<MeasurementOverlay key=\{remote\.senderId\}/);
});
