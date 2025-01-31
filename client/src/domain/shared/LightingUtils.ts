import { Vector3 } from "three";

// Constants for light falloff calculation
const MIN_DISTANCE = 300; // Minimum distance for full intensity
const MAX_DISTANCE = 1200; // Maximum distance where light becomes minimal

// Separate intensity ranges for different object types
export const INTENSITY_RANGES = {
  ship: {
    min: 0.1,
    max: 3.0,
  },
  planet: {
    min: 0.1,
    max: 2.0,
  },
  atmosphere: {
    min: 0.1,
    max: 1.5,
  },
};

export const calculateLightIntensity = (
  objectPosition: Vector3,
  sunPosition: Vector3,
  type: "ship" | "planet" | "atmosphere" = "ship"
): number => {
  const distance = objectPosition.distanceTo(sunPosition);
  const { min, max } = INTENSITY_RANGES[type];

  // If closer than MIN_DISTANCE, return full intensity
  if (distance <= MIN_DISTANCE) return max;

  // If further than MAX_DISTANCE, return minimum intensity
  if (distance >= MAX_DISTANCE) return min;

  // Calculate intensity with inverse square law, but smoothed
  const t = (distance - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE);
  const smoothT = 1 - t; // Linear falloff

  return min + (max - min) * smoothT;
};
