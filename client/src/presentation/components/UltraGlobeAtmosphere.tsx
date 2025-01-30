import { useRef, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

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
}

export const UltraGlobeAtmosphere = ({
  radius = 200,
  atmosphereDensity = 1.0,
  sunPosition = new THREE.Vector3(1, 1, 1).normalize(),
  hasRings = true,
  cloudCoverage = 0.5,
  cloudDensity = 0.1,
  windSpeed = 0.07,
  atmosphereColor = new THREE.Color(0.6, 0.8, 1.0),
  ringsColor = new THREE.Color(0.6, 0.6, 0.6),
  weatherChangeSpeed = 0.1, // Default weather change speed
}: UltraGlobeAtmosphereProps) => {
  const atmosphereRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const cloudsMaterialRef = useRef<THREE.ShaderMaterial>(null);

  // Weather state management
  const weatherRef = useRef({
    time: 0,
    currentPhase: 0,
    phases: [
      { coverage: 0.2, density: 0.1, duration: 20 }, // Clear sky
      { coverage: 0.5, density: 0.3, duration: 15 }, // Partly cloudy
      { coverage: 0.7, density: 0.5, duration: 25 }, // Cloudy
      { coverage: 0.9, density: 0.8, duration: 10 }, // Storm
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

  // Atmosphere shader
  const atmosphereShader = {
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 sunPosition;
      uniform float atmosphereDensity;
      uniform vec3 atmosphereColor;
      
      varying vec3 vNormal;
      varying vec3 vWorldPosition;
      
      void main() {
        vec3 worldNormal = normalize(vNormal);
        vec3 lightDir = normalize(sunPosition);
        
        float intensity = pow(1.0 - abs(dot(worldNormal, lightDir)), 2.0) * atmosphereDensity;
        gl_FragColor = vec4(atmosphereColor, intensity);
      }
    `,
  };

  // Cloud shader
  const cloudShader = {
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      void main() {
        vUv = uv;
        vPosition = position;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform float coverage;
      uniform float density;
      uniform vec3 sunPosition;
      
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      
      // Improved noise functions
      vec2 hash2(vec2 p) {
        p = vec2(
          dot(p, vec2(127.1, 311.7)),
          dot(p, vec2(269.5, 183.3))
        );
        return fract(sin(p) * 43758.5453123);
      }
      
      float voronoi(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        
        float minDist = 1.0;
        
        for(int y = -1; y <= 1; y++) {
          for(int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(float(x), float(y));
            vec2 point = hash2(i + neighbor);
            vec2 diff = neighbor + point - f;
            float dist = length(diff);
            minDist = min(minDist, dist);
          }
        }
        return minDist;
      }
      
      float fbm(vec2 p) {
        float sum = 0.0;
        float amp = 1.0;
        float freq = 1.0;
        
        // More octaves for more detail
        for(int i = 0; i < 6; i++) {
          float n = voronoi(p * freq);
          sum += n * amp;
          amp *= 0.5;
          freq *= 2.0;
          p += vec2(3.123, 2.456); // Add variation to each octave
        }
        return sum;
      }
      
      float cloudPattern(vec2 p) {
        // Base noise pattern
        float n1 = fbm(p * 2.0 + time * 0.1);
        float n2 = fbm(p * 4.0 - time * 0.05);
        float n3 = fbm(p * 8.0 + time * 0.02);
        
        // Combine different frequencies
        float pattern = n1 * 0.5 + n2 * 0.25 + n3 * 0.25;
        
        // Create more interesting shapes
        float clouds = smoothstep(coverage, coverage + density, pattern);
        
        // Add some high-frequency detail
        float detail = fbm(p * 16.0 + vec2(time * 0.03));
        clouds *= 0.9 + detail * 0.1;
        
        // Create cloud layers
        float layer1 = smoothstep(0.1, 0.3, clouds);
        float layer2 = smoothstep(0.4, 0.6, clouds);
        float layer3 = smoothstep(0.7, 0.9, clouds);
        
        return mix(layer1 * 0.3, mix(layer2 * 0.6, layer3, 0.5), 0.5);
      }
      
      void main() {
        // Create spherical UV coordinates
        vec2 sphereUv = vec2(
          atan(vPosition.x, vPosition.z) / (2.0 * 3.14159) + 0.5,
          asin(vPosition.y / length(vPosition)) / 3.14159 + 0.5
        );
        
        // Add some rotation to the base coordinates
        float rotation = time * 0.02;
        vec2 rotatedUv = vec2(
          sphereUv.x * cos(rotation) - sphereUv.y * sin(rotation),
          sphereUv.x * sin(rotation) + sphereUv.y * cos(rotation)
        );
        
        // Generate cloud pattern
        float clouds = cloudPattern(rotatedUv * 4.0);
        
        // Lighting
        vec3 lightDir = normalize(sunPosition);
        float light = max(0.2, dot(vNormal, lightDir));
        
        // Add some rim lighting
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float rim = 1.0 - max(0.0, dot(viewDir, vNormal));
        rim = pow(rim, 3.0);
        
        // Combine lighting effects
        float finalLight = light + rim * 0.3;
        
        // Cloud color with depth variation
        vec3 cloudColor = mix(
          vec3(0.95, 0.95, 0.95), // Base color
          vec3(0.8, 0.8, 0.85),   // Shadow color
          clouds * 0.5
        );
        
        gl_FragColor = vec4(cloudColor * finalLight, clouds * smoothstep(0.0, 0.2, clouds));
      }
    `,
  };

  // Update light direction in object space
  const updateLightDirection = useCallback(() => {
    if (
      atmosphereRef.current &&
      materialRef.current &&
      cloudsMaterialRef.current
    ) {
      atmosphereRef.current.updateWorldMatrix(true, false);
      const objectSpaceLightDir = sunPosition
        .clone()
        .applyMatrix4(atmosphereRef.current.matrixWorld.invert())
        .normalize();

      materialRef.current.uniforms.sunPosition.value.copy(objectSpaceLightDir);
      cloudsMaterialRef.current.uniforms.sunPosition.value.copy(
        objectSpaceLightDir
      );
    }
  }, [sunPosition]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.atmosphereColor.value = atmosphereColor;
      materialRef.current.uniforms.atmosphereDensity.value = atmosphereDensity;
    }

    updateLightDirection();
  }, [atmosphereDensity, atmosphereColor, updateLightDirection]);

  useFrame((state) => {
    if (cloudsMaterialRef.current) {
      const deltaTime = state.clock.getElapsedTime() - weatherRef.current.time;
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
      const noiseValue = noise.get(noiseTime) * 0.2; // 20% variation

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
        lerpedDensity,
        0,
        1
      );
      cloudsMaterialRef.current.uniforms.time.value =
        state.clock.getElapsedTime() * windSpeed;

      // Adjust wind speed based on cloud density
      const currentWindSpeed = windSpeed * (1 + lerpedDensity);
      cloudsMaterialRef.current.uniforms.time.value =
        state.clock.getElapsedTime() * currentWindSpeed;
    }

    updateLightDirection();
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
          }}
        />
      </mesh>

      {/* Cloud layer */}
      <mesh ref={cloudsRef} scale={[1.1, 1.1, 1.1]}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial
          ref={cloudsMaterialRef}
          vertexShader={cloudShader.vertexShader}
          fragmentShader={cloudShader.fragmentShader}
          transparent
          depthWrite={false}
          uniforms={{
            time: { value: 0 },
            coverage: { value: 1.0 - cloudCoverage },
            density: { value: cloudDensity },
            sunPosition: { value: sunPosition },
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
