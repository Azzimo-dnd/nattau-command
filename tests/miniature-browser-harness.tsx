// Browser-only regression harness. Bundle with esbuild; never exposed as an app route.
import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { MiniatureViewer, type MiniatureModelInfo } from "../components/miniatures/MiniatureViewer";
import { loadMiniatureAsset, disposeMiniatureScene } from "../components/miniatures/miniatureAsset";
import { loadMiniatureGeometry, prepareMiniatureWebFile } from "../components/miniatures/miniatureModelFiles";
import { makeMiniatureGlb } from "./fixtures/miniatureGlb";
import { VttCanvas } from "../components/vtt/VttCanvas";
import { VttSelectionPanel } from "../components/vtt/VttSelectionPanel";
import { createClient } from "../lib/supabase/client";
import type { VttScene, VttToken } from "../components/vtt/vttTypes";
import { MiniatureManager } from "../components/miniatures/MiniatureManager";
import { VttEnemyStudio } from "../components/vtt/VttEnemyStudio";

const supabase = createClient();
const noop = () => {};
const scene: VttScene = { id: "scene", campaign_id: "test", name: "Test", grid_width: 6, grid_height: 6, feet_per_square: 5, is_active: true, visible_to_players: true, map_storage_path: null, map_original_name: null, map_opacity: 1, grid_opacity: 0.7, show_grid: true, show_nameplates: false, map_scale: 1, map_offset_x: 0, map_offset_z: 0, initiative_active: false, initiative_round: 1, initiative_current_token_id: null };
const token: VttToken = { id: "one", name: "Textured hero", source_kind: "enemy", x: -0.8, z: 0, rotation: 0, scale: 1, size_squares: 1, visible_to_players: true, model_storage_path: "test/hero.web.glb", model_file_name: "hero.web.glb", model_format: "glb", paint_storage_path: null, revision: 0, initiative: null };
function Harness() {
  const [file, setFile] = useState<File | null>(null);
  const [scale, setScale] = useState(1);
  const [result, setResult] = useState("");
  const [tokens, setTokens] = useState([token, { ...token, id: "two", x: 0.8, visible_to_players: false }]);
  const [selectedIds, setSelectedIds] = useState(["one"]);
  const loaded = useCallback((next: File, info: MiniatureModelInfo) => { setFile(next); setScale(info.visualScale); setResult("Loaded " + info.format); }, []);
  const save = async () => {
    if (!file) return;
    const blob = await prepareMiniatureWebFile(file, scale);
    const asset = await loadMiniatureAsset(new File([blob], "saved.web.glb"));
    let textured = 0;
    asset.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        const image = (material as THREE.MeshStandardMaterial).map?.image as { width?: number } | undefined;
        if (image?.width) textured++;
      }
    });
    setResult(JSON.stringify({ meshes: asset.meshCount, textured, scale: asset.visualScale, height: asset.height }));
    disposeMiniatureScene(asset.scene);
  };
  return <main>
    <h1>Miniature import regression</h1>
    <MiniatureViewer sourceFile={undefined} campaignId="test" visualScale={scale} onVisualScaleChange={setScale} onLocalFileLoaded={loaded} onLocalFileCleared={() => setFile(null)} />
    <button onClick={() => void save()}>Save and reload GLB</button><output id="result">{result}</output>
    <h2>VTT: visible and hidden instances share the asset</h2>
    <div style={{height: 500, position: "relative"}}><VttCanvas scene={scene} tokens={tokens} isDm selectedIds={selectedIds} supabase={supabase} toolMode="navigate" measureStart={null} measureEnd={null} ping={null} diceRolls={[]} fogEnabled={false} fogBaseState="revealed" fogRegions={[]} fogEditing={false} fogOperation="reveal" fogShape="rectangle" fogDraftPoints={[]} onSelect={(id) => setSelectedIds(id ? [id] : [])} onLocalMove={noop} onCommitMove={noop} onMeasureStart={noop} onMeasureMove={noop} onMeasureEnd={noop} onPing={noop} onFogPointerDown={noop} onFogPointerMove={noop} onFogPointerUp={noop} onDiceComplete={noop} onDiceImpact={noop} /></div>
    <VttSelectionPanel selectedTokens={tokens.filter((t) => selectedIds.includes(t.id))} busy={false} rotationDegrees={0} onScale={(scale) => setTokens((values) => values.map((t) => selectedIds.includes(t.id) ? {...t, scale} : t))} onResize={noop} onRotateLeft={noop} onRotateRight={noop} onRotateReset={noop} onRenameEnemy={noop} onInitiative={noop} onReveal={noop} onHide={noop} onDuplicate={noop} onRemove={noop} />
    <output id="token-scale">{tokens[0].scale}</output><output id="token-footprint">{tokens[0].size_squares}</output>
  </main>;
}
async function checkLegacyStl() {
  const geometry = new THREE.BoxGeometry(20, 10, 35);
  const material = new THREE.MeshStandardMaterial();
  const file = new File([new STLExporter().parse(new THREE.Mesh(geometry, material))], "legacy.stl");
  geometry.dispose(); material.dispose();
  const web = new File([await prepareMiniatureWebFile(file, 1.25)], "legacy.web.glb");
  const source = await loadMiniatureGeometry(file);
  const derivative = await loadMiniatureGeometry(web);
  const a = source.geometry.getAttribute("position");
  const b = derivative.geometry.getAttribute("position");
  if (a.count !== b.count || a.array.some((value, index) => Math.abs(value - b.array[index]) > 0.0001)) throw new Error("STL triangle order changed");
  source.geometry.dispose(); derivative.geometry.dispose();
  const painted = await loadMiniatureAsset(web, { version: 1, triangleCount: 12, palette: [{ name: "Red", color: "#ff0000", category: "Cloth" }], runs: [[0, 12]] });
  let colorVertices = 0;
  painted.scene.traverse((object) => { if (object instanceof THREE.Mesh) colorVertices += object.geometry.getAttribute("color")?.count ?? 0; });
  const result = { triangles: painted.triangles, scale: painted.visualScale, colorVertices, originalMaterials: painted.originalMaterials };
  disposeMiniatureScene(painted.scene);
  return result;
}
Object.assign(window, { makeFixture: makeMiniatureGlb, checkLegacyStl });
const mode = new URLSearchParams(window.location.search).get("mode");
createRoot(document.getElementById("root")!).render(mode === "manager" ? <MiniatureManager campaignId="test" /> : mode === "enemy" ? <VttEnemyStudio campaignId="test" campaignSlug="nattau" /> : <Harness />);
