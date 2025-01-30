import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const sunVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
    vUv = uv;
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const sunFragmentShader = `
uniform float iTime;
uniform vec2 iResolution;
varying vec2 vUv;

#define AA 1

float hash(vec2 p) {
    p = fract(p * 0.6180339887);
    p *= 25.0;
    return fract(p.x * p.y * (p.x + p.y));
}

float noise(in vec2 x) {
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(p + vec2(0, 0));
    float b = hash(p + vec2(1, 0));
    float c = hash(p + vec2(0, 1));
    float d = hash(p + vec2(1, 1));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

const mat2 mtx = mat2(0.80, 0.60, -0.60, 0.80);

float fbm4(vec2 p) {
    float f = 0.0;
    f += 0.5000 * (-1.0 + 2.0 * noise(p)); p = mtx * p * 2.02;
    f += 0.2500 * (-1.0 + 2.0 * noise(p)); p = mtx * p * 2.03;
    f += 0.1250 * (-1.0 + 2.0 * noise(p)); p = mtx * p * 2.01;
    f += 0.0625 * (-1.0 + 2.0 * noise(p));
    return f / 0.9375;
}

float fbm6(vec2 p) {
    float f = 0.0;
    f += 0.500000 * noise(p); p = mtx * p * 2.02;
    f += 0.250000 * noise(p); p = mtx * p * 2.03;
    f += 0.125000 * noise(p); p = mtx * p * 2.01;
    f += 0.062500 * noise(p); p = mtx * p * 2.04;
    f += 0.031250 * noise(p); p = mtx * p * 2.01;
    f += 0.015625 * noise(p);
    return f / 0.96875;
}

vec2 fbm4_2(vec2 p) {
    return vec2(fbm4(p + vec2(1.0)), fbm4(p + vec2(6.2)));
}

vec2 fbm6_2(vec2 p) {
    return vec2(fbm6(p + vec2(9.2)), fbm6(p + vec2(5.7)));
}

float func(vec2 q, out vec2 o, out vec2 n) {
    q += 0.05 * sin(vec2(0.11, 0.13) * iTime + length(q) * 4.0);
    q *= 0.7 + 0.2 * cos(0.05 * iTime);

    o = 0.5 + 0.5 * fbm4_2(q);
    o += 0.02 * sin(vec2(0.13, 0.11) * iTime * length(o));
    n = fbm6_2(4.0 * o);

    vec2 p = q + 2.0 * n + 1.0;
    float f = 0.5 + 0.5 * fbm4(2.0 * p);
    f = mix(f, f * f * f * 3.5, f * abs(n.x));
    f *= 1.0 - 0.5 * pow(0.5 + 0.5 * sin(8.0 * p.x) * sin(8.0 * p.y), 8.0);

    return f;
}

float funcs(in vec2 q) {
    vec2 t1, t2;
    return func(q, t1, t2);
}

void main() {
    vec3 tot = vec3(0.0);
    vec2 q = (2.0 * vUv - 1.0) * 2.0;

    vec2 o, n;
    float f = func(q, o, n);
    
    vec3 col = vec3(0.9, 0.4, 0.1); // Warmer sun color
    col = mix(col, vec3(0.9, 0.6, 0.2), f);
    col = mix(col, vec3(1.0, 0.9, 0.6), dot(n, n));
    col = mix(col, vec3(1.0, 0.7, 0.3), 0.5 * o.y * o.y);
    col = mix(col, vec3(0.9, 0.4, 0.1), 0.5 * smoothstep(1.2, 1.3, abs(n.y) + abs(n.x)));
    col *= f * 2.0;

    vec2 ex = vec2(1.0 / iResolution.x, 0.0);
    vec2 ey = vec2(0.0, 1.0 / iResolution.y);
    vec3 nor = normalize(vec3(funcs(q + ex) - f, ex.x, funcs(q + ey) - f));
    
    vec3 lig = normalize(vec3(0.9, -0.2, -0.4));
    float dif = clamp(0.3 + 0.7 * dot(nor, lig), 0.0, 1.0);

    vec3 lin = vec3(0.95, 0.90, 0.85) * (nor.y * 0.5 + 0.5);
    lin += vec3(0.15, 0.10, 0.05) * dif;

    col *= lin;
    col = vec3(1.2) - col;
    col = col * col;
    col *= vec3(1.4, 1.3, 1.2);
    
    tot += col;

    // Add glow effect
    float dist = length(q);
    float glow = 1.0 - smoothstep(0.8, 2.0, dist);
    tot += vec3(0.8, 0.4, 0.1) * glow * 0.5;
    
    gl_FragColor = vec4(tot, 1.0);
}`;

interface ProceduralSunProps {
  radius?: number;
  position?: [number, number, number];
}

export const ProceduralSun = ({
  radius = 100,
  position = [0, 0, 0],
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
    iTime: { value: 0 },
    iResolution: { value: new THREE.Vector2(1024, 1024) },
  };

  return (
    <mesh ref={meshRef} position={position}>
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
