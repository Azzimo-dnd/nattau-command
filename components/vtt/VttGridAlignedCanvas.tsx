"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  VttCanvas as RawVttCanvas,
  type VttMeasurePoint,
  type VttPing,
  type VttToolMode,
} from "./VttCanvas";
import type { VttScene, VttToken } from "./vttTypes";

export type { VttToolMode } from "./VttCanvas";

type Props = {
  scene: VttScene;
  tokens: VttToken[];
  isDm: boolean;
  selectedIds: string[];
  supabase: ReturnType<typeof createClient>;
  toolMode: VttToolMode;
  measureStart: VttMeasurePoint | null;
  measureEnd: VttMeasurePoint | null;
  ping: VttPing | null;
  onSelect: (id: string | null, additive: boolean) => void;
  onLocalMove: (id: string, x: number, z: number) => void;
  onCommitMove: (id: string, x: number, z: number) => void;
  onMeasureStart: (point: VttMeasurePoint) => void;
  onMeasureMove: (point: VttMeasurePoint) => void;
  onMeasureEnd: (point: VttMeasurePoint) => void;
  onPing: (point: VttMeasurePoint) => void;
};

function tokenFootprint(sizeSquares: number) {
  // Tiny creatures still occupy one selectable D&D grid space. Larger creatures
  // use their actual square footprint so a 2x2 / 3x3 / 4x4 base stays centered
  // over a valid block of cells instead of drifting onto grid edges.
  return Math.max(1, sizeSquares);
}

export function snapTokenCoordinate(value: number, totalSquares: number, sizeSquares: number) {
  const halfExtent = totalSquares / 2;
  const footprint = Math.min(totalSquares, tokenFootprint(sizeSquares));
  const halfFootprint = footprint / 2;
  const firstValidCenter = -halfExtent + halfFootprint;
  const lastValidCenter = halfExtent - halfFootprint;
  const snapped = firstValidCenter + Math.round(value - firstValidCenter);
  return Math.max(firstValidCenter, Math.min(lastValidCenter, snapped));
}

export function VttCanvas(props: Props) {
  const { scene, tokens, onLocalMove, onCommitMove } = props;

  const normalizedTokens = useMemo(() => tokens.map((token) => ({
    ...token,
    x: snapTokenCoordinate(token.x, scene.grid_width, token.size_squares),
    z: snapTokenCoordinate(token.z, scene.grid_height, token.size_squares),
  })), [scene.grid_height, scene.grid_width, tokens]);

  const tokenById = useMemo(() => new Map(tokens.map((token) => [token.id, token])), [tokens]);

  const snapMove = (id: string, x: number, z: number) => {
    const token = tokenById.get(id);
    const sizeSquares = token?.size_squares ?? 1;
    return {
      x: snapTokenCoordinate(x, scene.grid_width, sizeSquares),
      z: snapTokenCoordinate(z, scene.grid_height, sizeSquares),
    };
  };

  return (
    <RawVttCanvas
      {...props}
      tokens={normalizedTokens}
      onLocalMove={(id, x, z) => {
        const snapped = snapMove(id, x, z);
        onLocalMove(id, snapped.x, snapped.z);
      }}
      onCommitMove={(id, x, z) => {
        const snapped = snapMove(id, x, z);
        onCommitMove(id, snapped.x, snapped.z);
      }}
    />
  );
}
