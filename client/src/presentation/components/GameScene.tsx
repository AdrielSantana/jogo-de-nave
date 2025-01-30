import { Canvas } from "@react-three/fiber";
import { useGameStore } from "../../infrastructure/store/gameStore";
import { PlayerShip } from "./PlayerShip";
import { useEffect } from "react";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Color } from "three";
import * as THREE from "three";
import { SolarSystem } from "./SolarSystem";
import { useDetectGPU } from "@react-three/drei";

export const GameScene = () => {
  const { initializePlayer, player } = useGameStore();
  const GPU = useDetectGPU();
  const isHighEnd = GPU.tier >= 2;

  useEffect(() => {
    initializePlayer();
  }, [initializePlayer]);

  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      camera={{
        position: [500, 80, 360],
        fov: 45,
        near: 0.01,
        far: 100000,
      }}
      gl={{
        antialias: false,
        toneMapping: 3, // ACESFilmicToneMapping
        toneMappingExposure: 0.5,
        stencil: false,
        depth: true,
        powerPreference: "high-performance",
      }}
      onCreated={({ camera, gl }) => {
        camera.matrixAutoUpdate = true;
        camera.updateProjectionMatrix();
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        gl.setClearColor(0x000000, 1);
      }}
    >
      {/* Dark background color */}
      <color attach="background" args={[0x000000]} />

      {/* Very subtle ambient light for base illumination */}
      <ambientLight intensity={0.01} color={new Color(0x334455)} />

      <EffectComposer
        frameBufferType={THREE.HalfFloatType}
        autoClear={true}
        multisampling={0}
      >
        {/* Enhanced bloom effect for the sun */}
        <Bloom
          intensity={1.5}
          luminanceThreshold={0.6}
          luminanceSmoothing={0.9}
          mipmapBlur={true}
          radius={0.8}
        />
      </EffectComposer>

      {player && <PlayerShip player={player} />}
      <SolarSystem />
    </Canvas>
  );
};
