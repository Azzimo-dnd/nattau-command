"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  centroid,
  cross,
  dot,
  getDieGeometry,
  normalize,
  type DieGeometry,
  type Vec3,
} from "./diceGeometry";
import {
  DICE_ANIMATION_MS,
  type AnimatedDieSpec,
  type DiceVisualTone,
} from "./diceAnimation";
import styles from "./DiceAnimation.module.css";

type Real3DDieCanvasProps = {
  die: AnimatedDieSpec;
  rolling: boolean;
  animationKey: number;
};

type Rgb = {
  r: number;
  g: number;
  b: number;
};

type Palette = {
  base: Rgb;
  bright: Rgb;
  dark: Rgb;
  edge: string;
  innerEdge: string;
  number: string;
  numberStroke: string;
  glow: string;
};

type ProjectedPoint = Vec3 & {
  sx: number;
  sy: number;
};

type VisibleFace = {
  faceIndex: number;
  points3d: Vec3[];
  points2d: ProjectedPoint[];
  normal: Vec3;
  averageZ: number;
  area: number;
};

const PALETTES: Record<DiceVisualTone, Palette> = {
  nattau: {
    base: { r: 82, g: 76, b: 64 },
    bright: { r: 143, g: 128, b: 86 },
    dark: { r: 25, g: 30, b: 36 },
    edge: "rgba(242, 205, 92, 0.86)",
    innerEdge: "rgba(255, 230, 154, 0.22)",
    number: "#ffe6a3",
    numberStroke: "rgba(20, 17, 10, 0.95)",
    glow: "rgba(231, 181, 49, 0.48)",
  },
  barovia: {
    base: { r: 80, g: 43, b: 56 },
    bright: { r: 130, g: 72, b: 91 },
    dark: { r: 24, g: 12, b: 18 },
    edge: "rgba(195, 99, 127, 0.82)",
    innerEdge: "rgba(242, 164, 185, 0.18)",
    number: "#f0cbd6",
    numberStroke: "rgba(21, 8, 13, 0.96)",
    glow: "rgba(158, 43, 77, 0.56)",
  },
  hope: {
    base: { r: 188, g: 176, b: 151 },
    bright: { r: 247, g: 236, b: 208 },
    dark: { r: 91, g: 82, b: 67 },
    edge: "rgba(255, 240, 200, 0.95)",
    innerEdge: "rgba(255, 255, 244, 0.42)",
    number: "#fff6da",
    numberStroke: "rgba(55, 43, 27, 0.96)",
    glow: "rgba(240, 203, 109, 0.72)",
  },
  fear: {
    base: { r: 85, g: 28, b: 47 },
    bright: { r: 148, g: 52, b: 82 },
    dark: { r: 17, g: 6, b: 11 },
    edge: "rgba(221, 76, 119, 0.94)",
    innerEdge: "rgba(255, 136, 172, 0.25)",
    number: "#ffb3c8",
    numberStroke: "rgba(18, 4, 9, 0.98)",
    glow: "rgba(190, 25, 72, 0.8)",
  },
  advantage: {
    base: { r: 94, g: 82, b: 99 },
    bright: { r: 151, g: 134, b: 158 },
    dark: { r: 31, g: 24, b: 34 },
    edge: "rgba(211, 194, 217, 0.8)",
    innerEdge: "rgba(245, 232, 248, 0.2)",
    number: "#f3e6f2",
    numberStroke: "rgba(24, 18, 26, 0.96)",
    glow: "rgba(163, 123, 173, 0.52)",
  },
  muted: {
    base: { r: 52, g: 63, b: 78 },
    bright: { r: 91, g: 105, b: 122 },
    dark: { r: 19, g: 26, b: 36 },
    edge: "rgba(125, 141, 163, 0.62)",
    innerEdge: "rgba(182, 195, 212, 0.13)",
    number: "#aab7c8",
    numberStroke: "rgba(15, 21, 29, 0.96)",
    glow: "rgba(91, 108, 132, 0.28)",
  },
};

const LIGHT_DIRECTION = normalize({ x: -0.45, y: 0.72, z: 1 });

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function mixColor(left: Rgb, right: Rgb, amount: number): Rgb {
  const ratio = clamp(amount, 0, 1);
  return {
    r: Math.round(left.r + (right.r - left.r) * ratio),
    g: Math.round(left.g + (right.g - left.g) * ratio),
    b: Math.round(left.b + (right.b - left.b) * ratio),
  };
}

function rgb(color: Rgb, alpha = 1) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function rotatePoint(point: Vec3, rotationX: number, rotationY: number, rotationZ: number): Vec3 {
  const cosX = Math.cos(rotationX);
  const sinX = Math.sin(rotationX);
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  const cosZ = Math.cos(rotationZ);
  const sinZ = Math.sin(rotationZ);

  const afterX = {
    x: point.x,
    y: point.y * cosX - point.z * sinX,
    z: point.y * sinX + point.z * cosX,
  };

  const afterY = {
    x: afterX.x * cosY + afterX.z * sinY,
    y: afterX.y,
    z: -afterX.x * sinY + afterX.z * cosY,
  };

  return {
    x: afterY.x * cosZ - afterY.y * sinZ,
    y: afterY.x * sinZ + afterY.y * cosZ,
    z: afterY.z,
  };
}

function polygonArea(points: ProjectedPoint[]) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.sx * next.sy - next.sx * current.sy;
  }
  return Math.abs(area) / 2;
}

function tracePolygon(context: CanvasRenderingContext2D, points: ProjectedPoint[]) {
  if (points.length === 0) return;
  context.beginPath();
  context.moveTo(points[0].sx, points[0].sy);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].sx, points[index].sy);
  }
  context.closePath();
}

function easeOutQuint(value: number) {
  return 1 - Math.pow(1 - value, 5);
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function getFinalRotation(die: AnimatedDieSpec, animationKey: number) {
  const seed = hashText(
    `${animationKey}:${die.id}:${die.value ?? 0}:${die.sides}`
  );
  return {
    x: 0.35 + seededUnit(seed + 11) * Math.PI * 1.7,
    y: 0.22 + seededUnit(seed + 29) * Math.PI * 1.7,
    z: -0.35 + seededUnit(seed + 47) * Math.PI * 0.7,
    spinX: 4.2 + Math.floor(seededUnit(seed + 61) * 3) * 2,
    spinY: 4.6 + Math.floor(seededUnit(seed + 79) * 3) * 2,
    spinZ: 2.4 + Math.floor(seededUnit(seed + 97) * 2) * 2,
  };
}

function getMotionOffset(motion: AnimatedDieSpec["motion"], progress: number, radius: number) {
  const eased = easeOutQuint(progress);
  let startX = 0;
  let startY = -1.65;

  if (motion === "drop-left") startX = -1.55;
  if (motion === "drop-right") startX = 1.55;
  if (motion === "duality-left") {
    startX = -1.85;
    startY = -0.85;
  }
  if (motion === "duality-right") {
    startX = 1.85;
    startY = -0.85;
  }

  const remaining = 1 - eased;
  const bounce = Math.abs(Math.sin(progress * Math.PI * 3.2)) * (1 - progress) * radius * 0.34;
  const sideSkid = Math.sin(progress * Math.PI * 2.4) * (1 - progress) * radius * 0.11;

  return {
    x: startX * remaining * radius + sideSkid,
    y: startY * remaining * radius - bounce,
    scale: 0.7 + eased * 0.3 + Math.sin(progress * Math.PI) * 0.055,
  };
}

function getFaceNormal(
  geometry: DieGeometry,
  faceIndex: number,
  rotation: { x: number; y: number; z: number }
) {
  const face = geometry.faces[faceIndex];
  const points = face.indices
    .slice(0, 3)
    .map((index) =>
      rotatePoint(
        geometry.vertices[index],
        rotation.x,
        rotation.y,
        rotation.z
      )
    );

  return normalize(
    cross(subtract(points[1], points[0]), subtract(points[2], points[0]))
  );
}

function getLandingFaceIndex(
  geometry: DieGeometry,
  rotation: { x: number; y: number; z: number }
) {
  let landingFaceIndex = 0;
  let bestFacingScore = Number.NEGATIVE_INFINITY;

  geometry.faces.forEach((_, faceIndex) => {
    const normal = getFaceNormal(geometry, faceIndex, rotation);
    if (normal.z > bestFacingScore) {
      bestFacingScore = normal.z;
      landingFaceIndex = faceIndex;
    }
  });

  return landingFaceIndex;
}

function getBaseFaceLabels(die: AnimatedDieSpec, faceCount: number) {
  if (die.sides === 100) {
    return Array.from({ length: faceCount }, (_, faceIndex) => {
      const value = (faceIndex * 10) % 100;
      return value === 0 ? "00" : String(value).padStart(2, "0");
    });
  }

  return Array.from({ length: faceCount }, (_, faceIndex) =>
    String((faceIndex % die.sides) + 1)
  );
}

function getResultLabel(die: AnimatedDieSpec) {
  if (die.value === null) return null;
  return String(die.value);
}

function getFixedFaceLabels(
  die: AnimatedDieSpec,
  geometry: DieGeometry,
  finalRotation: { x: number; y: number; z: number }
) {
  const labels = getBaseFaceLabels(die, geometry.faces.length);
  const landingFaceIndex = getLandingFaceIndex(geometry, finalRotation);
  const resultLabel = getResultLabel(die);

  if (!resultLabel) {
    return { labels, landingFaceIndex };
  }

  // The outcome is known before the visual roll starts. We move that value onto
  // the physical face that will land toward the camera, then keep every label
  // attached to its face for the entire animation. Nothing changes after rest.
  const originalResultFaceIndex = labels.indexOf(resultLabel);

  if (
    originalResultFaceIndex >= 0 &&
    originalResultFaceIndex !== landingFaceIndex
  ) {
    const displacedLabel = labels[landingFaceIndex];
    labels[landingFaceIndex] = resultLabel;
    labels[originalResultFaceIndex] = displacedLabel;
  } else {
    labels[landingFaceIndex] = resultLabel;
  }

  return { labels, landingFaceIndex };
}

function drawFaceNumber({
  context,
  face,
  text,
  palette,
  main,
  rolling,
}: {
  context: CanvasRenderingContext2D;
  face: VisibleFace;
  text: string;
  palette: Palette;
  main: boolean;
  rolling: boolean;
}) {
  const center = {
    x: face.points2d.reduce((sum, point) => sum + point.sx, 0) / face.points2d.length,
    y: face.points2d.reduce((sum, point) => sum + point.sy, 0) / face.points2d.length,
  };
  const first = face.points2d[0];
  let angle = Math.atan2(first.sy - center.y, first.sx - center.x) + Math.PI / 2;
  if (angle > Math.PI / 2) angle -= Math.PI;
  if (angle < -Math.PI / 2) angle += Math.PI;

  const faceScale = Math.sqrt(Math.max(face.area, 1));
  const fontSize = clamp(faceScale * (main ? 0.48 : 0.3), main ? 12 : 8, main ? 34 : 17);
  if (!main && face.area < 360) return;

  context.save();
  tracePolygon(context, face.points2d);
  context.clip();
  context.translate(center.x, center.y);
  context.rotate(angle);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${main ? 900 : 800} ${fontSize}px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  context.lineJoin = "round";
  context.lineWidth = Math.max(2, fontSize * 0.13);
  context.strokeStyle = palette.numberStroke;
  context.globalAlpha = main ? 1 : rolling ? 0.38 : 0.52;
  context.strokeText(text, 0, 0);
  context.fillStyle = palette.number;
  context.shadowColor = main ? palette.glow : "transparent";
  context.shadowBlur = main ? fontSize * 0.48 : 0;
  context.fillText(text, 0, 0);
  context.restore();
}

function drawDie(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  die: AnimatedDieSpec,
  progress: number,
  rolling: boolean,
  animationKey: number
) {
  const palette = PALETTES[die.tone ?? "nattau"];
  const geometry = getDieGeometry(die.sides);
  const radius = Math.min(width, height) * (die.sides === 4 ? 0.32 : 0.355);
  const finalRotation = getFinalRotation(die, animationKey);
  const { labels: faceLabels, landingFaceIndex } = getFixedFaceLabels(
    die,
    geometry,
    finalRotation
  );
  const motion = getMotionOffset(die.motion, progress, radius);
  const remaining = 1 - easeOutQuint(progress);
  const wobble = Math.sin(progress * Math.PI * 4) * remaining * 0.2;
  const rotationX = finalRotation.x + remaining * Math.PI * finalRotation.spinX + wobble;
  const rotationY = finalRotation.y + remaining * Math.PI * finalRotation.spinY - wobble * 0.7;
  const rotationZ = finalRotation.z + remaining * Math.PI * finalRotation.spinZ;
  const centerX = width / 2 + motion.x;
  const centerY = height / 2 + motion.y + height * 0.015;
  const renderRadius = radius * motion.scale;

  const rotatedVertices = geometry.vertices.map((vertex) =>
    rotatePoint(vertex, rotationX, rotationY, rotationZ)
  );

  const projectedVertices: ProjectedPoint[] = rotatedVertices.map((vertex) => {
    const perspective = 1 / (1.08 - vertex.z * 0.19);
    return {
      ...vertex,
      sx: centerX + vertex.x * renderRadius * perspective,
      sy: centerY - vertex.y * renderRadius * perspective,
    };
  });

  const visibleFaces: VisibleFace[] = geometry.faces
    .map((face, faceIndex) => {
      const points3d = face.indices.map((index) => rotatedVertices[index]);
      const points2d = face.indices.map((index) => projectedVertices[index]);
      const normal = normalize(
        cross(subtract(points3d[1], points3d[0]), subtract(points3d[2], points3d[0]))
      );
      return {
        faceIndex,
        points3d,
        points2d,
        normal,
        averageZ: points3d.reduce((sum, point) => sum + point.z, 0) / points3d.length,
        area: polygonArea(points2d),
      };
    })
    .filter((face) => face.normal.z > 0.015 && face.area > 4)
    .sort((left, right) => left.averageZ - right.averageZ);

  const objectAlpha = rolling ? clamp(progress * 3.5, 0, 1) : 1;
  context.save();
  context.globalAlpha = objectAlpha;

  visibleFaces.forEach((face) => {
    const light = clamp(dot(face.normal, LIGHT_DIRECTION), -0.25, 1);
    const illumination = 0.3 + Math.max(0, light) * 0.7;
    const faceBase = mixColor(palette.dark, palette.base, illumination);
    const faceHighlight = mixColor(faceBase, palette.bright, 0.2 + Math.max(0, light) * 0.34);
    const boundsX = face.points2d.map((point) => point.sx);
    const boundsY = face.points2d.map((point) => point.sy);
    const gradient = context.createLinearGradient(
      Math.min(...boundsX),
      Math.min(...boundsY),
      Math.max(...boundsX),
      Math.max(...boundsY)
    );
    gradient.addColorStop(0, rgb(faceHighlight));
    gradient.addColorStop(0.52, rgb(faceBase));
    gradient.addColorStop(1, rgb(mixColor(faceBase, palette.dark, 0.48)));

    tracePolygon(context, face.points2d);
    context.fillStyle = gradient;
    context.fill();
    context.lineWidth = Math.max(1.15, renderRadius * 0.018);
    context.strokeStyle = palette.edge;
    context.stroke();

    context.save();
    tracePolygon(context, face.points2d);
    context.clip();
    context.globalAlpha = 0.58;
    context.lineWidth = Math.max(0.7, renderRadius * 0.009);
    context.strokeStyle = palette.innerEdge;
    context.stroke();
    context.restore();
  });

  const numberFaces = [...visibleFaces]
    .sort((left, right) => right.normal.z * right.area - left.normal.z * left.area)
    .slice(0, 3);
  numberFaces.forEach((face, index) => {
    const isLandingFace = face.faceIndex === landingFaceIndex;

    drawFaceNumber({
      context,
      face,
      text: faceLabels[face.faceIndex] ?? "?",
      palette,
      main: index === 0,
      rolling,
    });

    if (!rolling && isLandingFace) {
      context.save();
      context.globalAlpha = 0.16;
      tracePolygon(context, face.points2d);
      context.fillStyle = palette.glow;
      context.fill();
      context.restore();
    }
  });

  context.restore();
}

export function Real3DDieCanvas({ die, rolling, animationKey }: Real3DDieCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dieSnapshot = useMemo<AnimatedDieSpec>(
    () => ({ ...die }),
    [
      die.delayMs,
      die.discarded,
      die.id,
      die.label,
      die.motion,
      die.sides,
      die.tone,
      die.value,
    ]
  );
  const finalRotationKey = useMemo(
    () => `${animationKey}:${dieSnapshot.id}:${dieSnapshot.value ?? "none"}:${dieSnapshot.sides}`,
    [animationKey, dieSnapshot.id, dieSnapshot.sides, dieSnapshot.value]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const activeCanvas = canvas;
    const activeContext = context;

    let animationFrame = 0;
    let cancelled = false;
    const startedAt = performance.now();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reducedMotion ? 0 : dieSnapshot.delayMs ?? 0;
    const duration = reducedMotion
      ? 180
      : Math.max(720, DICE_ANIMATION_MS - Math.min(delay, 520));

    function resizeCanvas() {
      const rect = activeCanvas.getBoundingClientRect();
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
      const pixelHeight = Math.max(1, Math.round(rect.height * dpr));
      if (activeCanvas.width !== pixelWidth || activeCanvas.height !== pixelHeight) {
        activeCanvas.width = pixelWidth;
        activeCanvas.height = pixelHeight;
      }
      activeContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: rect.width, height: rect.height };
    }

    function frame(now: number) {
      if (cancelled) return;
      const { width, height } = resizeCanvas();
      activeContext.clearRect(0, 0, width, height);

      const elapsed = now - startedAt;
      const activeElapsed = Math.max(0, elapsed - delay);
      const progress = rolling ? clamp(activeElapsed / duration, 0, 1) : 1;
      drawDie(
        activeContext,
        width,
        height,
        dieSnapshot,
        progress,
        rolling,
        animationKey
      );

      if (rolling && elapsed < delay + duration + 40) {
        animationFrame = window.requestAnimationFrame(frame);
      }
    }

    const observer = new ResizeObserver(() => {
      if (!rolling) {
        frame(performance.now());
      }
    });
    observer.observe(activeCanvas);
    animationFrame = window.requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.cancelAnimationFrame(animationFrame);
    };
  }, [dieSnapshot, finalRotationKey, rolling]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.dieCanvas}
      role="img"
      aria-label={`${die.label ? `${die.label}, ` : ""}d${die.sides}: ${
        die.value ?? "not rolled"
      }${die.discarded ? ", discarded" : ""}`}
    />
  );
}
