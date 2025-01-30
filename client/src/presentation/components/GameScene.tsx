import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { useGameStore } from "../../infrastructure/store/gameStore";
import { PlayerShip } from "./PlayerShip";
import { useEffect } from "react";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Color, Vector3 } from "three";
import { SolarSystem } from "./SolarSystem";

export const GameScene = () => {
  const { initializePlayer, player } = useGameStore();

  useEffect(() => {
    initializePlayer();
  }, [initializePlayer]);

  // Light direction should match the shader's expectation
  const lightDirection = new Vector3(-1, -1, -1).normalize();

  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      camera={{ position: [0, 200, 800], fov: 60 }}
      gl={{
        antialias: true,
        toneMapping: 3, // ACESFilmicToneMapping
        toneMappingExposure: 0.5,
      }}
    >
      {/* Dark background color */}
      <color attach="background" args={[0x000000]} />

      {/* Very subtle ambient light */}
      <ambientLight intensity={0.02} />

      {/* Main directional light simulating a distant star */}
      <directionalLight
        position={lightDirection.clone().multiplyScalar(200)}
        intensity={2.0}
        color={new Color(1, 1, 1)}
      />

      <EffectComposer>
        <Bloom
          intensity={0.2}
          luminanceThreshold={0}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>

      <Stars
        radius={2000}
        depth={1000}
        count={20000}
        factor={4}
        saturation={0}
        fade
        speed={0.5}
      />

      {player && <PlayerShip player={player} />}
      <SolarSystem />
    </Canvas>
  );
};
