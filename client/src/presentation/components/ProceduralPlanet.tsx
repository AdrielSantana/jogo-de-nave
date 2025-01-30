import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Atmosphere } from "./Atmosphere";

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

const planetVertexShader = `
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

varying vec3 fragPosition;
varying vec3 fragNormal;
varying vec3 fragTangent;
varying vec3 fragBitangent;

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
}`;

const planetFragmentShader = `
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

varying vec3 fragPosition;
varying vec3 fragNormal;
varying vec3 fragTangent;
varying vec3 fragBitangent;

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
  
  gl_FragColor = vec4(light * finalColor * lightColor, 1.0);
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
}

export const ProceduralPlanet = ({
  radius = 100.0,
  amplitude = 2.5,
  colors = {
    color1: new THREE.Color(0.014, 0.117, 0.279),
    color2: new THREE.Color(0.08, 0.527, 0.351),
    color3: new THREE.Color(0.62, 0.516, 0.372),
    color4: new THREE.Color(0.149, 0.254, 0.084),
    color5: new THREE.Color(0.15, 0.15, 0.15),
  },
}: ProceduralPlanetProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const worldPosition = new THREE.Vector3();

  // LOD configuration for geometry detail
  const lodLevels = useMemo(
    () => [
      { distance: 200, segments: 128, bumpStrength: 0.8, amplitude: amplitude }, // Very close
      {
        distance: 400,
        segments: 64,
        bumpStrength: 0.6,
        amplitude: amplitude * 0.9,
      }, // Close
      {
        distance: 800,
        segments: 32,
        bumpStrength: 0.4,
        amplitude: amplitude * 0.8,
      }, // Medium
      {
        distance: 1600,
        segments: 16,
        bumpStrength: 0.2,
        amplitude: amplitude * 0.7,
      }, // Far
      {
        distance: Infinity,
        segments: 8,
        bumpStrength: 0.1,
        amplitude: amplitude * 0.6,
      }, // Very far
    ],
    [amplitude]
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

  const lightDir = useMemo(() => new THREE.Vector3(-1, -1, -1).normalize(), []);

  const planetParams = useMemo(
    () => ({
      type: { value: 2 },
      radius: { value: radius },
      amplitude: { value: amplitude },
      sharpness: { value: 2.0 },
      offset: { value: -0.016 },
      period: { value: 0.8 },
      persistence: { value: 0.4 },
      lacunarity: { value: 1.8 },
      octaves: { value: 10 },
      ambientIntensity: { value: 0.02 },
      diffuseIntensity: { value: 1.0 },
      specularIntensity: { value: 2.0 },
      shininess: { value: 10.0 },
      lightDirection: { value: lightDir },
      lightColor: { value: new THREE.Color(1, 1, 1) },
      bumpStrength: { value: 0.8 },
      bumpOffset: { value: 0.001 },
      color1: { value: colors.color1 },
      color2: { value: colors.color2 },
      color3: { value: colors.color3 },
      color4: { value: colors.color4 },
      color5: { value: colors.color5 },
      transition2: { value: 0.071 },
      transition3: { value: 0.215 },
      transition4: { value: 0.372 },
      transition5: { value: 1.2 },
      blend12: { value: 0.152 },
      blend23: { value: 0.152 },
      blend34: { value: 0.104 },
      blend45: { value: 0.168 },
      atmosphereBlend: { value: 0.0 }, // New parameter for atmosphere blend
    }),
    [radius, amplitude, colors, lightDir]
  );

  useFrame((state) => {
    if (meshRef.current) {
      // Get world position and calculate distance
      meshRef.current.getWorldPosition(worldPosition);
      const distance = state.camera.position.distanceTo(worldPosition);

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
          Math.min(1, (distance - lodLevels[0].distance) / maxDistance)
        );
        planetParams.atmosphereBlend.value = blend;

        console.log(
          `Planet LOD: ${newLOD}, Segments: ${
            lodLevels[newLOD].segments
          }, Blend: ${blend.toFixed(2)}`
        );
      }
    }
  });

  return (
    <group>
      <mesh ref={meshRef} geometry={lodGeometries[0]}>
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
      <Atmosphere planetRadius={radius} atmosphereThickness={radius * 0.05} />
    </group>
  );
};
