import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Spaceship } from "../../domain/entities/Spaceship";
import { Mesh } from "three";

interface PlayerShipProps {
  player: Spaceship;
}

export const PlayerShip = ({ player }: PlayerShipProps) => {
  const meshRef = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.copy(player.position);
      meshRef.current.quaternion.copy(player.rotation);
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 0.5, 2]} />
      <meshStandardMaterial color="blue" />
    </mesh>
  );
};
