import { Player } from "../entities/Player";
import { Projectile } from "../entities/Projectile";

export interface IGameStateRepository {
  // Player management
  addPlayer(player: Player): void;
  removePlayer(playerId: string): void;
  getPlayer(playerId: string): Player | undefined;
  getAllPlayers(): Player[];

  // Projectile management
  addProjectile(projectile: Projectile): void;
  removeProjectile(projectileId: string): void;
  getAllProjectiles(): Projectile[];

  // Game state
  getGameState(): {
    players: Player[];
    projectiles: Projectile[];
  };
}
