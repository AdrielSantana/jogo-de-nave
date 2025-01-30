import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const atmosphereVertexShader = `
attribute float size;
varying vec3 fragPosition;
varying vec2 vUv;
varying float vRandom;
uniform float time;

// Hash function for random values
float hash(vec3 p) {
  p = fract(p * vec3(443.8975,397.2973, 491.1871));
  p += dot(p.xyz, p.yzx + 19.19);
  return fract(p.x * p.y * p.z);
}

void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  
  // Generate a unique random value for this vertex
  vRandom = hash(position);
  
  // Vary point size based on random value and distance
  float sizeVariation = 0.8 + 0.4 * vRandom;
  gl_PointSize = size * sizeVariation * (300.0 / length(mvPosition.xyz));
  
  fragPosition = position;
  vUv = vec2(
    atan(position.x, position.z) / (2.0 * 3.14159) + 0.5,
    position.y / length(position)
  );
}
`;

const atmosphereFragmentShader = `
uniform float time;
uniform float speed;
uniform float opacity;
uniform float density;
uniform float scale;
uniform vec3 lightDirection;
uniform vec3 color;
uniform sampler2D pointTexture;

varying vec3 fragPosition;
varying vec2 vUv;
varying float vRandom;

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

vec2 rotateUV(vec2 uv, float rotation) {
    float mid = 0.5;
    return vec2(
        cos(rotation) * (uv.x - mid) + sin(rotation) * (uv.y - mid) + mid,
        cos(rotation) * (uv.y - mid) - sin(rotation) * (uv.x - mid) + mid
    );
}

// Rotation matrix for sprite variation
mat2 rotate2d(float angle) {
  float s = sin(angle);
  float c = cos(angle);
  return mat2(c, -s, s, c);
}

void main() {
  vec3 R = normalize(fragPosition);
  vec3 L = normalize(lightDirection);
  float light = max(0.05, dot(R, L));

  // Create multiple layers of movement
  float flowSpeed1 = time * speed * 0.3;
  float flowSpeed2 = time * speed * 0.7;
  
  // Layer 1: Base rotation
  vec2 rotatedUv = vec2(
    vUv.x + flowSpeed1,
    vUv.y
  );

  // Layer 2: Wavy movement
  vec2 wavyUv = rotatedUv + vec2(
    sin(vUv.y * 4.0 + time * speed) * 0.02,
    cos(vUv.x * 4.0 + time * speed) * 0.02
  );

  // Generate noise for cloud patterns
  float noise1 = simplex3(vec3(wavyUv * scale, time * speed * 0.5));
  float noise2 = simplex3(vec3(wavyUv * scale * 2.0 + 10.0, time * speed * 0.3));
  
  // Combine noise layers
  float cloudPattern = noise1 * 0.7 + noise2 * 0.3;
  
  // Add some turbulence
  float turbulence = sin(time * speed + vUv.x * 10.0) * 0.1;
  cloudPattern += turbulence;

  // Rotate and scale UV coordinates for sprite variation
  vec2 centeredUv = gl_PointCoord - 0.5;
  float rotation = vRandom * 2.0 * 3.14159 + time * speed * (0.5 + vRandom * 0.5);
  vec2 rotatedSprite = rotate2d(rotation) * centeredUv;
  
  // Add some distortion to the sprite
  float distortion = simplex3(vec3(rotatedSprite * 3.0, time * speed)) * 0.1;
  rotatedSprite += vec2(distortion);
  
  // Scale variation
  float scale = 0.8 + 0.4 * vRandom;
  rotatedSprite /= scale;
  
  // Convert back to texture coordinates
  vec2 finalUv = rotatedSprite + 0.5;
  
  // Sample texture with variation
  vec4 texColor = texture2D(pointTexture, finalUv);
  
  // Add some color variation
  vec3 variedColor = color * (0.8 + 0.4 * vRandom);
  
  float alpha = opacity * clamp(cloudPattern + density, 0.0, 1.0);
  
  // Fade edges based on distance from center
  float edgeFade = 1.0 - smoothstep(0.4, 0.5, length(centeredUv));
  
  // Final color with all variations
  gl_FragColor = vec4(light * variedColor, alpha * texColor.a * edgeFade);
  
  // Discard pixels outside the circle
  if (length(centeredUv) > 0.5) discard;
}
`;

interface AtmosphereProps {
  planetRadius?: number;
  atmosphereThickness?: number;
  atmosphereColor?: THREE.Color;
}

export const Atmosphere = ({
  planetRadius = 200,
  atmosphereThickness = 15,
  atmosphereColor = new THREE.Color(0.6, 0.8, 1.0),
}: AtmosphereProps) => {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const cloudTexture = new THREE.TextureLoader().load("/cloud.png");
  const lightDir = useMemo(() => new THREE.Vector3(-1, -1, -1).normalize(), []);

  // LOD configuration
  const lodConfig = useMemo(
    () => ({
      minDistance: planetRadius * 1.0, // Start transitioning at 1x radius
      maxDistance: planetRadius * 8.0, // Full transition by 8x radius
      minParticles: Math.floor(1500 * (planetRadius / 100)), // Scale particles with radius
      maxParticles: Math.floor(3000 * (planetRadius / 100)), // Scale particles with radius
      minSize: planetRadius * 0.25, // 20% of radius
      maxSize: planetRadius * 1.5, // 40% of radius
      levels: 20,
    }),
    [planetRadius]
  );

  // Generate LOD levels dynamically
  const lodLevels = useMemo(() => {
    const levels = [];
    for (let i = 0; i < lodConfig.levels; i++) {
      const t = i / (lodConfig.levels - 1); // 0 to 1

      // Exponential interpolation for smoother transitions
      const exp = 2; // Adjust this value to change the distribution curve
      const tExp = Math.pow(t, exp);

      // Calculate distance with exponential distribution
      const distance =
        lodConfig.minDistance +
        (lodConfig.maxDistance - lodConfig.minDistance) * t;

      // Calculate particles with inverse exponential distribution (more particles when closer)
      const particles = Math.round(
        lodConfig.maxParticles -
          (lodConfig.maxParticles - lodConfig.minParticles) * tExp
      );

      // Calculate sizes with linear interpolation
      const minSize =
        lodConfig.minSize + (lodConfig.maxSize - lodConfig.minSize) * t * 0.5;
      const maxSize = minSize * 2;

      levels.push({
        distance,
        particles,
        minSize,
        maxSize,
      });
    }
    return levels;
  }, [lodConfig]);

  // Create geometries for each LOD level
  const lodGeometries = useMemo(() => {
    // Generate base points on a sphere using fibonacci spiral
    const generatePoints = (count: number) => {
      const points: [number, number][] = [];
      const goldenRatio = (1 + Math.sqrt(5)) / 2;

      for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2; // -1 to 1

        const theta = (2 * Math.PI * i) / goldenRatio; // golden angle increment

        points.push([Math.acos(y), theta]); // Store spherical coordinates
      }
      return points;
    };

    // Generate maximum number of points needed
    const maxPoints = generatePoints(lodLevels[0].particles);

    return lodLevels.map((level) => {
      const positions = new Float32Array(level.particles * 3);
      const sizes = new Float32Array(level.particles);

      // Use subset of base points for this LOD level
      for (let i = 0; i < level.particles; i++) {
        // Get evenly spaced points from the base set
        const index = Math.floor(i * (maxPoints.length / level.particles));
        const [phi, theta] = maxPoints[index];

        const radius = planetRadius + atmosphereThickness;

        // Convert spherical to cartesian coordinates
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.cos(phi);
        positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

        // Make size deterministic but varied
        const sizeVariation =
          Math.sin(theta * 5) * Math.cos(phi * 3) * 0.5 + 0.5;
        sizes[i] =
          level.minSize + (level.maxSize - level.minSize) * sizeVariation;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );
      geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
      return geometry;
    });
  }, [planetRadius, atmosphereThickness, lodLevels]);

  // Current LOD level
  const currentLOD = useRef(0);
  const worldPosition = new THREE.Vector3();

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = state.clock.getElapsedTime();
    }

    if (pointsRef.current) {
      // Get the world position of the atmosphere
      pointsRef.current.getWorldPosition(worldPosition);

      // Calculate distance from camera to atmosphere's world position
      const distance =
        (state.camera.parent?.position.distanceTo(worldPosition) ||
          planetRadius) - planetRadius;

      // Determine appropriate LOD level
      let newLOD = lodLevels.findIndex((level) => distance < level.distance);
      if (newLOD === -1) newLOD = lodLevels.length - 1;

      // Update geometry if LOD level changed
      if (newLOD !== currentLOD.current) {
        pointsRef.current.geometry.dispose();
        pointsRef.current.geometry = lodGeometries[newLOD];
        currentLOD.current = newLOD;
      }

      // Fade particles based on distance
      if (materialRef.current) {
        const fadeStart = lodLevels[0].distance;
        const fadeEnd = lodLevels[lodLevels.length - 2].distance;
        const opacity = Math.max(
          0.1,
          Math.min(1, 1 - (distance - fadeStart) / (fadeEnd - fadeStart))
        );
        materialRef.current.uniforms.opacity.value = opacity;
      }
    }
  });

  return (
    <points ref={pointsRef}>
      <primitive object={lodGeometries[0]} attach="geometry" />
      <shaderMaterial
        ref={materialRef}
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        transparent
        depthWrite={false}
        uniforms={{
          time: { value: 0 },
          speed: { value: 0.05 }, // Reduced from 0.1 for slower movement
          opacity: { value: 0.35 },
          density: { value: 0.2 },
          scale: { value: 4.0 }, // Reduced for gentler pattern changes
          color: { value: atmosphereColor },
          lightDirection: { value: lightDir },
          pointTexture: { value: cloudTexture },
        }}
      />
    </points>
  );
};
