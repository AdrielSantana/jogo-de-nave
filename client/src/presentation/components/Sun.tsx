import { ProceduralSun } from "./ProceduralSun";
import * as THREE from "three";
import {
  Lensflare,
  LensflareElement,
} from "three/examples/jsm/objects/Lensflare.js";
import { useEffect, useRef } from "react";

interface SunProps {
  sunConfig: {
    radius: number;
    position: [number, number, number];
    sunColor: THREE.Color;
  };
}

export const Sun = ({ sunConfig }: SunProps) => {
  const lightRef = useRef<THREE.PointLight>(null);

  // Load lens flare textures
  const textureLoader = new THREE.TextureLoader();

  const textureFlare0 = textureLoader.load(
    "/textures/lensflare/lensflare0.png"
  );
  const textureFlare3 = textureLoader.load(
    "/textures/lensflare/lensflare3.png"
  );
  // Setup lens flare effect
  useEffect(() => {
    if (lightRef.current) {
      const lensflare = new Lensflare();

      lensflare.addElement(
        new LensflareElement(textureFlare0, 700, 0, sunConfig.sunColor)
      );
      lensflare.addElement(
        new LensflareElement(textureFlare3, 60, 0.6, sunConfig.sunColor)
      );
      lensflare.addElement(
        new LensflareElement(textureFlare3, 70, 0.7, sunConfig.sunColor)
      );
      lensflare.addElement(
        new LensflareElement(textureFlare3, 120, 0.9, sunConfig.sunColor)
      );
      lensflare.addElement(
        new LensflareElement(textureFlare3, 70, 1, sunConfig.sunColor)
      );

      lightRef.current.add(lensflare);
    }
  }, [textureFlare0, textureFlare3]);

  return (
    <group position={sunConfig.position}>
      {/* Core sun sphere with procedural texture */}
      <ProceduralSun sunColor={sunConfig.sunColor} radius={sunConfig.radius} />

      {/* Lens flare light source */}
      <pointLight
        ref={lightRef}
        color={sunConfig.sunColor}
        intensity={3}
        distance={3000}
        decay={1}
      />

      {/* Main light for illumination */}
      <pointLight
        color={sunConfig.sunColor}
        intensity={3}
        distance={sunConfig.radius * 50}
        decay={2}
      />

      {/* Subtle ambient light */}
      <ambientLight intensity={0.1} color={sunConfig.sunColor} />
    </group>
  );
};
