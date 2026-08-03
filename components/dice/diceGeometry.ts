export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type DieFace = {
  indices: number[];
};

export type DieGeometry = {
  vertices: Vec3[];
  faces: DieFace[];
};

const EPSILON = 1e-7;

function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: Vec3, amount: number): Vec3 {
  return { x: a.x * amount, y: a.y * amount, z: a.z * amount };
}

export function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(a: Vec3) {
  return Math.hypot(a.x, a.y, a.z);
}

export function normalize(a: Vec3): Vec3 {
  const size = length(a);
  if (size < EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }
  return scale(a, 1 / size);
}

export function centroid(points: Vec3[]): Vec3 {
  if (points.length === 0) {
    return { x: 0, y: 0, z: 0 };
  }
  const sum = points.reduce(add, { x: 0, y: 0, z: 0 });
  return scale(sum, 1 / points.length);
}

function orientFaceOutward(vertices: Vec3[], indices: number[]): number[] {
  if (indices.length < 3) return indices;

  const a = vertices[indices[0]];
  const b = vertices[indices[1]];
  const c = vertices[indices[2]];
  const normal = cross(subtract(b, a), subtract(c, a));
  const faceCenter = centroid(indices.map((index) => vertices[index]));

  return dot(normal, faceCenter) >= 0 ? indices : [...indices].reverse();
}

function normalizeGeometry(geometry: DieGeometry): DieGeometry {
  const maxRadius = Math.max(...geometry.vertices.map(length), 1);
  return {
    vertices: geometry.vertices.map((vertex) => scale(vertex, 1 / maxRadius)),
    faces: geometry.faces.map((face) => ({
      indices: orientFaceOutward(geometry.vertices, face.indices),
    })),
  };
}

function buildConvexTriangularFaces(vertices: Vec3[]): DieFace[] {
  const faces: DieFace[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < vertices.length - 2; i += 1) {
    for (let j = i + 1; j < vertices.length - 1; j += 1) {
      for (let k = j + 1; k < vertices.length; k += 1) {
        const a = vertices[i];
        const b = vertices[j];
        const c = vertices[k];
        const rawNormal = cross(subtract(b, a), subtract(c, a));
        if (length(rawNormal) < EPSILON) continue;

        let positive = false;
        let negative = false;

        for (let pointIndex = 0; pointIndex < vertices.length; pointIndex += 1) {
          if (pointIndex === i || pointIndex === j || pointIndex === k) continue;
          const signedDistance = dot(rawNormal, subtract(vertices[pointIndex], a));
          if (signedDistance > EPSILON) positive = true;
          if (signedDistance < -EPSILON) negative = true;
          if (positive && negative) break;
        }

        if (positive && negative) continue;

        const sortedKey = [i, j, k].sort((left, right) => left - right).join(":");
        if (seen.has(sortedKey)) continue;
        seen.add(sortedKey);

        faces.push({ indices: orientFaceOutward(vertices, [i, j, k]) });
      }
    }
  }

  return faces;
}

function tetrahedron(): DieGeometry {
  const vertices: Vec3[] = [
    { x: 1, y: 1, z: 1 },
    { x: -1, y: -1, z: 1 },
    { x: -1, y: 1, z: -1 },
    { x: 1, y: -1, z: -1 },
  ];

  const faces = buildConvexTriangularFaces(vertices);
  return normalizeGeometry({ vertices, faces });
}

function cube(): DieGeometry {
  const vertices: Vec3[] = [
    { x: -1, y: -1, z: -1 },
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },
    { x: 1, y: -1, z: 1 },
    { x: 1, y: 1, z: 1 },
    { x: -1, y: 1, z: 1 },
  ];

  const faces: DieFace[] = [
    { indices: [0, 3, 2, 1] },
    { indices: [4, 5, 6, 7] },
    { indices: [0, 1, 5, 4] },
    { indices: [3, 7, 6, 2] },
    { indices: [0, 4, 7, 3] },
    { indices: [1, 2, 6, 5] },
  ];

  return normalizeGeometry({ vertices, faces });
}

function octahedron(): DieGeometry {
  const vertices: Vec3[] = [
    { x: 1, y: 0, z: 0 },
    { x: -1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 0, z: 1 },
    { x: 0, y: 0, z: -1 },
  ];

  const faces = buildConvexTriangularFaces(vertices);
  return normalizeGeometry({ vertices, faces });
}

function pentagonalTrapezohedron(): DieGeometry {
  const ringSize = 5;
  const height = 0.72;
  const primalVertices: Vec3[] = [];

  for (let index = 0; index < ringSize; index += 1) {
    const angle = (index * Math.PI * 2) / ringSize;
    primalVertices.push({
      x: Math.cos(angle),
      y: Math.sin(angle),
      z: height,
    });
  }

  for (let index = 0; index < ringSize; index += 1) {
    const angle = ((index + 0.5) * Math.PI * 2) / ringSize;
    primalVertices.push({
      x: Math.cos(angle),
      y: Math.sin(angle),
      z: -height,
    });
  }

  const primalFaces: DieFace[] = [
    { indices: orientFaceOutward(primalVertices, [0, 1, 2, 3, 4]) },
    { indices: orientFaceOutward(primalVertices, [5, 6, 7, 8, 9]) },
  ];

  for (let index = 0; index < ringSize; index += 1) {
    const top = index;
    const topNext = (index + 1) % ringSize;
    const bottom = ringSize + index;
    const bottomPrevious = ringSize + ((index - 1 + ringSize) % ringSize);

    primalFaces.push({
      indices: orientFaceOutward(primalVertices, [top, bottom, bottomPrevious]),
    });
    primalFaces.push({
      indices: orientFaceOutward(primalVertices, [bottom, top, topNext]),
    });
  }

  const vertices = primalFaces.map((face) => {
    const points = face.indices.map((index) => primalVertices[index]);
    const rawNormal = normalize(
      cross(subtract(points[1], points[0]), subtract(points[2], points[0]))
    );
    const faceCenter = centroid(points);
    const outwardNormal = dot(rawNormal, faceCenter) >= 0 ? rawNormal : scale(rawNormal, -1);
    const planeDistance = Math.max(Math.abs(dot(outwardNormal, points[0])), 0.001);
    return scale(outwardNormal, 1 / planeDistance);
  });

  const faces: DieFace[] = primalVertices.map((axis, vertexIndex) => {
    const adjacentFaceIndexes = primalFaces
      .map((face, faceIndex) => ({ face, faceIndex }))
      .filter(({ face }) => face.indices.includes(vertexIndex))
      .map(({ faceIndex }) => faceIndex);

    const normalAxis = normalize(axis);
    const reference = Math.abs(normalAxis.z) < 0.9
      ? { x: 0, y: 0, z: 1 }
      : { x: 0, y: 1, z: 0 };
    const tangentA = normalize(cross(reference, normalAxis));
    const tangentB = normalize(cross(normalAxis, tangentA));

    const ordered = adjacentFaceIndexes
      .map((faceIndex) => {
        const point = vertices[faceIndex];
        const planar = subtract(point, scale(normalAxis, dot(point, normalAxis)));
        return {
          faceIndex,
          angle: Math.atan2(dot(planar, tangentB), dot(planar, tangentA)),
        };
      })
      .sort((left, right) => left.angle - right.angle)
      .map(({ faceIndex }) => faceIndex);

    return { indices: orientFaceOutward(vertices, ordered) };
  });

  return normalizeGeometry({ vertices, faces });
}

function icosahedron(): DieGeometry {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices: Vec3[] = [
    { x: -1, y: phi, z: 0 },
    { x: 1, y: phi, z: 0 },
    { x: -1, y: -phi, z: 0 },
    { x: 1, y: -phi, z: 0 },
    { x: 0, y: -1, z: phi },
    { x: 0, y: 1, z: phi },
    { x: 0, y: -1, z: -phi },
    { x: 0, y: 1, z: -phi },
    { x: phi, y: 0, z: -1 },
    { x: phi, y: 0, z: 1 },
    { x: -phi, y: 0, z: -1 },
    { x: -phi, y: 0, z: 1 },
  ];

  const faces = buildConvexTriangularFaces(vertices);
  return normalizeGeometry({ vertices, faces });
}

function dodecahedron(): DieGeometry {
  const ico = icosahedron();
  const vertices = ico.faces.map((face) =>
    normalize(centroid(face.indices.map((index) => ico.vertices[index])))
  );

  const faces: DieFace[] = ico.vertices.map((axis, vertexIndex) => {
    const adjacentFaceIndexes = ico.faces
      .map((face, faceIndex) => ({ face, faceIndex }))
      .filter(({ face }) => face.indices.includes(vertexIndex))
      .map(({ faceIndex }) => faceIndex);

    const normalAxis = normalize(axis);
    const reference = Math.abs(normalAxis.z) < 0.9
      ? { x: 0, y: 0, z: 1 }
      : { x: 0, y: 1, z: 0 };
    const tangentA = normalize(cross(reference, normalAxis));
    const tangentB = normalize(cross(normalAxis, tangentA));

    const ordered = adjacentFaceIndexes
      .map((faceIndex) => {
        const point = vertices[faceIndex];
        const planar = subtract(point, scale(normalAxis, dot(point, normalAxis)));
        const angle = Math.atan2(dot(planar, tangentB), dot(planar, tangentA));
        return { faceIndex, angle };
      })
      .sort((left, right) => left.angle - right.angle)
      .map(({ faceIndex }) => faceIndex);

    return { indices: orientFaceOutward(vertices, ordered) };
  });

  return normalizeGeometry({ vertices, faces });
}

const geometries: Record<number, DieGeometry> = {
  4: tetrahedron(),
  6: cube(),
  8: octahedron(),
  10: pentagonalTrapezohedron(),
  12: dodecahedron(),
  20: icosahedron(),
  100: pentagonalTrapezohedron(),
};

export function getDieGeometry(sides: number): DieGeometry {
  return geometries[sides] ?? geometries[20];
}
