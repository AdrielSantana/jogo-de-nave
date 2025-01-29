import { IGameStateRepository } from "../../domain/repositories/IGameStateRepository";
import { Player } from "../../domain/entities/Player";
import { Projectile } from "../../domain/entities/Projectile";
import {
  Vector3,
  Quaternion,
  PhysicsUtils,
} from "../../domain/valueObjects/Physics";
import { PlayerInput } from "../../domain/valueObjects/PlayerInput";
import { GameConstants } from "../../domain/shared/GameConstants";

export class GameService {
  private readonly gameState: IGameStateRepository;
  private lastUpdate: number;

  constructor(gameState: IGameStateRepository) {
    this.gameState = gameState;
    this.lastUpdate = Date.now();
  }

  public addPlayer(playerId: string, name: string): void {
    const player = new Player(playerId, name);
    this.gameState.addPlayer(player);
  }

  public removePlayer(playerId: string): void {
    this.gameState.removePlayer(playerId);
  }

  public handlePlayerInput(playerId: string, input: PlayerInput): void {
    const player = this.gameState.getPlayer(playerId);
    if (!player || !player.isAlive) return;

    player.updateInput(input);

    // Handle shooting
    if (
      input.shoot &&
      Date.now() - player.lastShootTime > GameConstants.SHOOT_COOLDOWN
    ) {
      this.createProjectile(player);
      player.updateLastShootTime(Date.now());
    }
  }

  public handlePlayerRotation(
    playerId: string,
    rotation: { x: number; y: number }
  ): void {
    const player = this.gameState.getPlayer(playerId);
    if (!player || !player.isAlive) return;

    player.updateTargetRotation(rotation);
  }

  public update(): void {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds

    this.updatePlayers(deltaTime);
    this.updateProjectiles(deltaTime);
    this.checkCollisions();

    this.lastUpdate = now;
  }

  private updatePlayers(deltaTime: number): void {
    for (const player of this.gameState.getAllPlayers()) {
      if (!player.isAlive) {
        player.decreaseRespawnTime(deltaTime);
        continue;
      }

      this.updatePlayerPhysics(player, deltaTime);
    }
  }

  private updatePlayerPhysics(player: Player, deltaTime: number): void {
    // Update rotation based on target rotation
    const rotation = player.targetRotation;
    const currentQuat = player.quaternion;

    // Apply yaw (y-axis rotation)
    const yawQuat = {
      x: 0,
      y: Math.sin(rotation.y * GameConstants.TURN_SPEED * deltaTime * 0.5),
      z: 0,
      w: Math.cos(rotation.y * GameConstants.TURN_SPEED * deltaTime * 0.5),
    };

    // Apply pitch (x-axis rotation)
    const pitchQuat = {
      x: Math.sin(rotation.x * GameConstants.TURN_SPEED * deltaTime * 0.5),
      y: 0,
      z: 0,
      w: Math.cos(rotation.x * GameConstants.TURN_SPEED * deltaTime * 0.5),
    };

    // Combine rotations
    const newQuat = PhysicsUtils.multiplyQuaternions(
      PhysicsUtils.multiplyQuaternions(pitchQuat, currentQuat),
      yawQuat
    );
    player.updateQuaternion(PhysicsUtils.normalizeQuaternion(newQuat));

    // Update velocity and position
    if (player.input.accelerate) {
      const forward = PhysicsUtils.rotateVectorByQuaternion(
        { x: -1, y: 0, z: 0 },
        player.quaternion
      );

      const acceleration = GameConstants.ACCELERATION_RATE * deltaTime;
      const newVelocity = {
        x: player.velocity.x + forward.x * acceleration,
        y: player.velocity.y + forward.y * acceleration,
        z: player.velocity.z + forward.z * acceleration,
      };

      // Apply speed limit
      const speed = Math.sqrt(
        newVelocity.x * newVelocity.x +
          newVelocity.y * newVelocity.y +
          newVelocity.z * newVelocity.z
      );

      if (speed > GameConstants.MAX_VELOCITY) {
        const scale = GameConstants.MAX_VELOCITY / speed;
        newVelocity.x *= scale;
        newVelocity.y *= scale;
        newVelocity.z *= scale;
      }

      player.updateVelocity(newVelocity);
    }

    // Apply drag
    player.updateVelocity({
      x: player.velocity.x * GameConstants.DRAG_COEFFICIENT,
      y: player.velocity.y * GameConstants.DRAG_COEFFICIENT,
      z: player.velocity.z * GameConstants.DRAG_COEFFICIENT,
    });

    // Update position
    player.updatePosition({
      x: player.position.x + player.velocity.x * deltaTime,
      y: player.position.y + player.velocity.y * deltaTime,
      z: player.position.z + player.velocity.z * deltaTime,
    });

    // Update speed
    player.updateSpeed(
      Math.sqrt(
        player.velocity.x * player.velocity.x +
          player.velocity.y * player.velocity.y +
          player.velocity.z * player.velocity.z
      )
    );
  }

  private updateProjectiles(deltaTime: number): void {
    const projectiles = this.gameState.getAllProjectiles();
    for (const projectile of projectiles) {
      const isAlive = projectile.update(deltaTime);
      if (!isAlive) {
        this.gameState.removeProjectile(projectile.id);
      }
    }
  }

  private checkCollisions(): void {
    this.checkProjectileCollisions();
    this.checkPlayerCollisions();
  }

  private checkProjectileCollisions(): void {
    const players = this.gameState.getAllPlayers();
    const projectiles = this.gameState.getAllProjectiles();
    const collisionRadius = 2; // Adjust based on your needs

    for (const projectile of projectiles) {
      for (const player of players) {
        if (!player.isAlive || projectile.playerId === player.id) continue;

        if (
          this.checkCollision(
            projectile.position,
            player.position,
            collisionRadius
          )
        ) {
          const isDead = player.damage(GameConstants.PROJECTILE_DAMAGE);
          if (isDead) {
            const shooter = this.gameState.getPlayer(projectile.playerId);
            if (shooter) {
              shooter.addScore(1);
            }
          }
          this.gameState.removeProjectile(projectile.id);
          break;
        }
      }
    }
  }

  private checkPlayerCollisions(): void {
    const players = this.gameState.getAllPlayers();
    const collisionRadius = 3; // Adjust based on your needs

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i];
        const player2 = players[j];

        if (!player1.isAlive || !player2.isAlive) continue;

        if (
          this.checkCollision(
            player1.position,
            player2.position,
            collisionRadius
          )
        ) {
          player1.damage(GameConstants.COLLISION_DAMAGE);
          player2.damage(GameConstants.COLLISION_DAMAGE);
        }
      }
    }
  }

  private checkCollision(
    pos1: Vector3,
    pos2: Vector3,
    radius: number
  ): boolean {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance < radius * 2;
  }

  private createProjectile(player: Player): void {
    const projectile = new Projectile(
      player.id,
      player.position,
      player.quaternion
    );
    this.gameState.addProjectile(projectile);
  }

  public getGameState() {
    return this.gameState.getGameState();
  }
}
