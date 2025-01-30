import { ProceduralSun } from "./ProceduralSun";
import * as THREE from "three";
import {
  Lensflare,
  LensflareElement,
} from "three/examples/jsm/objects/Lensflare.js";
import { useEffect, useRef } from "react";

interface SunProps {
  radius?: number;
  position?: [number, number, number];
}

export const Sun = ({ radius = 100, position = [0, 0, 0] }: SunProps) => {
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
        new LensflareElement(textureFlare0, 700, 0, new THREE.Color(0x6699ff))
      );
      lensflare.addElement(new LensflareElement(textureFlare3, 60, 0.6));
      lensflare.addElement(new LensflareElement(textureFlare3, 70, 0.7));
      lensflare.addElement(new LensflareElement(textureFlare3, 120, 0.9));
      lensflare.addElement(new LensflareElement(textureFlare3, 70, 1));

      lightRef.current.add(lensflare);
    }
  }, [textureFlare0, textureFlare3]);

  return (
    <group position={position}>
      {/* Core sun sphere with procedural texture */}
      <ProceduralSun radius={radius} />

      {/* Lens flare light source */}
      <pointLight
        ref={lightRef}
        color={0xffffff}
        intensity={3}
        distance={3000}
        decay={1}
      />

      {/* Main light for illumination */}
      <pointLight
        color={0xffaa33}
        intensity={3}
        distance={radius * 50}
        decay={2}
      />

      {/* Subtle ambient light */}
      <ambientLight intensity={0.1} color={0xff9966} />
    </group>
  );
};
