import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const glowVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    vUv = uv;
    vPosition = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const glowFragmentShader = `
uniform float iTime;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    // Calculate view-space normal
    vec3 normal = normalize(vNormal);
    
    // Calculate fresnel effect
    vec3 viewDirection = normalize(cameraPosition - vPosition);
    float fresnel = 1.0 - max(dot(viewDirection, normal), 0.0);
    fresnel = pow(fresnel, 3.0);
    
    // Create pulsing effect
    float pulse = sin(iTime * 0.5) * 0.05 + 0.95;
    
    // Add some noise to the glow
    float noise = fract(sin(dot(vUv, vec2(12.9898, 78.233)) * 43758.5453123 + iTime));
    fresnel *= 0.98 + noise * 0.02;
    
    // Color gradient from center to edge
    vec3 color = mix(
        vec3(1.0, 0.6, 0.2),  // Core color (more yellow)
        vec3(1.0, 0.3, 0.1),  // Edge color (more red)
        fresnel
    );
    
    // Fade out at the edges
    float alpha = fresnel * pulse * 0.3;
    
    gl_FragColor = vec4(color, alpha);
}`;

interface SunGlowProps {
  radius?: number;
  position?: [number, number, number];
}

export const SunGlow = ({
  radius = 150,
  position = [0, 0, 0],
}: SunGlowProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (meshRef.current?.material instanceof THREE.ShaderMaterial) {
      meshRef.current.material.uniforms.iTime.value = timeRef.current;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[radius * 1.15, 64, 64]} />
      <shaderMaterial
        vertexShader={glowVertexShader}
        fragmentShader={glowFragmentShader}
        uniforms={{
          iTime: { value: 0 },
        }}
        transparent={true}
        depthWrite={false}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
};
