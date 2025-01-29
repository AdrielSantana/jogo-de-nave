import { Vector3, Quaternion } from "../valueObjects/Physics";
import { Entity } from "../shared/Entity";
import { PlayerInput } from "../valueObjects/PlayerInput";

export class Player extends Entity {
  private readonly _name: string;
  private _position: Vector3;
  private _quaternion: Quaternion;
  private _velocity: Vector3;
  private _speed: number;
  private _health: number;
  private _score: number;
  private _isAlive: boolean;
  private _respawnTime: number;
  private _targetRotation: { x: number; y: number };
  private _input: PlayerInput;
  private _lastShootTime: number;

  constructor(id: string, name: string = "Player") {
    super(id);
    this._name = name;
    this._position = this.getRandomSpawnPosition();
    this._quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this._velocity = { x: 0, y: 0, z: 0 };
    this._speed = 0;
    this._health = 100;
    this._score = 0;
    this._isAlive = true;
    this._respawnTime = 0;
    this._targetRotation = { x: 0, y: 0 };
    this._input = {
      rollLeft: false,
      rollRight: false,
      accelerate: false,
      shoot: false,
    };
    this._lastShootTime = 0;
  }

  // Getters
  get name(): string {
    return this._name;
  }
  get position(): Vector3 {
    return this._position;
  }
  get quaternion(): Quaternion {
    return this._quaternion;
  }
  get velocity(): Vector3 {
    return this._velocity;
  }
  get speed(): number {
    return this._speed;
  }
  get health(): number {
    return this._health;
  }
  get score(): number {
    return this._score;
  }
  get isAlive(): boolean {
    return this._isAlive;
  }
  get respawnTime(): number {
    return this._respawnTime;
  }
  get targetRotation(): { x: number; y: number } {
    return this._targetRotation;
  }
  get input(): PlayerInput {
    return this._input;
  }
  get lastShootTime(): number {
    return this._lastShootTime;
  }

  // Domain methods
  private getRandomSpawnPosition(): Vector3 {
    return {
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100,
      z: (Math.random() - 0.5) * 100,
    };
  }

  public respawn(): void {
    this._position = this.getRandomSpawnPosition();
    this._quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this._velocity = { x: 0, y: 0, z: 0 };
    this._speed = 0;
    this._health = 100;
    this._isAlive = true;
    this._respawnTime = 0;
  }

  public damage(amount: number): boolean {
    this._health = Math.max(0, this._health - amount);

    if (this._health <= 0 && this._isAlive) {
      this._isAlive = false;
      this._respawnTime = 3; // Move to constants
      return true;
    }
    return false;
  }

  public updateInput(input: PlayerInput): void {
    this._input = input;
  }

  public updateTargetRotation(rotation: { x: number; y: number }): void {
    this._targetRotation = rotation;
  }

  public updateLastShootTime(time: number): void {
    this._lastShootTime = time;
  }

  public addScore(points: number): void {
    this._score += points;
  }

  public updatePosition(position: Vector3): void {
    this._position = position;
  }

  public updateVelocity(velocity: Vector3): void {
    this._velocity = velocity;
  }

  public updateQuaternion(quaternion: Quaternion): void {
    this._quaternion = quaternion;
  }

  public updateSpeed(speed: number): void {
    this._speed = speed;
  }

  public decreaseRespawnTime(deltaTime: number): void {
    if (!this._isAlive) {
      this._respawnTime = Math.max(0, this._respawnTime - deltaTime);
      if (this._respawnTime === 0) {
        this.respawn();
      }
    }
  }
}
