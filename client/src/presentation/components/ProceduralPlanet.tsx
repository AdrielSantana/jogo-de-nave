import { useRef, useMemo, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { UltraGlobeAtmosphere } from "./UltraGlobeAtmosphere";

const noiseFunctions = `
const float PI = 3.14159265;

//	Simplex 3D Noise 
//	by Ian McEwan, Ashima Arts
//
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

float simplex3(vec3 v) { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0 ); 
  vec4 p = permute( permute( permute( 
            i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
          + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

  float n_ = 1.0/7.0;
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

float fractal3(      
  vec3 v,
  float sharpness,
  float period,
  float persistence,
  float lacunarity,
  int octaves
) {
  float n = 0.0;
  float a = 1.0;
  float max_amp = 0.0;
  float P = period;

  for(int i = 0; i < octaves; i++) {
      n += a * simplex3(v / P);
      a *= persistence;
      max_amp += a;
      P /= lacunarity;
  }

  return n / max_amp;
}

float terrainHeight(
  int type,
  vec3 v,
  float amplitude,
  float sharpness,
  float offset,
  float period,
  float persistence,
  float lacunarity,
  int octaves
) {
  float h = 0.0;

  if (type == 2) {
    h = amplitude * fractal3(
      v,
      sharpness,
      period, 
      persistence, 
      lacunarity, 
      octaves);
    h = amplitude * pow(max(0.0, (h + 1.0) / 2.0), sharpness);
  }

  return max(0.0, h + offset);
}`;

interface ProceduralPlanetProps {
  radius?: number;
  amplitude?: number;
  colors?: {
    color1: THREE.Color;
    color2: THREE.Color;
    color3: THREE.Color;
    color4: THREE.Color;
    color5: THREE.Color;
  };
  atmosphereThickness?: number;
  atmosphereColor?: THREE.Color;
  hasRings?: boolean;
  ringsColor?: THREE.Color;
}

export const ProceduralPlanet = ({
  radius = 200.0,
  amplitude = 5.0,
  colors = {
    color1: new THREE.Color(0.02, 0.1, 0.35), // Deep ocean
    color2: new THREE.Color(0.05, 0.3, 0.5), // Shallow water
    color3: new THREE.Color(0.8, 0.7, 0.5), // Beach/Coast
    color4: new THREE.Color(0.15, 0.35, 0.1), // Vegetation
    color5: new THREE.Color(0.15, 0.15, 0.15), // Mountains - More gray with slight blue tint
  },
  atmosphereThickness = 1,
  hasRings = false,
  ringsColor = new THREE.Color(0.6, 0.6, 0.6),
  atmosphereColor = new THREE.Color(0.6, 0.8, 1.0),
}: ProceduralPlanetProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const worldPosition = new THREE.Vector3();
  const matrixRef = useRef(new THREE.Matrix4());

  // Fixed light direction in world space
  const lightDir = useMemo(() => new THREE.Vector3(0, 0, 0).normalize(), []);

  // Matrix to transform light direction from world to object space
  const updateLightDirection = useCallback(() => {
    if (meshRef.current) {
      // Get the world matrix of the mesh
      meshRef.current.updateWorldMatrix(true, false);
      // Get the inverse of the world matrix
      matrixRef.current.copy(meshRef.current.matrixWorld).invert();
      // Transform the light direction to object space
      const objectSpaceLightDir = lightDir
        .clone()
        .applyMatrix4(matrixRef.current)
        .normalize();

      // Update the shader uniform
      if (meshRef.current.material instanceof THREE.ShaderMaterial) {
        meshRef.current.material.uniforms.lightDirection.value.copy(
          objectSpaceLightDir
        );
      }
    }
  }, [lightDir]);

  // Update light direction when rotation changes
  useEffect(() => {
    updateLightDirection();
  }, [updateLightDirection]);

  useFrame(() => {
    updateLightDirection();
  });

  // LOD configuration for geometry detail
  const lodLevels = useMemo(
    () => [
      {
        distance: radius * 0.5, // Very close
        segments: 256,
        bumpStrength: 1,
        amplitude: amplitude,
      },
      {
        distance: radius * 2.0, // Close
        segments: 128,
        bumpStrength: 0.8,
        amplitude: amplitude * 0.95,
      },
      {
        distance: radius * 8.0, // Medium
        segments: 64,
        bumpStrength: 0.6,
        amplitude: amplitude * 0.9,
      },
      {
        distance: radius * 32.0, // Far
        segments: 32,
        bumpStrength: 0.4,
        amplitude: amplitude * 0.8,
      },
      {
        distance: radius * 128.0, // Very far
        segments: 16,
        bumpStrength: 0.2,
        amplitude: amplitude * 0.7,
      },
      {
        distance: Infinity, // Extreme distance
        segments: 8,
        bumpStrength: 0.1,
        amplitude: amplitude * 0.6,
      },
    ],
    [radius, amplitude]
  );

  // Create geometries for each LOD level
  const lodGeometries = useMemo(() => {
    return lodLevels.map((level) => {
      const geo = new THREE.SphereGeometry(1, level.segments, level.segments);
      geo.computeTangents();
      return geo;
    });
  }, [lodLevels]);

  // Current LOD level
  const currentLOD = useRef(0);

  const planetParams = useMemo(
    () => ({
      type: { value: 2 },
      radius: { value: radius },
      amplitude: { value: amplitude },
      sharpness: { value: 3 },
      offset: { value: -0.02 },
      period: { value: 0.6 },
      persistence: { value: 0.52 },
      lacunarity: { value: 2.2 },
      octaves: { value: 12 },
      ambientIntensity: { value: 0.03 },
      diffuseIntensity: { value: 1.2 },
      specularIntensity: { value: 1 },
      shininess: { value: 10.0 },
      lightDirection: { value: lightDir },
      lightColor: { value: new THREE.Color(1, 1, 1) },
      bumpStrength: { value: 1.0 },
      bumpOffset: { value: 0.002 },
      color1: { value: colors.color1 }, // Deep ocean
      color2: { value: colors.color2 }, // Shallow water
      color3: { value: colors.color3 }, // Beach/Coast
      color4: { value: colors.color4 }, // Vegetation
      color5: { value: colors.color5 }, // Mountains - More gray with slight blue tint
      transition2: { value: 0.05 },
      transition3: { value: 0.08 },
      transition4: { value: 0.35 },
      transition5: { value: 0.65 }, // Lower transition point for more mountains
      blend12: { value: 0.02 },
      blend23: { value: 0.03 },
      blend34: { value: 0.15 },
      blend45: { value: 0.25 }, // Wider blend for smoother mountain transition
      atmosphereBlend: { value: 0.0 },
    }),
    [radius, amplitude, lightDir]
  );

  useFrame((state) => {
    if (meshRef.current) {
      // Get world position and calculate distance
      meshRef.current.getWorldPosition(worldPosition);
      const distance =
        (state.camera.parent?.position.distanceTo(worldPosition) || radius) -
        radius;

      // Determine appropriate LOD level
      let newLOD = lodLevels.findIndex((level) => distance < level.distance);
      if (newLOD === -1) newLOD = lodLevels.length - 1;

      // Update geometry if LOD level changed
      if (newLOD !== currentLOD.current) {
        meshRef.current.geometry = lodGeometries[newLOD];
        currentLOD.current = newLOD;

        // Update shader parameters based on LOD
        planetParams.bumpStrength.value = lodLevels[newLOD].bumpStrength;
        planetParams.amplitude.value = lodLevels[newLOD].amplitude;

        // Calculate atmosphere blend based on distance
        const maxDistance = lodLevels[lodLevels.length - 2].distance;
        const blend = Math.max(
          0,
          Math.min(0.8, (distance - lodLevels[0].distance) / maxDistance) // Cap blend at 0.8 to maintain visibility
        );
        planetParams.atmosphereBlend.value = blend;
      }
    }
  });

  return (
    <>
      <mesh
        ref={meshRef}
        geometry={lodGeometries[0]}
        frustumCulled={false} // Disable frustum culling
      >
        <shaderMaterial
          vertexShader={`
            attribute vec3 tangent;
            uniform int type;
            uniform float radius;
            uniform float amplitude;
            uniform float sharpness;
            uniform float offset;
            uniform float period;
            uniform float persistence;
            uniform float lacunarity;
            uniform int octaves;
            uniform float bumpStrength;
            uniform float bumpOffset;
            uniform float atmosphereBlend;

            varying vec3 fragPosition;
            varying vec3 fragNormal;
            varying vec3 fragTangent;
            varying vec3 fragBitangent;
            varying float vAtmosphereBlend;

            ${noiseFunctions}

            void main() {
              float h = terrainHeight(
                type,
                position,
                amplitude, 
                sharpness,
                offset,
                period, 
                persistence, 
                lacunarity, 
                octaves);

              vec3 pos = position * (radius + h);

              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
              fragPosition = position;
              fragNormal = normal;
              fragTangent = tangent;
              fragBitangent = cross(normal, tangent);
              vAtmosphereBlend = atmosphereBlend;
            }
          `}
          fragmentShader={`
            uniform int type;
            uniform float radius;
            uniform float amplitude;
            uniform float sharpness;
            uniform float offset;
            uniform float period;
            uniform float persistence;
            uniform float lacunarity;
            uniform int octaves;
            uniform vec3 color1;
            uniform vec3 color2;
            uniform vec3 color3;
            uniform vec3 color4;
            uniform vec3 color5;
            uniform float transition2;
            uniform float transition3;
            uniform float transition4;
            uniform float transition5;
            uniform float blend12;
            uniform float blend23;
            uniform float blend34;
            uniform float blend45;
            uniform float bumpStrength;
            uniform float bumpOffset;
            uniform float ambientIntensity;
            uniform float diffuseIntensity;
            uniform float specularIntensity;
            uniform float shininess;
            uniform vec3 lightDirection;
            uniform vec3 lightColor;
            uniform float atmosphereBlend;

            varying vec3 fragPosition;
            varying vec3 fragNormal;
            varying vec3 fragTangent;
            varying vec3 fragBitangent;
            varying float vAtmosphereBlend;

            ${noiseFunctions}

            void main() {
              float h = terrainHeight(
                type,
                fragPosition,
                amplitude, 
                sharpness,
                offset,
                period, 
                persistence, 
                lacunarity, 
                octaves);

              vec3 dx = bumpOffset * fragTangent;
              float h_dx = terrainHeight(
                type,
                fragPosition + dx,
                amplitude, 
                sharpness,
                offset,
                period, 
                persistence, 
                lacunarity, 
                octaves);

              vec3 dy = bumpOffset * fragBitangent;
              float h_dy = terrainHeight(
                type,
                fragPosition + dy,
                amplitude, 
                sharpness,
                offset,
                period, 
                persistence, 
                lacunarity, 
                octaves);

              vec3 pos = fragPosition * (radius + h);
              vec3 pos_dx = (fragPosition + dx) * (radius + h_dx);
              vec3 pos_dy = (fragPosition + dy) * (radius + h_dy);

              vec3 bumpNormal = normalize(cross(pos_dx - pos, pos_dy - pos));
              vec3 N = normalize(mix(fragNormal, bumpNormal, bumpStrength));

              vec3 L = normalize(-lightDirection);
              vec3 V = normalize(cameraPosition - pos);
              vec3 R = normalize(reflect(L, N));

              float diffuse = diffuseIntensity * max(0.0, dot(N, -L));
              float specularFalloff = clamp((transition3 - h) / transition3, 0.0, 1.0);
              float specular = max(0.0, specularFalloff * specularIntensity * pow(dot(V, R), shininess));
              float light = ambientIntensity + diffuse + specular;

              vec3 color12 = mix(
                color1, 
                color2, 
                smoothstep(transition2 - blend12, transition2 + blend12, h));

              vec3 color123 = mix(
                color12, 
                color3, 
                smoothstep(transition3 - blend23, transition3 + blend23, h));

              vec3 color1234 = mix(
                color123, 
                color4, 
                smoothstep(transition4 - blend34, transition4 + blend34, h));

              vec3 finalColor = mix(
                color1234, 
                color5, 
                smoothstep(transition5 - blend45, transition5 + blend45, h));

              // Blend with atmosphere color at distance
              vec3 atmosphereColor = vec3(0.6, 0.8, 1.0);
              vec3 blendedColor = mix(finalColor, atmosphereColor, vAtmosphereBlend);
              
              gl_FragColor = vec4(light * blendedColor * lightColor, 1.0);
            }
          `}
          uniforms={planetParams}
        />
      </mesh>
      <UltraGlobeAtmosphere
        radius={radius}
        atmosphereDensity={atmosphereThickness}
        sunPosition={lightDir}
        hasRings={hasRings}
        cloudCoverage={0.5}
        cloudDensity={0.5}
        windSpeed={0.2}
        weatherChangeSpeed={0.05}
        ringsColor={ringsColor}
        atmosphereColor={atmosphereColor}
      />
    </>
  );
};
