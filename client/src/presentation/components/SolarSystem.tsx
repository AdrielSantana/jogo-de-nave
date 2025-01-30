import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { ProceduralPlanet } from "./ProceduralPlanet";
import { Sun } from "./Sun";

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
    // Terrain generation parameters
    sharpness: number;
    offset: number;
    period: number;
    persistence: number;
    lacunarity: number;
    octaves: number;
    // Lighting parameters
    ambientIntensity: number;
    diffuseIntensity: number;
    specularIntensity: number;
    shininess: number;
    // Surface parameters
    bumpStrength: number;
    bumpOffset: number;
    // Color transitions
    transition2: number;
    transition3: number;
    transition4: number;
    transition5: number;
    blend12: number;
    blend23: number;
    blend34: number;
    blend45: number;
    // Colors
    colors: {
      color1: THREE.Color;
      color2: THREE.Color;
      color3: THREE.Color;
      color4: THREE.Color;
      color5: THREE.Color;
    };
    // Atmosphere
    atmosphereThickness: number;
    atmosphereColor: THREE.Color;
  };
}

// Create different planet configurations
const planets: PlanetConfig[] = [
  {
    id: "earth-like",
    position: [500, 0, 0],
    orbitRadius: 500,
    orbitSpeed: 0.02,
    rotationSpeed: 0.1,
    planetParams: {
      radius: 50,
      amplitude: 1.5,
      sharpness: 2.5,
      offset: -0.02,
      period: 0.6,
      persistence: 0.52,
      lacunarity: 2.2,
      octaves: 12,
      ambientIntensity: 0.03,
      diffuseIntensity: 1.2,
      specularIntensity: 2.5,
      shininess: 12.0,
      bumpStrength: 1.0,
      bumpOffset: 0.002,
      transition2: 0.05,
      transition3: 0.08,
      transition4: 0.35,
      transition5: 0.65,
      blend12: 0.02,
      blend23: 0.03,
      blend34: 0.15,
      blend45: 0.25,
      colors: {
        color1: new THREE.Color(0.02, 0.1, 0.35),
        color2: new THREE.Color(0.05, 0.3, 0.5),
        color3: new THREE.Color(0.8, 0.7, 0.5),
        color4: new THREE.Color(0.15, 0.35, 0.1),
        color5: new THREE.Color(0.25, 0.25, 0.25),
      },
      atmosphereThickness: 2.5,
      atmosphereColor: new THREE.Color(0.6, 0.8, 1.0),
    },
  },
  {
    id: "desert-planet",
    position: [750, 0, 0],
    orbitRadius: 750,
    orbitSpeed: 0.015,
    rotationSpeed: 0.15,
    planetParams: {
      radius: 40,
      amplitude: 1.5,
      sharpness: 3.0,
      offset: -0.015,
      period: 0.5,
      persistence: 0.6,
      lacunarity: 2.4,
      octaves: 10,
      ambientIntensity: 0.04,
      diffuseIntensity: 1.4,
      specularIntensity: 3.0,
      shininess: 8.0,
      bumpStrength: 0.8,
      bumpOffset: 0.003,
      transition2: 0.04,
      transition3: 0.12,
      transition4: 0.3,
      transition5: 0.7,
      blend12: 0.04,
      blend23: 0.05,
      blend34: 0.2,
      blend45: 0.3,
      colors: {
        color1: new THREE.Color(0.7, 0.4, 0.1),
        color2: new THREE.Color(0.8, 0.5, 0.2),
        color3: new THREE.Color(0.9, 0.6, 0.3),
        color4: new THREE.Color(0.6, 0.3, 0.1),
        color5: new THREE.Color(0.4, 0.25, 0.15),
      },
      atmosphereThickness: 2.0,
      atmosphereColor: new THREE.Color(1.0, 0.8, 0.6),
    },
  },
  {
    id: "ice-planet",
    position: [1000, 0, 0],
    orbitRadius: 1000,
    orbitSpeed: 0.01,
    rotationSpeed: 0.08,
    planetParams: {
      radius: 60,
      amplitude: 1.5,
      sharpness: 2.8,
      offset: -0.01,
      period: 0.7,
      persistence: 0.48,
      lacunarity: 2.0,
      octaves: 8,
      ambientIntensity: 0.05,
      diffuseIntensity: 1.5,
      specularIntensity: 4.0,
      shininess: 20.0,
      bumpStrength: 0.6,
      bumpOffset: 0.001,
      transition2: 0.03,
      transition3: 0.06,
      transition4: 0.25,
      transition5: 0.6,
      blend12: 0.02,
      blend23: 0.02,
      blend34: 0.1,
      blend45: 0.15,
      colors: {
        color1: new THREE.Color(0.7, 0.8, 0.9),
        color2: new THREE.Color(0.8, 0.9, 1.0),
        color3: new THREE.Color(0.6, 0.7, 0.8),
        color4: new THREE.Color(0.5, 0.6, 0.7),
        color5: new THREE.Color(0.4, 0.5, 0.6),
      },
      atmosphereThickness: 3.0,
      atmosphereColor: new THREE.Color(0.8, 0.9, 1.0),
    },
  },
  {
    id: "volcanic-planet",
    position: [1250, 0, 0],
    orbitRadius: 1250,
    orbitSpeed: 0.008,
    rotationSpeed: 0.12,
    planetParams: {
      radius: 45,
      amplitude: 1.8,
      sharpness: 3.5,
      offset: -0.025,
      period: 0.4,
      persistence: 0.65,
      lacunarity: 2.8,
      octaves: 14,
      ambientIntensity: 0.02,
      diffuseIntensity: 1.6,
      specularIntensity: 3.5,
      shininess: 15.0,
      bumpStrength: 1.2,
      bumpOffset: 0.004,
      transition2: 0.06,
      transition3: 0.15,
      transition4: 0.4,
      transition5: 0.75,
      blend12: 0.03,
      blend23: 0.04,
      blend34: 0.12,
      blend45: 0.2,
      colors: {
        color1: new THREE.Color(0.3, 0.05, 0.0),
        color2: new THREE.Color(0.5, 0.1, 0.0),
        color3: new THREE.Color(0.7, 0.2, 0.0),
        color4: new THREE.Color(0.4, 0.15, 0.0),
        color5: new THREE.Color(0.2, 0.1, 0.1),
      },
      atmosphereThickness: 2.25,
      atmosphereColor: new THREE.Color(0.8, 0.3, 0.1),
    },
  },
  {
    id: "alien-planet",
    position: [1500, 0, 0],
    orbitRadius: 1500,
    orbitSpeed: 0.01,
    rotationSpeed: 0.18,
    planetParams: {
      radius: 55,
      amplitude: 1.5,
      sharpness: 2.2,
      offset: -0.03,
      period: 0.55,
      persistence: 0.58,
      lacunarity: 2.5,
      octaves: 11,
      ambientIntensity: 0.04,
      diffuseIntensity: 1.3,
      specularIntensity: 2.8,
      shininess: 10.0,
      bumpStrength: 0.9,
      bumpOffset: 0.0025,
      transition2: 0.07,
      transition3: 0.18,
      transition4: 0.45,
      transition5: 0.8,
      blend12: 0.05,
      blend23: 0.06,
      blend34: 0.18,
      blend45: 0.25,
      colors: {
        color1: new THREE.Color(0.1, 0.3, 0.2),
        color2: new THREE.Color(0.2, 0.4, 0.3),
        color3: new THREE.Color(0.3, 0.5, 0.2),
        color4: new THREE.Color(0.4, 0.3, 0.5),
        color5: new THREE.Color(0.2, 0.2, 0.3),
      },
      atmosphereThickness: 2.75,
      atmosphereColor: new THREE.Color(0.4, 0.6, 0.5),
    },
  },
];

const Planet = ({ config }: { config: PlanetConfig }) => {
  const groupRef = useRef<THREE.Group>(null);
  const rotationRef = useRef(0);
  // Add random initial orbital position
  const initialOrbitAngle = useRef(Math.random() * Math.PI * 2);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Update rotation tracking
      rotationRef.current =
        (rotationRef.current + config.rotationSpeed * delta) % (2 * Math.PI);

      // Rotate planet around its axis
      groupRef.current.rotation.y = rotationRef.current;

      // Orbit around the center with random initial position
      const time = state.clock.getElapsedTime();
      const orbitAngle = initialOrbitAngle.current + time * config.orbitSpeed;
      const x = Math.cos(orbitAngle) * config.orbitRadius;
      const z = Math.sin(orbitAngle) * config.orbitRadius;
      groupRef.current.position.set(x, 0, z);
    }
  });

  return (
    <group ref={groupRef}>
      <ProceduralPlanet
        radius={config.planetParams.radius}
        amplitude={config.planetParams.amplitude}
        colors={config.planetParams.colors}
        rotation={rotationRef.current}
        atmosphereThickness={config.planetParams.atmosphereThickness}
        atmosphereColor={config.planetParams.atmosphereColor}
      />
    </group>
  );
};

export const SolarSystem = () => {
  return (
    <group>
      {/* Add the Sun at the center with reduced size */}
      <Sun radius={80} position={[500, 0, 500]} />

      {/* Existing planets */}
      {planets.map((planet) => (
        <Planet key={planet.id} config={planet} />
      ))}
    </group>
  );
};
