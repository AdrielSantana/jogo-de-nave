import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { calculateLightIntensity } from "../../domain/shared/LightingUtils";

interface UltraGlobeAtmosphereProps {
  radius?: number;
  atmosphereDensity?: number;
  sunPosition?: THREE.Vector3;
  hasRings?: boolean;
  cloudCoverage?: number;
  cloudDensity?: number;
  windSpeed?: number;
  atmosphereColor?: THREE.Color;
  ringsColor?: THREE.Color;
  weatherChangeSpeed?: number; // Speed of weather changes
  sunColor: THREE.Color;
}

export const UltraGlobeAtmosphere = ({
  radius = 200,
  atmosphereDensity = 1.0,
  sunPosition = new THREE.Vector3(1, 0.5, 0).normalize(),
  hasRings = true,
  cloudCoverage = 0.7,
  cloudDensity = 0.3,
  windSpeed = 0.07,
  atmosphereColor = new THREE.Color(0.6, 0.8, 1.0),
  ringsColor = new THREE.Color(0.6, 0.6, 0.6),
  weatherChangeSpeed = 0.1,
  sunColor,
}: UltraGlobeAtmosphereProps) => {
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const cloudsMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const worldPosition = new THREE.Vector3();

  // Weather state management with increased coverage and density
  const weatherRef = useRef({
    time: 0,
    currentPhase: 0,
    phases: [
      { coverage: 0.4, density: 0.3, duration: 20 }, // Clear sky (more clouds)
      { coverage: 0.7, density: 0.5, duration: 15 }, // Partly cloudy (denser)
      { coverage: 0.8, density: 0.7, duration: 25 }, // Cloudy (more coverage)
      { coverage: 0.9, density: 0.9, duration: 10 }, // Storm (maximum coverage)
    ],
  });

  // Noise functions for smooth weather transitions
  const noise = useMemo(() => {
    return {
      get: (x: number) => {
        // Simple smooth noise function
        const x1 = Math.sin(x * 0.3) * 0.5 + 0.5;
        const x2 = Math.sin(x * 0.7 + 2.0) * 0.5 + 0.5;
        const x3 = Math.sin(x * 1.1 + 4.0) * 0.5 + 0.5;
        return (x1 + x2 + x3) / 3.0;
      },
    };
  }, []);

  // Atmosphere shader with fixed light direction
  const atmosphereShader = {
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      void main() {
        vNormal = normalize(normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 sunPosition;
      uniform float atmosphereDensity;
      uniform vec3 atmosphereColor;
      uniform float lightIntensity;
      
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(sunPosition);
        
        float NdotL = dot(normal, lightDir);
        // Even softer edge transition
        float shadowFalloff = pow(1.0 - abs(NdotL), 4.0);
        float intensity = shadowFalloff * atmosphereDensity * lightIntensity * 0.4; // Further reduced intensity
        
        float darkSide = pow(max(0.0, -NdotL), 4.0);
        intensity *= (1.0 - darkSide * 0.99); // Stronger dark side effect
        
        gl_FragColor = vec4(atmosphereColor, intensity * 0.6); // Further reduced final alpha
      }
    `,
  };

  // Cloud shader with fixed light direction
  const cloudShader = {
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vPosition = position;
        vNormal = normalize(normal); // Use local space normal directly
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float coverage;
      uniform float density;
      uniform vec3 sunPosition;
      uniform vec3 sunColor;
      uniform vec3 atmosphereColor;
      uniform float atmosphereDensity;
      uniform float lightIntensity;
      varying vec3 vNormal;
      varying vec3 vPosition;

      // Hash function for noise
      float hash(vec3 p) {
        p = fract(p * vec3(0.1031, 0.1030, 0.0973));
        p += dot(p, p.yxz + 33.33);
        return fract((p.x + p.y) * p.z);
      }

      // 3D noise
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        
        float a = hash(i);
        float b = hash(i + vec3(1.0, 0.0, 0.0));
        float c = hash(i + vec3(0.0, 1.0, 0.0));
        float d = hash(i + vec3(1.0, 1.0, 0.0));
        float e = hash(i + vec3(0.0, 0.0, 1.0));
        float f1 = hash(i + vec3(1.0, 0.0, 1.0));
        float g = hash(i + vec3(0.0, 1.0, 1.0));
        float h = hash(i + vec3(1.0, 1.0, 1.0));

        return mix(
          mix(mix(a, b, f.x), mix(c, d, f.x), f.y),
          mix(mix(e, f1, f.x), mix(g, h, f.x), f.y),
          f.z
        );
      }

      // FBM (Fractal Brownian Motion)
      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 1.0;
        
        for(int i = 0; i < 5; i++) {
          value += amplitude * noise(p * frequency);
          amplitude *= 0.5;
          frequency *= 2.0;
          p = p * 1.1 + vec3(1.7, 9.2, 4.1);
        }
        
        return value;
      }

      // Cloud pattern generation
      float cloudPattern(vec3 p) {
        p += time * 0.1;
        float n1 = fbm(p * 2.0);
        float n2 = fbm(p * 4.0 - vec3(time * 0.2));
        float n3 = fbm(p * 8.0 + vec3(time * 0.1));
        
        float pattern = n1 * 0.5 + n2 * 0.25 + n3 * 0.25;
        float clouds = smoothstep(coverage, coverage + density, pattern);
        
        float detail = fbm(p * 16.0 + vec3(time * 0.05));
        clouds *= 0.8 + detail * 0.2;
        
        return clouds;
      }
      
      void main() {
        vec3 nPos = normalize(vPosition);
        float clouds = cloudPattern(nPos * 4.0);
        
        vec3 normal = normalize(vNormal);
        vec3 lightDir = normalize(sunPosition);
        float NdotL = dot(normal, lightDir);
        
        float directLight = smoothstep(-0.2, 0.5, NdotL) * lightIntensity * 0.6; // Reduced more
        float ambient = 0.015; // Further reduced ambient
        
        float totalLight = directLight + ambient;
        
        vec3 blendedLight = mix(sunColor, atmosphereColor, atmosphereDensity);
        vec3 sunlitColor = blendedLight * 0.7; // Further reduced brightness
        vec3 shadowColor = vec3(0.002, 0.002, 0.005); // Even darker shadow
        vec3 cloudColor = mix(shadowColor, sunlitColor, totalLight);
        
        float shadowFade = smoothstep(-0.5, 0.0, NdotL);
        float darkSide = pow(max(0.0, -NdotL), 4.0);
        float finalAlpha = clouds * smoothstep(0.0, 0.2, clouds) * mix(0.03, 0.4, shadowFade);
        finalAlpha *= (1.0 - darkSide * 0.98);
        
        gl_FragColor = vec4(cloudColor, finalAlpha);
      }
    `,
  };

  // Update every frame
  useFrame((state) => {
    if (cloudsMaterialRef.current) {
      // Only update time for cloud movement
      cloudsMaterialRef.current.uniforms.time.value =
        state.clock.getElapsedTime() * windSpeed;

      // Weather phase calculations
      weatherRef.current.time = state.clock.getElapsedTime();

      // Calculate current and next phase
      const totalDuration = weatherRef.current.phases.reduce(
        (sum, phase) => sum + phase.duration,
        0
      );
      const currentTime =
        (state.clock.getElapsedTime() * weatherChangeSpeed) % totalDuration;

      let accumulatedTime = 0;
      let currentPhase = 0;
      let nextPhase = 1;

      for (let i = 0; i < weatherRef.current.phases.length; i++) {
        accumulatedTime += weatherRef.current.phases[i].duration;
        if (currentTime < accumulatedTime) {
          currentPhase = i;
          nextPhase = (i + 1) % weatherRef.current.phases.length;
          break;
        }
      }

      // Calculate transition progress
      const phaseStartTime =
        accumulatedTime - weatherRef.current.phases[currentPhase].duration;
      const phaseProgress =
        (currentTime - phaseStartTime) /
        weatherRef.current.phases[currentPhase].duration;

      // Add some noise to the transition
      const noiseTime = state.clock.getElapsedTime() * 0.1;
      const noiseValue = noise.get(noiseTime) * 0.2;

      // Interpolate between phases
      const currentPhaseData = weatherRef.current.phases[currentPhase];
      const nextPhaseData = weatherRef.current.phases[nextPhase];

      const lerpedCoverage =
        THREE.MathUtils.lerp(
          currentPhaseData.coverage,
          nextPhaseData.coverage,
          phaseProgress
        ) + noiseValue;

      const lerpedDensity =
        THREE.MathUtils.lerp(
          currentPhaseData.density,
          nextPhaseData.density,
          phaseProgress
        ) + noiseValue;

      // Update cloud uniforms
      cloudsMaterialRef.current.uniforms.coverage.value =
        1.0 - THREE.MathUtils.clamp(lerpedCoverage, 0, 1);
      cloudsMaterialRef.current.uniforms.density.value = THREE.MathUtils.clamp(
        lerpedDensity * 1.2, // Keep the density multiplier
        0,
        1
      );
    }

    // Calculate distance-based light intensity
    if (atmosphereRef.current) {
      atmosphereRef.current.getWorldPosition(worldPosition);
      const intensity = calculateLightIntensity(
        worldPosition,
        sunPosition,
        "atmosphere"
      );

      // Update atmosphere material
      if (materialRef.current) {
        materialRef.current.uniforms.lightIntensity.value = intensity;
      }

      // Update cloud material
      if (cloudsMaterialRef.current) {
        cloudsMaterialRef.current.uniforms.lightIntensity.value = intensity;
      }
    }
  });

  return (
    <>
      {/* Atmosphere sphere */}
      <mesh ref={atmosphereRef} scale={[1.2, 1.2, 1.2]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={atmosphereShader.vertexShader}
          fragmentShader={atmosphereShader.fragmentShader}
          transparent
          depthWrite={false}
          uniforms={{
            sunPosition: { value: sunPosition },
            atmosphereDensity: { value: atmosphereDensity },
            atmosphereColor: { value: atmosphereColor },
            lightIntensity: { value: 1.0 },
          }}
        />
      </mesh>

      {/* Cloud layer with adjusted scale for more visibility */}
      <mesh ref={cloudsRef} scale={[1.15, 1.15, 1.15]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          ref={cloudsMaterialRef}
          vertexShader={cloudShader.vertexShader}
          fragmentShader={cloudShader.fragmentShader}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            time: { value: 0 },
            coverage: { value: 1.0 - cloudCoverage },
            density: { value: cloudDensity * 1.2 },
            sunPosition: { value: sunPosition },
            sunColor: { value: sunColor },
            atmosphereColor: { value: atmosphereColor },
            atmosphereDensity: { value: atmosphereDensity },
            lightIntensity: { value: 1.0 },
          }}
        />
      </mesh>

      {/* Optional rings */}
      {hasRings && (
        <mesh rotation-x={Math.PI / 4}>
          <ringGeometry args={[radius * 1.5, radius * 2.2, 64]} />
          <meshBasicMaterial
            color={ringsColor}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </>
  );
};
