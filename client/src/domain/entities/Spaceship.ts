import { Vector3, Quaternion } from "three";

export interface SpaceshipProps {
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  health: number;
  id: string;
}

export class Spaceship {
  position: Vector3;
  rotation: Quaternion;
  velocity: Vector3;
  health: number;
  id: string;

  constructor({ position, rotation, velocity, health, id }: SpaceshipProps) {
    this.position = position;
    this.rotation = rotation;
    this.velocity = velocity;
    this.health = health;
    this.id = id;
  }

  update(deltaTime: number) {
    this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
  }

  applyForce(force: Vector3) {
    this.velocity.add(force);
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount);
  }

  isDestroyed(): boolean {
    return this.health <= 0;
  }
}
