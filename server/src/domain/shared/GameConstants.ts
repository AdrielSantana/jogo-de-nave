export class GameConstants {
  // Game loop
  static readonly FPS = 120;
  static readonly FRAME_TIME = 1000 / GameConstants.FPS;

  // Movement
  static readonly MOVEMENT_SPEED = 15;
  static readonly MAX_VELOCITY = 30;
  static readonly DRAG_COEFFICIENT = 0.995;
  static readonly ACCELERATION_RATE = 1.5;
  static readonly TURN_SPEED = 2.0;
  static readonly ROLL_SPEED = 3.0;

  // Combat
  static readonly PROJECTILE_SPEED = 50;
  static readonly PROJECTILE_LIFETIME = 2; // seconds
  static readonly PROJECTILE_DAMAGE = 25;
  static readonly COLLISION_DAMAGE = 50;

  // Player
  static readonly RESPAWN_TIME = 3; // seconds
  static readonly INITIAL_HEALTH = 100;
  static readonly SHOOT_COOLDOWN = 250; // milliseconds

  // World
  static readonly SPAWN_AREA_SIZE = 100;
  static readonly WORLD_BOUNDS = {
    min: { x: -500, y: -500, z: -500 },
    max: { x: 500, y: 500, z: 500 },
  };
}
