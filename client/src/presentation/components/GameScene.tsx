import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { useGameStore } from "../../infrastructure/store/gameStore";
import { PlayerShip } from "./PlayerShip";
import { useEffect } from "react";

export const GameScene = () => {
  const { initializePlayer, player } = useGameStore();

  useEffect(() => {
    initializePlayer();
  }, [initializePlayer]);

  return (
    <Canvas style={{ width: "100vw", height: "100vh" }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <Stars />
      <OrbitControls />
      {player && <PlayerShip player={player} />}
    </Canvas>
  );
};
