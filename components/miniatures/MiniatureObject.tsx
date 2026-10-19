"use client";

import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { disposeMiniatureScene, instantiateMiniature, type MiniatureAsset } from "./miniatureAsset";

export function MiniatureObject({ asset, scale = 1, opacity = 1, onPointerDown }: { asset: MiniatureAsset; scale?: number; opacity?: number; onPointerDown?: (event: ThreeEvent<PointerEvent>) => void }) {
  const instance = useMemo(() => instantiateMiniature(asset, opacity), [asset, opacity]);
  useEffect(() => () => disposeMiniatureScene(instance, true), [instance]);
  return <primitive object={instance} scale={scale} dispose={null} onPointerDown={onPointerDown} />;
}
