import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const sunVertexShader = `
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    vPosition = normalize(position);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const sunFragmentShader = `
uniform float iTime;
uniform vec3 sunColor;
varying vec3 vPosition;
varying vec3 vNormal;

// Improved noise function for spherical surfaces
float hash(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
}

float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float n = mix(
        mix(
            mix(hash(i), hash(i + vec3(1,0,0)), f.x),
            mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x),
            f.y
        ),
        mix(
            mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
            mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x),
            f.y
        ),
        f.z
    );
    return n;
}

float fbm(vec3 p) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    
    for(int i = 0; i < 6; i++) {
        sum += noise(p * freq) * amp;
        amp *= 0.5;
        freq *= 2.0;
        p = p * 1.07 + vec3(0.2);
    }
    
    return sum;
}

void main() {
    vec3 p = vPosition;
    
    // Rotate the noise pattern over time
    float angle = iTime * 0.1;
    mat3 rot = mat3(
        cos(angle), 0.0, sin(angle),
        0.0, 1.0, 0.0,
        -sin(angle), 0.0, cos(angle)
    );
    p = rot * p;
    
    // Generate seamless noise pattern
    float f = fbm(p * 4.0);
    f = smoothstep(0.0, 1.0, f);
    
    // Use sunColor uniform instead of hardcoded values
    vec3 baseColor = sunColor;
    vec3 brightColor = sunColor * vec3(1.1, 1.1, 1.0);
    vec3 darkColor = sunColor * vec3(0.8, 0.8, 0.7);
    
    // Mix colors based on noise
    vec3 col = mix(darkColor, brightColor, f);
    
    // Add plasma-like effect
    float plasma = fbm(p * 8.0 + iTime * 0.2);
    col += vec3(0.2, 0.1, 0.05) * smoothstep(0.4, 0.6, plasma);
    
    // Add edge glow
    float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
    col += vec3(0.8, 0.4, 0.1) * fresnel;
    
    // Add bright spots
    float spots = fbm(p * 12.0 + iTime * 0.1);
    col += vec3(1.0, 0.8, 0.4) * smoothstep(0.7, 0.9, spots) * 0.5;
    
    // Add pulsing effect
    float pulse = sin(iTime * 2.0) * 0.5 + 0.5;
    col *= 1.0 + pulse * 0.1;
    
    // Gamma correction
    col = pow(col, vec3(0.8));
    
    gl_FragColor = vec4(col, 1.0);
}`;

interface ProceduralSunProps {
  radius?: number;
  sunColor: THREE.Color;
}

export const ProceduralSun = ({
  sunColor,
  radius = 100,
}: ProceduralSunProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (meshRef.current?.material instanceof THREE.ShaderMaterial) {
      meshRef.current.material.uniforms.iTime.value = timeRef.current;
    }
  });

  const sunParams = {
    sunColor: { value: sunColor },
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(1024, 1024) },
  };

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial
        vertexShader={sunVertexShader}
        fragmentShader={sunFragmentShader}
        uniforms={sunParams}
        transparent={true}
      />
    </mesh>
  );
};
