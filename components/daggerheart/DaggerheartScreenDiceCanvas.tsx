"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import { VttDiceLayer } from "@/components/vtt/VttDiceLayer";
import type {
  PhysicsRollRequest,
  PhysicsRollResult,
} from "@/components/dice-physics/dicePhysicsTypes";

export function DaggerheartScreenDiceCanvas({
  request,
  onComplete,
  onImpact,
}: {
  request: PhysicsRollRequest;
  onComplete: (result: PhysicsRollResult) => void;
  onImpact: (force: number) => void;
}) {
  const dimensions = useMemo(() => {
    const width = typeof window === "undefined" ? 13 : window.innerWidth;
    const height = typeof window === "undefined" ? 8 : window.innerHeight;
    const aspect = Math.max(0.65, Math.min(2.4, width / Math.max(1, height)));
    return {
      sceneWidth: Math.max(9, Math.min(18, 8.5 * aspect)),
      sceneHeight: aspect < 0.9 ? 9.5 : 7.6,
    };
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ fov: 41, near: 0.1, far: 80, position: [0, 8.4, 10.8] }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl, camera }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        gl.setClearColor(0x000000, 0);
        camera.lookAt(0, 0.15, 0);
        camera.updateProjectionMatrix();
      }}
    >
      <ambientLight intensity={1.35} />
      <directionalLight
        castShadow
        position={[-4, 10, 6]}
        intensity={2.4}
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
      />
      <pointLight position={[5, 5, -3]} intensity={1.55} color="#b95772" />
      <VttDiceLayer
        key={request.rollId}
        request={request}
        sceneWidth={dimensions.sceneWidth}
        sceneHeight={dimensions.sceneHeight}
        onComplete={onComplete}
        onImpact={onImpact}
      />
    </Canvas>
  );
}
