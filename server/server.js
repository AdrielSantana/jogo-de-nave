const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// Server setup
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, "../public")));

// Game state
const gameState = {
  players: new Map(),
  projectiles: [],
};

// Game constants
const FPS = 120;
const FRAME_TIME = 1000 / FPS;
const MOVEMENT_SPEED = 15;
const MAX_VELOCITY = 30;
const DRAG_COEFFICIENT = 0.995; // Less drag for space
const ACCELERATION_RATE = 1.5;
const TURN_SPEED = 2.0;
const ROLL_SPEED = 3.0;
const PROJECTILE_SPEED = 50;
const PROJECTILE_LIFETIME = 2; // seconds
const RESPAWN_TIME = 3; // seconds
const PROJECTILE_DAMAGE = 25;
const COLLISION_DAMAGE = 50;

class Projectile {
  constructor(playerId, position, quaternion) {
    this.id = Date.now().toString() + Math.random();
    this.playerId = playerId;
    this.position = { ...position };
    this.lifetime = PROJECTILE_LIFETIME;
    // Get forward direction from quaternion
    const forward = rotateVectorByQuaternion({ x: -1, y: 0, z: 0 }, quaternion);
    this.velocity = {
      x: forward.x * PROJECTILE_SPEED,
      y: forward.y * PROJECTILE_SPEED,
      z: forward.z * PROJECTILE_SPEED,
    };
  }

  update(deltaTime) {
    this.position.x += this.velocity.x * deltaTime;
    this.position.y += this.velocity.y * deltaTime;
    this.position.z += this.velocity.z * deltaTime;
    this.lifetime -= deltaTime;
    return this.lifetime > 0;
  }
}

// Player class
class Player {
  constructor(id) {
    this.id = id;
    this.name = "Player"; // Default name
    this.position = this.getRandomSpawnPosition();
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.speed = 0;
    this.health = 100;
    this.score = 0;
    this.isAlive = true;
    this.respawnTime = 0;
    this.targetRotation = { x: 0, y: 0 };
    this.input = {
      rollLeft: false,
      rollRight: false,
      accelerate: false,
      shoot: false,
    };
    this.lastShootTime = 0;
  }

  getRandomSpawnPosition() {
    return {
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100,
      z: (Math.random() - 0.5) * 100,
    };
  }

  respawn() {
    this.position = this.getRandomSpawnPosition();
    this.quaternion = { x: 0, y: 0, z: 0, w: 1 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.speed = 0;
    this.health = 100;
    this.isAlive = true;
    this.respawnTime = 0;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0 && this.isAlive) {
      this.isAlive = false;
      this.respawnTime = RESPAWN_TIME;
      return true; // Player died
    }
    return false;
  }
}

// WebSocket connection handling
wss.on("connection", (ws) => {
  const playerId = uuidv4();
  console.log(`Player ${playerId} connected`);

  // Create new player
  const player = new Player(playerId);
  gameState.players.set(playerId, player);

  // Set random spawn position
  player.respawn();

  // Send initial game state
  const initialState = {
    type: "init",
    playerId: playerId,
    gameState: getGameStateForClient(),
  };
  console.log("Sending initial state to player:", playerId);
  ws.send(JSON.stringify(initialState));

  // Handle player input
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message from player ${playerId}:`, data.type);
      handlePlayerInput(playerId, data);
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  // Handle disconnection
  ws.on("close", () => {
    console.log(`Player ${playerId} disconnected`);
    gameState.players.delete(playerId);
    broadcastGameState();
  });

  // Handle errors
  ws.on("error", (error) => {
    console.error(`WebSocket error for player ${playerId}:`, error);
  });
});

// Handle player input
function handlePlayerInput(playerId, data) {
  const player = gameState.players.get(playerId);
  if (!player) return; // Remove isAlive check for join message

  if (data.type === "join") {
    // Handle player name
    if (data.name && typeof data.name === "string") {
      const sanitizedName = data.name.trim().slice(0, 15); // Limit to 15 chars
      if (sanitizedName.length >= 2) {
        player.name = sanitizedName;
        console.log(`Player ${playerId} set name to: ${sanitizedName}`);
        // Immediately broadcast the updated game state after name change
        broadcastGameState();
      }
    }
  } else if (data.type === "input") {
    if (!player.isAlive) return; // Move isAlive check here
    player.input = data.keys;

    // Handle shooting
    if (data.keys.shoot && Date.now() - player.lastShootTime > 250) {
      gameState.projectiles.push(
        new Projectile(playerId, player.position, player.quaternion)
      );
      player.lastShootTime = Date.now();
    }
  } else if (data.type === "rotation") {
    if (!player.isAlive) return; // Add isAlive check here
    player.targetRotation = data.rotation;
  }
}

// Get game state for client
function getGameStateForClient() {
  return {
    players: Array.from(gameState.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      position: player.position,
      quaternion: player.quaternion,
      health: player.health,
      score: player.score,
      isAlive: player.isAlive,
      respawnTime: player.respawnTime,
      speed: player.speed,
    })),
    projectiles: gameState.projectiles,
  };
}

// Broadcast game state to all clients
function broadcastGameState() {
  const state = getGameStateForClient();
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: "gameState",
          state: state,
        })
      );
    }
  });
}

// Game loop
let lastUpdate = Date.now();

function gameLoop() {
  const now = Date.now();
  const delta = now - lastUpdate;

  if (delta >= FRAME_TIME) {
    // Update game state
    updateGameState(delta / 1000); // Convert to seconds

    // Broadcast new state to all clients
    broadcastGameState();

    lastUpdate = now;
  }

  // Schedule next update
  setImmediate(gameLoop);
}

// Check collision between two spheres
function checkCollision(pos1, pos2, radius) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return distance < radius * 2;
}

// Update game state
function updateGameState(deltaTime) {
  // Update projectiles
  gameState.projectiles = gameState.projectiles.filter((projectile) => {
    // Update projectile position
    const alive = projectile.update(deltaTime);
    if (!alive) return false;

    // Check collisions with players
    for (const [_, player] of gameState.players) {
      if (!player.isAlive || player.id === projectile.playerId) continue;

      if (checkCollision(projectile.position, player.position, 1)) {
        // Player hit by projectile
        const died = player.damage(PROJECTILE_DAMAGE);
        if (died) {
          const shooter = gameState.players.get(projectile.playerId);
          if (shooter) shooter.score += 1;
        }
        return false; // Remove projectile
      }
    }
    return true;
  });

  // Update players
  for (const [_, player] of gameState.players) {
    if (!player.isAlive) {
      player.respawnTime -= deltaTime;
      if (player.respawnTime <= 0) {
        player.respawn();
      }
      continue;
    }

    // Check player collisions
    for (const [_, otherPlayer] of gameState.players) {
      if (player.id === otherPlayer.id || !otherPlayer.isAlive) continue;

      if (checkCollision(player.position, otherPlayer.position, 1.5)) {
        // Calculate relative velocity for damage
        const relativeSpeed = Math.sqrt(
          Math.pow(player.velocity.x - otherPlayer.velocity.x, 2) +
            Math.pow(player.velocity.y - otherPlayer.velocity.y, 2) +
            Math.pow(player.velocity.z - otherPlayer.velocity.z, 2)
        );

        const damage = Math.min(COLLISION_DAMAGE, relativeSpeed * 2);
        player.damage(damage);
        otherPlayer.damage(damage);
      }
    }

    // Create rotation quaternions
    let targetQuat = { x: 0, y: 0, z: 0, w: 1 };
    let rollQuat = { x: 0, y: 0, z: 0, w: 1 };

    // Set target rotation based on mouse aim
    const pitchAngle = player.targetRotation.x;
    const yawAngle = player.targetRotation.y;

    // Convert Euler angles to quaternion (yaw-pitch-roll order)
    const cy = Math.cos(yawAngle * 0.5);
    const sy = Math.sin(yawAngle * 0.5);
    const cp = Math.cos(pitchAngle * 0.5);
    const sp = Math.sin(pitchAngle * 0.5);

    // Correct quaternion calculation for yaw (Y) and pitch (X)
    targetQuat.z = sp * cy; // Pitch
    targetQuat.y = sy * cp; // Yaw
    targetQuat.x = sy * sp; // Combined
    targetQuat.w = cy * cp; // Real part

    // Handle roll (Q/E) - continuous roll around X axis
    if (player.input.rollLeft) {
      const angle = ROLL_SPEED * deltaTime;
      rollQuat.x = Math.sin(angle / 2);
      rollQuat.w = Math.cos(angle / 2);
      player.quaternion = multiplyQuaternions(player.quaternion, rollQuat);
    }
    if (player.input.rollRight) {
      const angle = -ROLL_SPEED * deltaTime;
      rollQuat.x = Math.sin(angle / 2);
      rollQuat.w = Math.cos(angle / 2);
      player.quaternion = multiplyQuaternions(player.quaternion, rollQuat);
    }

    // Normalize quaternion to prevent drift
    player.quaternion = normalizeQuaternion(player.quaternion);

    // Smoothly interpolate to target rotation
    const ROTATION_SMOOTHING = 10;
    const t = Math.min(deltaTime * ROTATION_SMOOTHING, 1);
    player.quaternion = interpolateQuaternions(
      player.quaternion,
      targetQuat,
      t
    );

    // Apply roll after interpolation
    player.quaternion = multiplyQuaternions(player.quaternion, rollQuat);
    normalizeQuaternion(player.quaternion);

    // Get forward direction from quaternion for movement
    const forward = rotateVectorByQuaternion(
      { x: -1, y: 0, z: 0 },
      player.quaternion
    );

    // Handle acceleration
    if (player.input.accelerate) {
      player.speed = Math.min(player.speed + ACCELERATION_RATE * deltaTime, 1);
    } else {
      player.speed = Math.max(player.speed - ACCELERATION_RATE * deltaTime, 0);
    }

    // Apply velocity based on direction and speed
    const currentSpeed = player.speed * MOVEMENT_SPEED;
    player.velocity.x = forward.x * currentSpeed;
    player.velocity.y = forward.y * currentSpeed;
    player.velocity.z = forward.z * currentSpeed;

    // Apply drag
    player.velocity.x *= DRAG_COEFFICIENT;
    player.velocity.y *= DRAG_COEFFICIENT;
    player.velocity.z *= DRAG_COEFFICIENT;

    // Update position
    player.position.x += player.velocity.x * deltaTime;
    player.position.y += player.velocity.y * deltaTime;
    player.position.z += player.velocity.z * deltaTime;
  }
}

// Quaternion helper functions
function multiplyQuaternions(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function normalizeQuaternion(q) {
  const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  q.x /= length;
  q.y /= length;
  q.z /= length;
  q.w /= length;
  return q;
}

function rotateVectorByQuaternion(v, q) {
  // Convert vector to quaternion
  const vq = { x: v.x, y: v.y, z: v.z, w: 0 };

  // Calculate quaternion conjugate
  const qConjugate = { x: -q.x, y: -q.y, z: -q.z, w: q.w };

  // Rotate vector: q * v * q'
  const rotated = multiplyQuaternions(q, multiplyQuaternions(vq, qConjugate));

  return { x: rotated.x, y: rotated.y, z: rotated.z };
}

// Add quaternion interpolation function
function interpolateQuaternions(a, b, t) {
  // Ensure we take the shortest path
  let dot = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  if (dot < 0) {
    b = { x: -b.x, y: -b.y, z: -b.z, w: -b.w };
    dot = -dot;
  }

  const result = {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    w: a.w + (b.w - a.w) * t,
  };

  return normalizeQuaternion(result);
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  gameLoop(); // Start game loop
});
