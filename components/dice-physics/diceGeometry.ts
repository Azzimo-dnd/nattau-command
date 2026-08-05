import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DodecahedronGeometry,
  DoubleSide,
  EdgesGeometry,
  IcosahedronGeometry,
  Matrix4,
  OctahedronGeometry,
  Quaternion,
  SRGBColorSpace,
  TetrahedronGeometry,
  Vector3,
} from "three";
import type {
  DiceNumberSize,
  PercentilePart,
  PhysicsDieKind,
} from "./dicePhysicsTypes";

export type DieFace = {
  value: number;
  normal: Vector3;
  center: Vector3;
  labelQuaternion: Quaternion;
};

export type DieDefinition = {
  kind: PhysicsDieKind;
  sides: number;
  geometry: BufferGeometry;
  edges: EdgesGeometry;
  /** Local directions that determine the physical result. */
  faces: DieFace[];
  /** Printed labels. d4 uses three labels on each triangular face. */
  labels: DieFace[];
  labelSize: number;
};

type FaceCluster = {
  normal: Vector3;
  centroidSum: Vector3;
  triangles: number;
};

const definitionCache = new Map<PhysicsDieKind, DieDefinition>();
const textureCache = new Map<string, CanvasTexture>();
const WORLD_UP = new Vector3(0, 1, 0);
const WORLD_FORWARD = new Vector3(0, 0, 1);

function orientedNormal(points: Vector3[]) {
  const normal = new Vector3()
    .crossVectors(
      points[1].clone().sub(points[0]),
      points[2].clone().sub(points[0])
    )
    .normalize();
  const centroid = points
    .reduce((sum, point) => sum.add(point), new Vector3())
    .multiplyScalar(1 / points.length);
  if (normal.dot(centroid) < 0) normal.multiplyScalar(-1);
  return { normal, centroid };
}

/**
 * Build a pentagonal trapezohedron by taking the geometric dual of a
 * pentagonal antiprism. The resulting solid has 10 congruent kite faces.
 */
function createD10Geometry(radius = 1.12) {
  const ringRadius = 1;
  const halfHeight = 0.58;
  const top: Vector3[] = [];
  const bottom: Vector3[] = [];

  for (let index = 0; index < 5; index += 1) {
    const topAngle = (index * Math.PI * 2) / 5;
    const bottomAngle = topAngle + Math.PI / 5;
    top.push(
      new Vector3(
        Math.cos(topAngle) * ringRadius,
        halfHeight,
        Math.sin(topAngle) * ringRadius
      )
    );
    bottom.push(
      new Vector3(
        Math.cos(bottomAngle) * ringRadius,
        -halfHeight,
        Math.sin(bottomAngle) * ringRadius
      )
    );
  }

  const sourceVertices = [...top, ...bottom];
  const sourceFaces: number[][] = [
    [0, 1, 2, 3, 4],
    [9, 8, 7, 6, 5],
  ];

  for (let index = 0; index < 5; index += 1) {
    const next = (index + 1) % 5;
    sourceFaces.push([index, 5 + index, next]);
    sourceFaces.push([next, 5 + index, 5 + next]);
  }

  const dualVertices = sourceFaces.map((face) => {
    const points = face.map((vertexIndex) => sourceVertices[vertexIndex]);
    const { normal } = orientedNormal(points);
    const distance = Math.abs(normal.dot(points[0]));
    return normal.multiplyScalar(1 / Math.max(distance, 0.0001));
  });

  const triangles: Vector3[][] = [];
  sourceVertices.forEach((sourceVertex, sourceVertexIndex) => {
    const incident = sourceFaces
      .map((face, faceIndex) => ({ face, faceIndex }))
      .filter(({ face }) => face.includes(sourceVertexIndex))
      .map(({ faceIndex }) => faceIndex);

    const axis = sourceVertex.clone().normalize();
    const reference = Math.abs(axis.dot(WORLD_UP)) > 0.9 ? WORLD_FORWARD : WORLD_UP;
    const basisX = new Vector3().crossVectors(reference, axis).normalize();
    const basisY = new Vector3().crossVectors(axis, basisX).normalize();

    incident.sort((leftIndex, rightIndex) => {
      const left = dualVertices[leftIndex];
      const right = dualVertices[rightIndex];
      const leftAngle = Math.atan2(left.dot(basisY), left.dot(basisX));
      const rightAngle = Math.atan2(right.dot(basisY), right.dot(basisX));
      return leftAngle - rightAngle;
    });

    if (incident.length !== 4) {
      throw new Error(`Invalid d10 dual face: expected 4 vertices, found ${incident.length}.`);
    }

    const quad = incident.map((faceIndex) => dualVertices[faceIndex]);
    triangles.push([quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]);
  });

  const maximumLength = dualVertices.reduce(
    (maximum, vertex) => Math.max(maximum, vertex.length()),
    0
  );
  const scale = radius / maximumLength;
  const positions: number[] = [];
  const uvs: number[] = [];

  triangles.forEach((triangle) => {
    const points = triangle.map((point) => point.clone().multiplyScalar(scale));
    const { normal, centroid } = orientedNormal(points);
    const ordered = normal.dot(centroid) >= 0
      ? points
      : [points[0], points[2], points[1]];
    ordered.forEach((point) => positions.push(point.x, point.y, point.z));
    uvs.push(0, 0, 1, 0, 0.5, 1);
  });

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createBaseGeometry(kind: PhysicsDieKind) {
  if (kind === "d4") return new TetrahedronGeometry(1.12, 0).toNonIndexed();
  if (kind === "d6") return new BoxGeometry(1.45, 1.45, 1.45).toNonIndexed();
  if (kind === "d8") return new OctahedronGeometry(1.12, 0).toNonIndexed();
  if (kind === "d10") return createD10Geometry().toNonIndexed();
  if (kind === "d12") return new DodecahedronGeometry(1.08, 0).toNonIndexed();
  return new IcosahedronGeometry(1.12, 0).toNonIndexed();
}

function collectFaceClusters(geometry: BufferGeometry) {
  const position = geometry.getAttribute("position");
  const clusters: FaceCluster[] = [];
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const normal = new Vector3();
  const centroid = new Vector3();

  for (let index = 0; index < position.count; index += 3) {
    a.fromBufferAttribute(position, index);
    b.fromBufferAttribute(position, index + 1);
    c.fromBufferAttribute(position, index + 2);
    normal.crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    centroid.copy(a).add(b).add(c).multiplyScalar(1 / 3);
    if (normal.dot(centroid) < 0) normal.multiplyScalar(-1);

    let cluster = clusters.find((candidate) => candidate.normal.dot(normal) > 0.9993);
    if (!cluster) {
      cluster = { normal: normal.clone(), centroidSum: new Vector3(), triangles: 0 };
      clusters.push(cluster);
    }
    cluster.centroidSum.add(centroid);
    cluster.triangles += 1;
  }

  return clusters
    .map((cluster) => ({
      normal: cluster.normal.normalize(),
      center: cluster.centroidSum.multiplyScalar(1 / cluster.triangles),
    }))
    .sort((left, right) => {
      const y = right.normal.y - left.normal.y;
      if (Math.abs(y) > 0.00001) return y;
      const z = right.normal.z - left.normal.z;
      if (Math.abs(z) > 0.00001) return z;
      return right.normal.x - left.normal.x;
    });
}


function collectUniqueVertices(geometry: BufferGeometry) {
  const position = geometry.getAttribute("position");
  const vertices: Vector3[] = [];
  const candidate = new Vector3();
  for (let index = 0; index < position.count; index += 1) {
    candidate.fromBufferAttribute(position, index);
    if (!vertices.some((vertex) => vertex.distanceToSquared(candidate) < 0.000001)) {
      vertices.push(candidate.clone());
    }
  }
  return vertices.sort((left, right) => {
    const y = right.y - left.y;
    if (Math.abs(y) > 0.00001) return y;
    const z = right.z - left.z;
    if (Math.abs(z) > 0.00001) return z;
    return right.x - left.x;
  });
}

function createD4ResultAndLabels(geometry: BufferGeometry) {
  const vertices = collectUniqueVertices(geometry);
  if (vertices.length !== 4) {
    throw new Error(`Could not construct d4: expected 4 vertices, found ${vertices.length}.`);
  }

  const vertexValues = new Map<Vector3, number>();
  vertices.forEach((vertex, index) => vertexValues.set(vertex, index + 1));
  const resultFaces: DieFace[] = vertices.map((vertex, index) => ({
    value: index + 1,
    normal: vertex.clone().normalize(),
    center: vertex.clone(),
    labelQuaternion: new Quaternion(),
  }));

  const position = geometry.getAttribute("position");
  const labels: DieFace[] = [];
  const points = [new Vector3(), new Vector3(), new Vector3()];
  for (let index = 0; index < position.count; index += 3) {
    points[0].fromBufferAttribute(position, index);
    points[1].fromBufferAttribute(position, index + 1);
    points[2].fromBufferAttribute(position, index + 2);
    const { normal, centroid } = orientedNormal(points);
    const quaternion = createFaceQuaternion(normal);

    for (const point of points) {
      const matchedVertex = vertices.find(
        (vertex) => vertex.distanceToSquared(point) < 0.000001
      );
      if (!matchedVertex) continue;
      const value = vertexValues.get(matchedVertex) ?? 1;
      labels.push({
        value,
        normal: normal.clone(),
        center: centroid
          .clone()
          .lerp(point, 0.47)
          .addScaledVector(normal, 0.027),
        labelQuaternion: quaternion.clone(),
      });
    }
  }

  return { resultFaces, labels };
}

function createFaceQuaternion(normal: Vector3) {
  const zAxis = normal.clone().normalize();
  const reference = Math.abs(zAxis.dot(WORLD_UP)) > 0.92 ? WORLD_FORWARD : WORLD_UP;
  const yAxis = reference
    .clone()
    .sub(zAxis.clone().multiplyScalar(reference.dot(zAxis)))
    .normalize();
  const xAxis = yAxis.clone().cross(zAxis).normalize();
  yAxis.copy(zAxis).cross(xAxis).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(xAxis, yAxis, zAxis));
}

function assignOppositeFaceValues(
  clusters: Array<{ normal: Vector3; center: Vector3 }>,
  sides: number
) {
  const remaining = new Set(clusters.map((_, index) => index));
  const assignments = new Map<number, number>();
  let lowValue = 1;

  while (remaining.size > 0) {
    const firstIndex = remaining.values().next().value as number;
    remaining.delete(firstIndex);
    let oppositeIndex: number | null = null;
    let oppositeDot = Number.POSITIVE_INFINITY;

    for (const candidateIndex of remaining) {
      const dot = clusters[firstIndex].normal.dot(clusters[candidateIndex].normal);
      if (dot < oppositeDot) {
        oppositeDot = dot;
        oppositeIndex = candidateIndex;
      }
    }

    assignments.set(firstIndex, lowValue);
    if (oppositeIndex !== null) {
      assignments.set(oppositeIndex, sides + 1 - lowValue);
      remaining.delete(oppositeIndex);
    }
    lowValue += 1;
  }
  return assignments;
}

export function getDieDefinition(kind: PhysicsDieKind): DieDefinition {
  const cached = definitionCache.get(kind);
  if (cached) return cached;

  const geometry = createBaseGeometry(kind);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  const sides = Number(kind.slice(1));
  const clusters = collectFaceClusters(geometry);

  if (clusters.length !== sides) {
    throw new Error(`Could not construct ${kind}: expected ${sides} faces, found ${clusters.length}.`);
  }

  let faces: DieFace[];
  let labels: DieFace[];
  if (kind === "d4") {
    const d4 = createD4ResultAndLabels(geometry);
    faces = d4.resultFaces;
    labels = d4.labels;
  } else {
    const values = assignOppositeFaceValues(clusters, sides);
    faces = clusters.map((cluster, index) => ({
      value: values.get(index) ?? index + 1,
      normal: cluster.normal,
      center: cluster.center.clone().addScaledVector(cluster.normal, 0.027),
      labelQuaternion: createFaceQuaternion(cluster.normal),
    }));
    labels = faces;
  }

  const labelSizeByKind: Record<PhysicsDieKind, number> = {
    d4: 0.235,
    d6: 0.58,
    d8: 0.34,
    d10: 0.32,
    d12: 0.39,
    d20: 0.285,
  };

  const definition: DieDefinition = {
    kind,
    sides,
    geometry,
    edges: new EdgesGeometry(geometry, 18),
    faces,
    labels,
    labelSize: labelSizeByKind[kind],
  };
  definitionCache.set(kind, definition);
  return definition;
}

export function displayFaceValue(
  faceValue: number,
  percentilePart?: PercentilePart | null
) {
  if (percentilePart === "ones") return faceValue === 10 ? "0" : String(faceValue);
  if (percentilePart === "tens") return faceValue === 10 ? "00" : String(faceValue * 10);
  return String(faceValue);
}

export function resultFaceValue(
  faceValue: number,
  percentilePart?: PercentilePart | null
) {
  if (percentilePart === "ones") return faceValue === 10 ? 0 : faceValue;
  if (percentilePart === "tens") return faceValue === 10 ? 0 : faceValue * 10;
  return faceValue;
}

function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  preferredSize: number,
  maximumWidth: number
) {
  let fontSize = preferredSize;
  while (fontSize > 250) {
    context.font = `900 ${fontSize}px Georgia, "Times New Roman", serif`;
    if (context.measureText(text).width <= maximumWidth) return fontSize;
    fontSize -= 12;
  }
  return fontSize;
}

export function getLabelTexture(
  kind: PhysicsDieKind,
  displayValue: string,
  foreground: string,
  outline: string,
  numberSize: DiceNumberSize
) {
  const key = `${kind}:${displayValue}:${foreground}:${outline}:${numberSize}`;
  const cached = textureCache.get(key);
  if (cached) return cached;
  if (typeof document === "undefined") {
    throw new Error("Dice label textures can only be created in the browser.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable.");

  const sizeMultiplier = numberSize === "extra-large" ? 1.22 : numberSize === "large" ? 1.1 : 1;
  const preferredBase = kind === "d6" ? 680 : kind === "d12" ? 610 : kind === "d20" ? 560 : 590;
  const fontSize = fitFontSize(context, displayValue, preferredBase * sizeMultiplier, 810);
  const x = 512;
  const y = 490;

  context.clearRect(0, 0, 1024, 1024);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineCap = "round";
  context.font = `900 ${fontSize}px Georgia, "Times New Roman", serif`;
  context.lineWidth = kind === "d20" ? 60 : 68;
  context.strokeStyle = outline;
  context.fillStyle = foreground;
  context.strokeText(displayValue, x, y);
  context.fillText(displayValue, x, y);

  if (displayValue === "6" || displayValue === "9") {
    const underlineY = y + fontSize * 0.42;
    const underlineWidth = Math.max(210, context.measureText(displayValue).width * 0.72);
    context.lineWidth = 42;
    context.strokeStyle = outline;
    context.beginPath();
    context.moveTo(x - underlineWidth / 2, underlineY);
    context.lineTo(x + underlineWidth / 2, underlineY);
    context.stroke();
    context.lineWidth = 22;
    context.strokeStyle = foreground;
    context.beginPath();
    context.moveTo(x - underlineWidth / 2, underlineY);
    context.lineTo(x + underlineWidth / 2, underlineY);
    context.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  textureCache.set(key, texture);
  return texture;
}

export function getFaceMaterialSide() {
  return DoubleSide;
}
