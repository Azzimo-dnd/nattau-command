import * as THREE from "three";
import type { TerrainRecipe } from "./terrainTypes";

// Deliberately independent from token/creature scaling: one unit = one VTT square.
const woodColors = [0x8e6342, 0x9e7450, 0x785137, 0xad7b50, 0x72513b];
const ironColor = 0x454a50;

function randomSource(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function material(color: number) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.87, metalness: color === ironColor ? 0.42 : 0.03 });
}
function wooden(rnd: () => number) { return material(woodColors[Math.floor(rnd() * woodColors.length)]); }
function block(
  root: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  mat: THREE.Material,
  rotation: [number, number, number] = [0, 0, 0]
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}
function crate(root: THREE.Object3D, rnd: () => number, x: number, z: number, width: number, depth: number, height: number, reinforced: boolean, wear: number) {
  const core = material(0x745238);
  const iron = material(ironColor);
  block(root, [width * 0.95, height * 0.95, depth * 0.95], [x, height / 2, z], core);
  const plankCount = 5;
  // Top planks with visible seams; side slats avoid a featureless cube.
  for (let i = 0; i < plankCount; i++) {
    const xx = x - width / 2 + ((i + 0.5) / plankCount) * width;
    const wood = wooden(rnd);
    const shorten = wear > 0.5 && rnd() < wear * 0.24 ? 0.8 : 1;
    block(root, [width / plankCount * 0.94, 0.045, depth * shorten], [xx, height + 0.012, z], wood);
    for (const side of [-1, 1]) {
      block(root, [width / plankCount * 0.94, height * 0.87, 0.045], [xx, height / 2, z + side * depth / 2], wooden(rnd));
      const zz = z - depth / 2 + ((i + 0.5) / plankCount) * depth;
      block(root, [0.045, height * 0.87, depth / plankCount * 0.94], [x + side * width / 2, height / 2, zz], wooden(rnd));
    }
  }
  for (const xx of [x - width / 2, x + width / 2]) {
    for (const zz of [z - depth / 2, z + depth / 2]) {
      block(root, [0.09, height, 0.09], [xx, height / 2, zz], reinforced ? iron : wooden(rnd));
    }
  }
  for (const y of [0.08, height - 0.08]) {
    for (const side of [-1, 1]) {
      block(root, [width + 0.05, 0.085, 0.075], [x, y, z + side * depth / 2], reinforced ? iron : wooden(rnd));
      block(root, [0.075, 0.085, depth + 0.05], [x + side * width / 2, y, z], reinforced ? iron : wooden(rnd));
    }
  }
}
function makeCrates(root: THREE.Group, recipe: Extract<TerrainRecipe, {kind:"crate"}>, rnd: () => number) {
  const { width, depth, height, count, wear, reinforced } = recipe;
  if (count === 1) { crate(root, rnd, 0, 0, width, depth, height, reinforced, wear); return; }
  const sub = new THREE.Group();
  root.add(sub);
  crate(sub, rnd, -width * 0.54, 0, width, depth, height, reinforced, wear);
  crate(sub, rnd, width * 0.54, 0.08, width * 0.94, depth, height * 0.95, reinforced, wear);
  // Stack third crate with its own elevation, not embedded in the ground.
  const top = new THREE.Group();
  top.position.set(0, height, 0.02);
  top.rotation.y = 0.12;
  sub.add(top);
  crate(top, rnd, 0, 0, width * 0.91, depth * 0.9, height * 0.84, reinforced, wear);
}
function makeBarrel(root: THREE.Group, recipe: Extract<TerrainRecipe, {kind:"barrel"}>, rnd: () => number) {
  const { radius, height, hoops } = recipe;
  const profile = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(radius * 0.85, 0),
    new THREE.Vector2(radius * 0.97, height * 0.12),
    new THREE.Vector2(radius * 1.12, height * 0.5),
    new THREE.Vector2(radius * 0.97, height * 0.88),
    new THREE.Vector2(radius * 0.85, height),
    new THREE.Vector2(0, height),
  ];
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 16), wooden(rnd));
  mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  for (let i = 0; i < hoops; i++) {
    const y = (i + 0.65) * height / (hoops + 0.3);
    const relative = Math.abs(y / height - 0.5);
    const r = radius * (1.12 - 0.3 * Math.pow(relative * 2, 1.5));
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r + 0.013, 0.032, 6, 24), material(ironColor));
    hoop.position.y = y; hoop.rotation.x = Math.PI / 2; hoop.castShadow = true; root.add(hoop);
  }
  block(root, [radius * 1.18, 0.045, radius * 1.18], [0, height + 0.007, 0], wooden(rnd));
}
function makeFence(root: THREE.Group, recipe: Extract<TerrainRecipe, {kind:"fence"}>, rnd: () => number) {
  const { length, height, posts, broken, wear } = recipe;
  const spacing = length / (posts - 1);
  for (let i = 0; i < posts; i++) {
    const heightVariation = (rnd() - 0.5) * wear * 0.22;
    const h = height * ((broken && i === Math.floor(posts * 0.65)) ? 0.44 : 1) + heightVariation;
    block(root, [0.14, h, 0.16], [-length / 2 + i * spacing, h / 2, 0], wooden(rnd), [0, 0, (rnd() - 0.5) * wear * 0.1]);
  }
  for (const y of [height * 0.28, height * 0.72]) {
    block(root, [length + 0.14, 0.115, 0.12], [0, y, -0.08], wooden(rnd));
  }
}
function makeBarricade(root: THREE.Group, recipe: Extract<TerrainRecipe,{kind:"barricade"}>, rnd: () => number) {
  const { width, height, clutter, broken } = recipe;
  for (const xx of [-width * 0.43, width * 0.43]) {
    block(root, [0.16, height * 0.85, 0.2], [xx, height * 0.42, 0], wooden(rnd), [0, 0, (rnd() - 0.5) * 0.18]);
  }
  for (let i = 0; i < clutter; i++) {
    const y = 0.25 + i * height * 0.67 / clutter;
    const xx = (rnd() - 0.5) * 0.11;
    const length = width * (broken && rnd() > 0.72 ? 0.65 : 1);
    block(root, [length, 0.11 + rnd() * 0.1, 0.15 + rnd() * 0.04], [xx, y, 0.08 + rnd() * 0.13], wooden(rnd), [0, (rnd() - 0.5) * 0.1, (rnd() - 0.5) * 0.19]);
  }
  for (const side of [-1, 1]) {
    block(root, [0.13, height * 0.78, 0.15], [side * width * 0.26, height * 0.42, -0.37], wooden(rnd), [-0.32, 0, side * -0.2]);
  }
}
function makePlanks(root: THREE.Group, recipe: Extract<TerrainRecipe,{kind:"planks"}>, rnd: () => number) {
  const { width, depth, beams, damage } = recipe;
  for (let i = 0; i < beams; i++) {
    const length = width * (0.2 + rnd() * 0.55) * (1 - damage * rnd() * 0.35);
    const thick = 0.065 + rnd() * 0.11;
    const piece = block(root, [length, thick, 0.12 + rnd() * 0.18],
      [(rnd() - 0.5) * width * 0.8, thick / 2 + (i % 4) * 0.04, (rnd() - 0.5) * depth * 0.8],
      wooden(rnd), [0, rnd() * Math.PI, (rnd() - 0.5) * damage * 0.32]);
    piece.userData.kind = "galleon-plank";
  }
}
function makeHull(root: THREE.Group, recipe: Extract<TerrainRecipe,{kind:"hull"}>, rnd: () => number) {
  const { width, height, damage } = recipe;
  const ribs = 6;
  for (let i = 0; i < ribs; i++) {
    const x = -width / 2 + i * width / (ribs - 1);
    const h = height * (0.62 + rnd() * 0.38) * ((i === ribs - 1) ? 1 - damage * 0.5 : 1);
    block(root, [0.13, h, 0.2], [x, h / 2, -0.12], wooden(rnd), [0, 0, (rnd() - 0.5) * damage * 0.12]);
  }
  for (let i = 0; i < 7; i++) {
    if (damage > 0.5 && (i === 4 || i === 6)) continue;
    const y = 0.22 + i * height * 0.78 / 7;
    const short = damage > 0.3 && i > 3;
    const length = width * (short ? 0.58 + rnd() * 0.26 : 1);
    block(root, [length, 0.19, 0.14], [short ? -width * 0.18 : 0, y, 0.02 + Math.sin(i * 0.3) * 0.1], wooden(rnd), [0, 0, (rnd() - 0.5) * damage * 0.12]);
  }
  block(root, [width * 0.93, 0.2, 0.23], [0, 0.15, -0.24], wooden(rnd));
}
function finiteRange(value: number, label: string, min: number, max: number) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(label + " must be between " + min + " and " + max + ".");
}
export function validateTerrainRecipe(recipe: TerrainRecipe) {
  finiteRange(recipe.seed, "Seed", 0, 4294967295);
  if (!Number.isInteger(recipe.seed)) throw new Error("Seed must be an integer.");
  switch (recipe.kind) {
    case "crate":
      finiteRange(recipe.width, "Width", 0.2, 10); finiteRange(recipe.depth, "Depth", 0.2, 10);
      finiteRange(recipe.height, "Height", 0.2, 10); finiteRange(recipe.count, "Crate count", 1, 3);
      if (![1,3].includes(recipe.count)) throw new Error("Crate count must be 1 or 3.");
      finiteRange(recipe.wear, "Wear", 0, 1); break;
    case "barrel":
      finiteRange(recipe.radius, "Radius", 0.12, 5); finiteRange(recipe.height, "Height", 0.2, 10);
      finiteRange(recipe.hoops, "Hoops", 1, 6);
      if (!Number.isInteger(recipe.hoops)) throw new Error("Hoops must be an integer.");
      finiteRange(recipe.wear, "Wear", 0, 1); break;
    case "fence":
      finiteRange(recipe.length, "Length", 0.3, 20); finiteRange(recipe.height, "Height", 0.2, 10);
      finiteRange(recipe.posts, "Posts", 2, 30);
      if (!Number.isInteger(recipe.posts)) throw new Error("Posts must be an integer.");
      finiteRange(recipe.wear, "Wear", 0, 1); break;
    case "barricade":
      finiteRange(recipe.width, "Width", 0.5, 20); finiteRange(recipe.height, "Height", 0.3, 10);
      finiteRange(recipe.clutter, "Boards", 2, 50);
      if (!Number.isInteger(recipe.clutter)) throw new Error("Boards must be an integer."); break;
    case "planks":
      finiteRange(recipe.width, "Width", 0.5, 20); finiteRange(recipe.depth, "Depth", 0.5, 20);
      finiteRange(recipe.beams, "Beams", 1, 60);
      if (!Number.isInteger(recipe.beams)) throw new Error("Beams must be an integer.");
      finiteRange(recipe.damage, "Damage", 0, 1); break;
    case "hull":
      finiteRange(recipe.width, "Width", 0.5, 20); finiteRange(recipe.height, "Height", 0.4, 10);
      finiteRange(recipe.damage, "Damage", 0, 1); break;
    default: throw new Error("Unsupported terrain recipe.");
  }
}
export function createTerrainModel(recipe: TerrainRecipe): THREE.Group {
  validateTerrainRecipe(recipe);
  const rnd = randomSource(recipe.seed);
  const content = new THREE.Group();
  try {
    switch (recipe.kind) {
      case "crate": makeCrates(content, recipe, rnd); break;
      case "barrel": makeBarrel(content, recipe, rnd); break;
      case "fence": makeFence(content, recipe, rnd); break;
      case "barricade": makeBarricade(content, recipe, rnd); break;
      case "planks": makePlanks(content, recipe, rnd); break;
      case "hull": makeHull(content, recipe, rnd); break;
    }
    content.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(content, true);
    const size = box.getSize(new THREE.Vector3());
    if (![size.x,size.y,size.z].every((value) => Number.isFinite(value) && value > 0)) throw new Error("Generated terrain has invalid bounds.");
    // Wrapping keeps individual geometries intact for future editor reuse.
    content.position.set(-(box.min.x + box.max.x)/2, -box.min.y, -(box.min.z + box.max.z)/2);
    const normalized = new THREE.Group();
    normalized.name = "UC terrain " + recipe.kind;
    normalized.userData.terrainRecipe = recipe;
    normalized.add(content);
    return normalized;
  } catch (error) {
    disposeTerrainModel(content);
    throw error;
  }
}
export function disposeTerrainModel(root: THREE.Object3D) {
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.geometry.dispose();
    const mats = Array.isArray(node.material) ? node.material : [node.material];
    mats.forEach((mat) => mat.dispose());
  });
}
