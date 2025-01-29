import { IGameStateRepository } from "../../domain/repositories/IGameStateRepository";
import { Player } from "../../domain/entities/Player";
import { Projectile } from "../../domain/entities/Projectile";

export class InMemoryGameStateRepository implements IGameStateRepository {
  private players: Map<string, Player>;
  private projectiles: Map<string, Projectile>;

  constructor() {
    this.players = new Map();
    this.projectiles = new Map();
  }

  // Player management
  addPlayer(player: Player): void {
    this.players.set(player.id, player);
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  getPlayer(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }

  // Projectile management
  addProjectile(projectile: Projectile): void {
    this.projectiles.set(projectile.id, projectile);
  }

  removeProjectile(projectileId: string): void {
    this.projectiles.delete(projectileId);
  }

  getAllProjectiles(): Projectile[] {
    return Array.from(this.projectiles.values());
  }

  // Game state
  getGameState(): { players: Player[]; projectiles: Projectile[] } {
    return {
      players: this.getAllPlayers(),
      projectiles: this.getAllProjectiles(),
    };
  }
}
