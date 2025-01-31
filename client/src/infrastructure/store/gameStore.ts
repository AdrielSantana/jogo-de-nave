import { create } from "zustand";
import { Vector3, Quaternion } from "three";
import { Spaceship } from "../../domain/entities/Spaceship";
import * as THREE from "three";

interface GameState {
  player: Spaceship | null;
  enemies: Map<string, Spaceship>;
  score: number;
  isGameOver: boolean;
  initializePlayer: () => void;
  updatePlayer: (deltaTime: number) => void;
  setGameOver: (value: boolean) => void;
  incrementScore: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  player: null,
  enemies: new Map(),
  score: 0,
  isGameOver: false,

  initializePlayer: () => {
    // Start player far from the sun, near the earth-like planet
    const newPlayer = new Spaceship({
      position: new Vector3(800, 200, 800), // Much further out for safety
      rotation: new Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.5, 0)), // Slight angle to see the system
      velocity: new Vector3(0, 0, 0),
      health: 100,
      id: "player",
    });
    set({ player: newPlayer });
  },

  updatePlayer: (deltaTime: number) => {
    const { player } = get();
    if (player) {
      player.update(deltaTime);
      set({ player });
    }
  },

  setGameOver: (value: boolean) => set({ isGameOver: value }),

  incrementScore: () => set((state) => ({ score: state.score + 100 })),
}));
