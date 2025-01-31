import { useRef, useEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Spaceship } from "../../domain/entities/Spaceship";
import {
  Vector3,
  PerspectiveCamera as ThreePerspectiveCamera,
  Euler,
  MathUtils,
  Group,
  DirectionalLight,
} from "three";
import * as THREE from "three";
import { PerspectiveCamera, useGLTF } from "@react-three/drei";
import { SunConfig } from "./SolarSystem";
import { calculateLightIntensity } from "../../domain/shared/LightingUtils";
import {
  CelestialBody,
  detectCollision,
  handleCollision,
} from "../../domain/shared/CollisionUtils";

interface PlayerShipProps {
  player: Spaceship;
  startPosition: Vector3;
  sunConfig: SunConfig;
  planets: { position: Vector3; radius: number }[];
}

function Model() {
  const { scene } = useGLTF("/models/space_ship/scene.gltf");

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Enable shadows
        child.castShadow = true;
        child.receiveShadow = true;
        // Enhance material properties for better lighting
        if (child.material) {
          // Increase metalness for better reflections
          if ("metalness" in child.material) {
            child.material.metalness = 0.8;
          }
          // // Adjust roughness for sharper reflections
          // if ("roughness" in child.material) {
          //   child.material.roughness = 0.2;
          // }
          // // Increase material light sensitivity
          // child.material.envMapIntensity = 1;
          // // Make materials more responsive to light
          // if ("lightMapIntensity" in child.material) {
          //   child.material.lightMapIntensity = 1;
          // }
          child.material.needsUpdate = true;
        }
      }
    });
  }, [scene]);

  // scene.rotateY(Math.PI);

  return <primitive object={scene} />;
}

export const PlayerShip = ({
  player,
  startPosition,
  sunConfig,
  planets,
}: PlayerShipProps) => {
  const meshRef = useRef<Group>(null);
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const lightRef = useRef<DirectionalLight>(null);
  const lightIntensityRef = useRef(2);

  // Camera state
  const cameraRotation = useRef(new Euler(0, 0, 0));
  const freeLookSensitivity = 0.002;
  const returnToNormalSpeed = 0.05;
  // Add max angle constraints
  const MAX_VERTICAL_ANGLE = Math.PI / 6; // 30 degrees up/down
  const MAX_HORIZONTAL_ANGLE = Math.PI / 4; // 45 degrees left/right

  // Physics constants
  const acceleration = 0.0008; // Base acceleration
  const boostMultiplier = 2.5; // Boost multiplier when right mouse button is pressed
  const maxSpeed = 0.1; // Base max speed
  const maxBoostSpeed = 0.5; // Max speed while boosting
  const rotateAcceleration = 0.0000025;
  const maxRotationSpeed = 0.01;
  const rollAcceleration = 0.00005;

  // Camera settings
  // const firstPersonPosition = new Vector3(0, 1.2, -7); // hammerheadship
  // const thirdPersonPosition = new Vector3(0, 10, 35); // hammerheadship
  const firstPersonPosition = new Vector3(0, 0.3, -3); // SA-23
  const thirdPersonPosition = new Vector3(0, 4, 10); // SA-23

  // Inertia and damping settings
  const dampingFactor = 0.995;
  const rotationDamping = 0.995;
  const inertiaFactor = 0.25;
  const rotationInertiaFactor = 0.01;
  const principalThrusterStrength = 1.0;
  const sideThrusterStrength = 0.5;

  // Store velocity and rotation velocity as refs
  const velocity = useRef(new Vector3());
  const rotationVelocity = useRef(new Vector3());
  const lastAcceleration = useRef(new Vector3());
  const lastRotationAcceleration = useRef(new Vector3());
  const isBoostingRef = useRef(false);

  const movement = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    rolling: false,
    rollDirection: 0,
    freeLook: false,
    thirdPerson: false,
  });

  // Add these new refs for camera control
  const lastMouseX = useRef(0);
  const lastMouseY = useRef(0);

  useEffect(() => {
    document.body.requestPointerLock();
    document.body.style.cursor = "none";

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w":
          movement.current.forward = true;
          break;
        case "s":
          movement.current.backward = true;
          break;
        case "a":
          movement.current.left = true;
          break;
        case "d":
          movement.current.right = true;
          break;
        case " ":
          movement.current.up = true;
          break;
        case "shift":
          movement.current.down = true;
          break;
        case "q":
          movement.current.rolling = true;
          movement.current.rollDirection = 1;
          break;
        case "e":
          movement.current.rolling = true;
          movement.current.rollDirection = -1;
          break;
        case "c":
          movement.current.freeLook = true;
          // replace cameras
          break;
        case "v":
          movement.current.thirdPerson = !movement.current.thirdPerson;
          // Reset camera position when switching modes
          if (cameraRef.current) {
            if (movement.current.thirdPerson) {
              cameraRef.current.position.copy(thirdPersonPosition);
            } else {
              cameraRef.current.position.copy(firstPersonPosition);
            }
          }
          break;
        case "escape":
          document.exitPointerLock();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case "w":
          movement.current.forward = false;
          break;
        case "s":
          movement.current.backward = false;
          break;
        case "a":
          movement.current.left = false;
          break;
        case "d":
          movement.current.right = false;
          break;
        case " ":
          movement.current.up = false;
          break;
        case "shift":
          movement.current.down = false;
          break;
        case "q":
        case "e":
          movement.current.rolling = false;
          movement.current.rollDirection = 0;
          break;
        case "c":
          movement.current.freeLook = false;
          break;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (meshRef.current) {
        if (movement.current.freeLook) {
          if (cameraRef.current) {
            // First person free look
            const deltaX = e.movementX * freeLookSensitivity;
            const deltaY = e.movementY * freeLookSensitivity;

            // Update camera rotation with constraints
            cameraRotation.current.y = MathUtils.clamp(
              cameraRotation.current.y - deltaX,
              -MAX_HORIZONTAL_ANGLE,
              MAX_HORIZONTAL_ANGLE
            );
            cameraRotation.current.x = MathUtils.clamp(
              cameraRotation.current.x - deltaY,
              -MAX_VERTICAL_ANGLE,
              MAX_VERTICAL_ANGLE
            );

            // Apply rotation to camera
            cameraRef.current.rotation.x = cameraRotation.current.x;
            cameraRef.current.rotation.y = cameraRotation.current.y;
          }
        } else {
          // Normal ship rotation
          const rotX = -e.movementY * rotateAcceleration;
          const rotY = -e.movementX * rotateAcceleration;

          rotationVelocity.current.x +=
            rotX + lastRotationAcceleration.current.x * rotationInertiaFactor;
          rotationVelocity.current.y +=
            rotY + lastRotationAcceleration.current.y * rotationInertiaFactor;

          lastRotationAcceleration.current.x = rotX;
          lastRotationAcceleration.current.y = rotY;

          // Reset camera rotation when not in free look
          if (cameraRef.current) {
            cameraRotation.current.x = MathUtils.lerp(
              cameraRotation.current.x,
              0,
              returnToNormalSpeed
            );
            cameraRotation.current.y = MathUtils.lerp(
              cameraRotation.current.y,
              0,
              returnToNormalSpeed
            );

            cameraRef.current.rotation.x = cameraRotation.current.x;
            cameraRef.current.rotation.y = cameraRotation.current.y;
          }
        }
      }

      lastMouseX.current = e.clientX;
      lastMouseY.current = e.clientY;
    };

    const handleClick = () => {
      if (document.pointerLockElement === null) {
        document.body.requestPointerLock();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) {
        // Right mouse button
        isBoostingRef.current = true;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2) {
        // Right mouse button
        isBoostingRef.current = false;
      }
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault(); // Prevent context menu from appearing
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("contextmenu", handleContextMenu);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("contextmenu", handleContextMenu);
      document.exitPointerLock();
      document.body.style.cursor = "auto";
    };
  }, []);

  useFrame((_state, _delta) => {
    const mesh = meshRef.current;
    const light = lightRef.current;
    if (!mesh || !light || !sunConfig) return;

    // Calculate new acceleration with inertia
    const accelerationVector = new Vector3();
    const targetAcceleration = new Vector3();
    const currentAcceleration = isBoostingRef.current
      ? acceleration * boostMultiplier
      : acceleration;
    const currentMaxSpeed = isBoostingRef.current ? maxBoostSpeed : maxSpeed;

    if (movement.current.forward)
      targetAcceleration.z -= currentAcceleration * principalThrusterStrength;
    if (movement.current.backward)
      targetAcceleration.z += currentAcceleration * sideThrusterStrength;
    if (movement.current.left)
      targetAcceleration.x -= currentAcceleration * sideThrusterStrength;
    if (movement.current.right)
      targetAcceleration.x += currentAcceleration * sideThrusterStrength;
    if (movement.current.up)
      targetAcceleration.y += currentAcceleration * sideThrusterStrength;
    if (movement.current.down)
      targetAcceleration.y -= currentAcceleration * sideThrusterStrength;

    // Blend new acceleration with previous acceleration (inertia)
    accelerationVector
      .copy(targetAcceleration)
      .multiplyScalar(1 - inertiaFactor)
      .add(lastAcceleration.current.multiplyScalar(inertiaFactor));

    // Transform to world space and apply
    accelerationVector.applyQuaternion(mesh.quaternion);
    velocity.current.add(accelerationVector);

    // Update last acceleration for next frame
    lastAcceleration.current.copy(accelerationVector);

    // Apply damping
    velocity.current.multiplyScalar(dampingFactor);

    // Limit speed based on boost state
    if (velocity.current.length() > currentMaxSpeed) {
      velocity.current.normalize().multiplyScalar(currentMaxSpeed);
    }

    // Calculate next position
    const nextPosition = mesh.position.clone().add(velocity.current);

    // Update player position to match current mesh position
    player.position.copy(mesh.position);

    // Test collision at next position
    const testPosition = nextPosition.clone();

    // Check for potential collisions at next position
    let willCollide = false;

    // Check sun collision
    const sun: CelestialBody = {
      position: new Vector3(...sunConfig.position),
      radius: sunConfig.radius,
      type: "sun",
    };

    // Test collision by updating player position temporarily
    const originalPosition = player.position.clone();
    player.position.copy(testPosition);

    if (detectCollision(player, sun)) {
      willCollide = true;
      const { newVelocity, damage } = handleCollision(
        player,
        sun,
        velocity.current
      );
      velocity.current.copy(newVelocity);
      player.takeDamage(damage);

      // Move ship out of collision
      const escapeVector = new Vector3()
        .subVectors(player.position, sun.position)
        .normalize()
        .multiplyScalar(sun.radius + 3);
      mesh.position.copy(sun.position).add(escapeVector);
      player.position.copy(mesh.position);
    }

    // Check planet collisions
    planets.forEach((planetData) => {
      const planet: CelestialBody = {
        position: planetData.position,
        radius: planetData.radius,
        type: "planet",
      };

      // Update test position for each planet check
      player.position.copy(testPosition);

      if (detectCollision(player, planet)) {
        willCollide = true;
        const { newVelocity, damage } = handleCollision(
          player,
          planet,
          velocity.current
        );
        velocity.current.copy(newVelocity);
        player.takeDamage(damage);

        // Move ship out of collision
        const escapeVector = new Vector3()
          .subVectors(player.position, planet.position)
          .normalize()
          .multiplyScalar(planet.radius + 3);
        mesh.position.copy(planet.position).add(escapeVector);
        player.position.copy(mesh.position);
      }
    });

    // Update position based on collision status
    if (!willCollide) {
      mesh.position.add(velocity.current);
      player.position.copy(mesh.position);
    } else {
      // If there was a collision, make sure player position and mesh position are in sync
      player.position.copy(mesh.position);
    }

    // Handle roll with inertia
    if (movement.current.rolling) {
      const rollForce = rollAcceleration * movement.current.rollDirection;
      rotationVelocity.current.z +=
        rollForce + lastRotationAcceleration.current.z * rotationInertiaFactor;
      lastRotationAcceleration.current.z = rollForce;
    }

    // Apply rotation damping
    rotationVelocity.current.multiplyScalar(rotationDamping);

    // Limit rotation speed
    if (rotationVelocity.current.length() > maxRotationSpeed) {
      rotationVelocity.current.normalize().multiplyScalar(maxRotationSpeed);
    }

    // Apply rotations in order
    mesh.rotateY(rotationVelocity.current.y);
    mesh.rotateX(rotationVelocity.current.x);
    mesh.rotateZ(rotationVelocity.current.z);

    // Update player state
    player.position.copy(mesh.position);
    player.rotation.copy(mesh.quaternion);

    // Update light intensity and direction based on sun position
    const shipPosition = mesh.position;
    const sunPosition = new Vector3(...sunConfig.position);

    // Calculate direction from ship to sun
    const directionToSun = sunPosition.clone().sub(shipPosition).normalize();

    // Position light relative to ship
    const lightDistance = 50; // Adjust based on your scene scale
    light.position.copy(
      shipPosition.clone().add(directionToSun.multiplyScalar(lightDistance))
    );
    light.target.position.copy(shipPosition);
    light.target.updateMatrixWorld();

    // Update intensity based on distance
    const intensity = calculateLightIntensity(shipPosition, sunPosition);
    light.intensity = intensity;
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        intensity={lightIntensityRef.current}
        color={sunConfig.sunColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={100}
        shadow-camera-near={0.1}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
      >
        <object3D /> {/* Light target */}
      </directionalLight>
      <group
        ref={meshRef}
        position={startPosition}
        castShadow
        scale={[0.5, 0.5, 0.5]}
      >
        <PerspectiveCamera
          ref={cameraRef}
          isCamera
          far={100000}
          near={0.1}
          position={
            movement.current.thirdPerson
              ? thirdPersonPosition
              : firstPersonPosition
          }
          makeDefault
          fov={75}
        />
        <Suspense fallback={null}>
          <Model />
        </Suspense>
      </group>
    </>
  );
};

// Pre-load the model
useGLTF.preload("/models/space_ship/scene.gltf");
