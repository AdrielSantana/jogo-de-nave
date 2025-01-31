import { Vector3 } from "three";
import { Spaceship } from "../entities/Spaceship";

export interface CelestialBody {
  position: Vector3;
  radius: number;
  type: "sun" | "planet";
}

// Collision detection between ship and spherical body
export function detectCollision(ship: Spaceship, body: CelestialBody): boolean {
  const distance = ship.position.distanceTo(body.position);
  const minDistance = body.radius + 2; // 2 units for ship hitbox radius
  return distance < minDistance;
}

// Calculate collision response
export function handleCollision(
  ship: Spaceship,
  body: CelestialBody,
  velocity: Vector3
): { newVelocity: Vector3; damage: number } {
  // Calculate collision normal
  const normal = new Vector3()
    .subVectors(ship.position, body.position)
    .normalize();

  // Reflect velocity with some energy loss
  const restitution = 0.5; // Bounce factor
  const reflectedVelocity = velocity
    .clone()
    .reflect(normal)
    .multiplyScalar(restitution);

  // Calculate damage based on impact velocity and body type
  const impactSpeed = Math.abs(velocity.dot(normal));
  let damage = 0;

  if (body.type === "sun") {
    // Sun causes more damage
    damage = 50 + impactSpeed * 10;
  } else {
    // Planets cause damage based on impact speed
    damage = Math.max(0, impactSpeed * 5 - 0.2);
  }

  return {
    newVelocity: reflectedVelocity,
    damage: damage,
  };
}
