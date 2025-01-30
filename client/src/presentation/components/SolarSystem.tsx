import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { ProceduralPlanet } from "./ProceduralPlanet";

// Define a type for planet configuration
interface PlanetConfig {
  id: string;
  position: [number, number, number];
  orbitRadius: number;
  orbitSpeed: number;
  rotationSpeed: number;
  planetParams: {
    radius: number;
    amplitude: number;
    colors: {
      color1: THREE.Color;
      color2: THREE.Color;
      color3: THREE.Color;
      color4: THREE.Color;
      color5: THREE.Color;
    };
  };
}

// Create different planet configurations
const planets: PlanetConfig[] = [
  {
    id: "earth-like",
    position: [300, 0, 0],
    orbitRadius: 300,
    orbitSpeed: 0,
    rotationSpeed: 0,
    planetParams: {
      radius: 100,
      amplitude: 2.5,
      colors: {
        color1: new THREE.Color(0.014, 0.117, 0.279),
        color2: new THREE.Color(0.08, 0.527, 0.351),
        color3: new THREE.Color(0.62, 0.516, 0.372),
        color4: new THREE.Color(0.149, 0.254, 0.084),
        color5: new THREE.Color(0.15, 0.15, 0.15),
      },
    },
  },
  //   {
  //     id: "desert-planet",
  //     position: [600, 0, 0],
  //     orbitRadius: 600,
  //     orbitSpeed: 0.05,
  //     rotationSpeed: 0.3,
  //     planetParams: {
  //       radius: 80,
  //       amplitude: 1.8,
  //       colors: {
  //         color1: new THREE.Color(0.8, 0.4, 0.1),
  //         color2: new THREE.Color(0.7, 0.3, 0.1),
  //         color3: new THREE.Color(0.6, 0.2, 0.1),
  //         color4: new THREE.Color(0.5, 0.15, 0.1),
  //         color5: new THREE.Color(0.4, 0.1, 0.05),
  //       },
  //     },
  //   },
  //   {
  //     id: "ice-planet",
  //     position: [900, 0, 0],
  //     orbitRadius: 900,
  //     orbitSpeed: 0.03,
  //     rotationSpeed: 0.2,
  //     planetParams: {
  //       radius: 120,
  //       amplitude: 3.0,
  //       colors: {
  //         color1: new THREE.Color(0.8, 0.8, 0.9),
  //         color2: new THREE.Color(0.7, 0.7, 0.8),
  //         color3: new THREE.Color(0.6, 0.6, 0.7),
  //         color4: new THREE.Color(0.5, 0.5, 0.6),
  //         color5: new THREE.Color(0.4, 0.4, 0.5),
  //       },
  //     },
  //   },
];

const Planet = ({ config }: { config: PlanetConfig }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Rotate planet around its axis
      groupRef.current.rotation.y += config.rotationSpeed * delta;

      // Orbit around the center
      const time = state.clock.getElapsedTime();
      const x = Math.cos(time * config.orbitSpeed) * config.orbitRadius;
      const z = Math.sin(time * config.orbitSpeed) * config.orbitRadius;
      groupRef.current.position.set(x, 0, z);
    }
  });

  return (
    <group ref={groupRef}>
      <ProceduralPlanet
        radius={config.planetParams.radius}
        amplitude={config.planetParams.amplitude}
        colors={config.planetParams.colors}
      />
    </group>
  );
};

export const SolarSystem = () => {
  return (
    <group>
      {planets.map((planet) => (
        <Planet key={planet.id} config={planet} />
      ))}
    </group>
  );
};
