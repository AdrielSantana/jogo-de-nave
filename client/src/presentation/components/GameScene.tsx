import { Canvas } from "@react-three/fiber";
import { useGameStore } from "../../infrastructure/store/gameStore";
import { PlayerShip } from "./PlayerShip";
import { useEffect, useState } from "react";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { Color, Vector3, CubeTextureLoader } from "three";
import * as THREE from "three";
import { SolarSystem } from "./SolarSystem";
import { LoadingScreen } from "./LoadingScreen";
import { Preload, useGLTF } from "@react-three/drei";

// Preload all models and textures
const modelPaths = [
  "/models/space_ship/scene.gltf",
  // Add other model paths here
];

const texturePaths = [
  "/xpos.png",
  "/xneg.png",
  "/ypos.png",
  "/yneg.png",
  "/zpos.png",
  "/zneg.png",
  // Add other texture paths here
];

// Preload function
const preloadAssets = () => {
  // Preload models
  modelPaths.forEach((path) => useGLTF.preload(path));

  // Preload textures
  const textureLoader = new THREE.TextureLoader();
  texturePaths.forEach((path) => textureLoader.load(path));
};

export const GameScene = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { initializePlayer } = useGameStore();

  useEffect(() => {
    preloadAssets();
    initializePlayer();
  }, [initializePlayer]);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <Canvas
      style={{ width: "100vw", height: "100vh" }}
      camera={{
        position: [0, 0, 0],
        fov: 75,
        near: 0.1,
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
      onCreated={({ camera, gl, scene }) => {
        camera.matrixAutoUpdate = true;
        camera.updateProjectionMatrix();
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        gl.setClearColor(0x000000, 1);

        // Load skybox textures
        const loader = new CubeTextureLoader();
        const skyboxTexture = loader.load([
          "/xpos.png",
          "/xneg.png",
          "/ypos.png",
          "/yneg.png",
          "/zpos.png",
          "/zneg.png",
        ]);
        scene.background = skyboxTexture;
      }}
    >
      {/* Dark background color */}
      <color attach="background" args={[0x000000]} />

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

      <SolarSystem />

      {/* Preload all assets */}
      <Preload all />
    </Canvas>
  );
};
