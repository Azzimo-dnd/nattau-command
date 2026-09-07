"use client";

import { useMemo, type ComponentProps } from "react";
import { snapTokenCoordinate } from "./vttGridMath";

import { VttCanvas as RawVttCanvas } from "./VttCanvas";

export type { VttToolMode } from "./VttCanvas";

type Props = ComponentProps<typeof RawVttCanvas>;

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
