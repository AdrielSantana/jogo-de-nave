import { Entity } from "../shared/Entity";
import { Vector3, Quaternion, PhysicsUtils } from "../valueObjects/Physics";
import { GameConstants } from "../shared/GameConstants";

export class Projectile extends Entity {
  private readonly _playerId: string;
  private _position: Vector3;
  private _velocity: Vector3;
  private _lifetime: number;

  constructor(playerId: string, position: Vector3, quaternion: Quaternion) {
    super(Date.now().toString() + Math.random());
    this._playerId = playerId;
    this._position = { ...position };
    this._lifetime = GameConstants.PROJECTILE_LIFETIME;

    // Calculate velocity based on quaternion direction
    const forward = PhysicsUtils.rotateVectorByQuaternion(
      { x: -1, y: 0, z: 0 },
      quaternion
    );

    this._velocity = {
      x: forward.x * GameConstants.PROJECTILE_SPEED,
      y: forward.y * GameConstants.PROJECTILE_SPEED,
      z: forward.z * GameConstants.PROJECTILE_SPEED,
    };
  }

  // Getters
  get playerId(): string {
    return this._playerId;
  }
  get position(): Vector3 {
    return this._position;
  }
  get velocity(): Vector3 {
    return this._velocity;
  }
  get lifetime(): number {
    return this._lifetime;
  }

  // Domain methods
  public update(deltaTime: number): boolean {
    this._position = {
      x: this._position.x + this._velocity.x * deltaTime,
      y: this._position.y + this._velocity.y * deltaTime,
      z: this._position.z + this._velocity.z * deltaTime,
    };

    this._lifetime -= deltaTime;
    return this._lifetime > 0;
  }
}
