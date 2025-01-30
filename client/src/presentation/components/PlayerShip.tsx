import { useRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Spaceship } from "../../domain/entities/Spaceship";
import {
  Mesh,
  Vector3,
  PerspectiveCamera as ThreePerspectiveCamera,
  Euler,
  MathUtils,
} from "three";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";

interface PlayerShipProps {
  player: Spaceship;
}

export const PlayerShip = ({ player }: PlayerShipProps) => {
  const meshRef = useRef<Mesh>(null);
  const cameraRef = useRef<ThreePerspectiveCamera>(null);

  // Camera state
  const cameraRotation = useRef(new Euler(0, 0, 0));
  const freeLookSensitivity = 0.002;
  const returnToNormalSpeed = 0.05;
  // Add max angle constraints
  const MAX_VERTICAL_ANGLE = Math.PI / 6; // 30 degrees up/down
  const MAX_HORIZONTAL_ANGLE = Math.PI / 4; // 45 degrees left/right

  // Physics constants
  const acceleration = 0.008; // Base acceleration rate
  const maxSpeed = 1.0; // Maximum speed
  const rotateAcceleration = 0.0000025; // Base rotation acceleration
  const maxRotationSpeed = 0.01; // Maximum rotation speed
  const rollAcceleration = 0.00005; // Roll acceleration (matched with rotate)

  // Camera settings
  const firstPersonPosition = new Vector3(0, 0.5, 0);
  const thirdPersonPosition = new Vector3(0, 3, 8);

  // Inertia and damping settings
  const dampingFactor = 0.995; // Very slight natural damping (almost none, more space-like)
  const rotationDamping = 0.995; // Rotation persistence
  const inertiaFactor = 0.25; // How much current velocity affects acceleration
  const rotationInertiaFactor = 0.01; // How much current rotation affects new rotations
  const principalThrusterStrength = 1.0; // Base thruster power multiplier
  const sideThrusterStrength = 0.5; // Base thruster power multiplier

  // Store velocity and rotation velocity as refs
  const velocity = useRef(new Vector3());
  const rotationVelocity = useRef(new Vector3()); // x: pitch, y: yaw, z: roll
  const lastAcceleration = useRef(new Vector3()); // Store last acceleration for inertia
  const lastRotationAcceleration = useRef(new Vector3()); // Store last rotation acceleration

  const movement = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    rolling: false,
    rollDirection: 0,
    freeLook: false, // New free look state
    thirdPerson: false, // New camera mode state
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

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick);
      document.exitPointerLock();
      document.body.style.cursor = "auto";
    };
  }, []);

  useFrame((state, delta) => {
    if (meshRef.current) {
      // Calculate new acceleration with inertia
      const accelerationVector = new Vector3();
      const targetAcceleration = new Vector3();

      if (movement.current.forward)
        targetAcceleration.z -= acceleration * principalThrusterStrength;
      if (movement.current.backward)
        targetAcceleration.z += acceleration * sideThrusterStrength;
      if (movement.current.left)
        targetAcceleration.x -= acceleration * sideThrusterStrength;
      if (movement.current.right)
        targetAcceleration.x += acceleration * sideThrusterStrength;
      if (movement.current.up)
        targetAcceleration.y += acceleration * sideThrusterStrength;
      if (movement.current.down)
        targetAcceleration.y -= acceleration * sideThrusterStrength;

      // Blend new acceleration with previous acceleration (inertia)
      accelerationVector
        .copy(targetAcceleration)
        .multiplyScalar(1 - inertiaFactor)
        .add(lastAcceleration.current.multiplyScalar(inertiaFactor));

      // Transform to world space and apply
      accelerationVector.applyQuaternion(meshRef.current.quaternion);
      velocity.current.add(accelerationVector);

      // Update last acceleration for next frame
      lastAcceleration.current.copy(accelerationVector);

      // Apply damping
      velocity.current.multiplyScalar(dampingFactor);

      // Limit speed
      if (velocity.current.length() > maxSpeed) {
        velocity.current.normalize().multiplyScalar(maxSpeed);
      }

      // Update position
      meshRef.current.position.add(velocity.current);

      // Handle roll with inertia
      if (movement.current.rolling) {
        const rollForce = rollAcceleration * movement.current.rollDirection;
        rotationVelocity.current.z +=
          rollForce +
          lastRotationAcceleration.current.z * rotationInertiaFactor;
        lastRotationAcceleration.current.z = rollForce;
      }

      // Apply rotation damping
      rotationVelocity.current.multiplyScalar(rotationDamping);

      // Limit rotation speed
      if (rotationVelocity.current.length() > maxRotationSpeed) {
        rotationVelocity.current.normalize().multiplyScalar(maxRotationSpeed);
      }

      // Apply rotations in order
      meshRef.current.rotateY(rotationVelocity.current.y);
      meshRef.current.rotateX(rotationVelocity.current.x);
      meshRef.current.rotateZ(rotationVelocity.current.z);

      // Update player state
      player.position.copy(meshRef.current.position);
      player.rotation.copy(meshRef.current.quaternion);
    }
  });

  return (
    <>
      <mesh ref={meshRef}>
        <PerspectiveCamera
          ref={cameraRef}
          position={
            movement.current.thirdPerson
              ? thirdPersonPosition
              : firstPersonPosition
          }
          makeDefault
          fov={75}
        />
        <boxGeometry args={[1, 0.5, 2]} />
        <meshStandardMaterial color="blue" />
      </mesh>
    </>
  );
};
