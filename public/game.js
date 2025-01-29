// Game client
class GameClient {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.renderer = new THREE.WebGLRenderer();
    this.players = new Map();
    this.projectiles = new Map();
    this.explosions = new Map();
    this.playerId = null;
    this.playerName = null;
    this.connected = false;
    this.mouseRotation = { x: 0, y: 0 };
    this.orbitAngle = { x: 0, y: 0 };
    this.isPointerLocked = false;
    this.shipModel = null;
    this.loadingProgress = {
      model: 0,
      connection: 0,
      total: 0,
    };

    // Initialize audio system (but don't create listener yet)
    this.audioListener = null;
    this.sounds = {
      engine: null,
      shoot: null,
      explosion: null,
      hit: null,
      ambient: null,
    };

    // Add click handler for audio initialization
    this.audioInitialized = false;
    document.addEventListener("click", () => this.initializeAudio(), {
      once: true,
    });
    document.addEventListener("keydown", () => this.initializeAudio(), {
      once: true,
    });

    // Load the ship model
    const loader = new THREE.GLTFLoader();
    loader.load(
      "/models/spaceship/scene.gltf",
      (gltf) => {
        this.shipModel = gltf.scene;
        this.shipModel.scale.set(0.5, 0.5, 0.5);
        console.log("Model loaded successfully");
      },
      (progress) => {
        const percent = (progress.loaded / progress.total) * 99;
        this.loadingProgress.model = percent;
        console.log("Loading model...", percent + "%");
      },
      (error) => {
        console.error("Error loading model:", error);
        this.loadingProgress.model = 100; // Mark as complete even on error
        this.updateLoadingScreen();
      }
    );

    // Load the skybox
    const skyboxLoader = new THREE.GLTFLoader();
    skyboxLoader.load(
      "/models/space-skybox/scene.gltf",
      (gltf) => {
        this.skybox = gltf.scene;
        // Scale the skybox to be very large
        this.skybox.scale.set(1000, 1000, 1000);

        // Make sure skybox is rendered behind everything
        this.skybox.renderOrder = -1000;

        // Traverse and modify materials
        this.skybox.traverse((child) => {
          if (child.isMesh) {
            child.material.side = THREE.BackSide;
            child.material.depthWrite = false;
            child.material.transparent = true;
            child.material.opacity = 0.3;
            // Ensure the skybox is always rendered first
            child.renderOrder = -1000;
          }
        });

        this.scene.add(this.skybox);
        console.log("Skybox loaded successfully");
      },
      (progress) => {
        console.log(
          "Loading skybox...",
          (progress.loaded / progress.total) * 100 + "%"
        );
      },
      (error) => {
        console.error("Error loading skybox:", error);
      }
    );

    // Create projectile material
    this.projectileMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    this.projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);

    // Create explosion particles
    this.explosionParticles = {
      flash: [],
      fire: [],
      smoke: [],
      debris: [],
    };

    // Create flash particles (bright initial flash)
    for (let i = 0; i < 10; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffff80,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthTest: false,
        })
      );
      particle.visible = false;
      this.scene.add(particle);
      this.explosionParticles.flash.push(particle);
    }

    // Create fire particles (orange-red flames)
    for (let i = 0; i < 30; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(
            0.8 + Math.random() * 0.2, // Red
            0.3 + Math.random() * 0.3, // Green
            0.0 // Blue
          ),
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
        })
      );
      particle.visible = false;
      this.scene.add(particle);
      this.explosionParticles.fire.push(particle);
    }

    // Create smoke particles (dark clouds)
    for (let i = 0; i < 40; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0x222222,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        })
      );
      particle.visible = false;
      this.scene.add(particle);
      this.explosionParticles.smoke.push(particle);
    }

    // Create debris particles (ship fragments)
    for (let i = 0; i < 20; i++) {
      const particle = new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.1),
        new THREE.MeshBasicMaterial({
          color: 0xcccccc,
          transparent: true,
          opacity: 1,
        })
      );
      particle.visible = false;
      this.scene.add(particle);
      this.explosionParticles.debris.push(particle);
    }

    // Create aim indicator
    const aimRingGeometry = new THREE.RingGeometry(0.2, 0.3, 32);
    const aimRingMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    this.aimIndicator = new THREE.Mesh(aimRingGeometry, aimRingMaterial);
    this.scene.add(this.aimIndicator);

    // Create hit particles pool
    this.hitParticles = [];
    for (let i = 0; i < 30; i++) {
      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 1,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        })
      );
      particle.visible = false;
      particle.userData = {
        velocity: new THREE.Vector3(),
        lifetime: 0,
        maxLifetime: 0.5,
      };
      this.scene.add(particle);
      this.hitParticles.push(particle);
    }

    // Setup menu handling
    this.setupMenu();
  }

  setupMenu() {
    const menuScreen = document.getElementById("menu-screen");
    const playerNameInput = document.getElementById("player-name");
    const joinButton = document.getElementById("join-button");
    const loadingScreen = document.getElementById("loading-screen");

    // Enable/disable join button based on name input
    playerNameInput.addEventListener("input", () => {
      const name = playerNameInput.value.trim();
      joinButton.disabled = name.length < 2 || name.length > 15;
    });

    // Handle join button click
    joinButton.addEventListener("click", () => {
      this.playerName = playerNameInput.value.trim();
      menuScreen.style.display = "none";
      loadingScreen.style.display = "flex";
      this.startGame();
    });
  }

  startGame() {
    console.log("Starting game...");
    // Initialize game components
    this.setupRenderer();
    this.setupScene();
    this.setupWebSocket();
    this.setupControls();
    this.setupMouseControls();
    this.animate();
    console.log("Game components initialized");
  }

  initializeAudio() {
    if (this.audioInitialized) return;

    console.log("Initializing audio system...");
    this.audioInitialized = true;

    // Create audio listener
    this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);

    // Load sounds after listener is created
    this.loadSounds();
  }

  setupRenderer() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1;
    document.body.appendChild(this.renderer.domElement);

    // Setup post-processing
    const renderScene = new THREE.RenderPass(this.scene, this.camera);
    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );

    // Add custom render pass for skybox bloom
    const skyboxBloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5, // Lower bloom intensity for skybox
      0.8, // Larger radius for softer glow
      0.2 // Lower threshold for more visible bloom
    );

    this.composer = new THREE.EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(skyboxBloomPass);
    this.composer.addPass(bloomPass);

    // Handle window resize
    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupScene() {
    // Add ambient light (dimmer base light)
    const ambientLight = new THREE.AmbientLight(0x202040, 0.3);
    this.scene.add(ambientLight);

    // Create galaxy center light
    this.galaxyLight = new THREE.PointLight(0x3388ff, 2, 1000);
    this.galaxyLight.position.set(0, 0, -200); // Same position as galaxy center
    this.scene.add(this.galaxyLight);

    // Add subtle pulsing effect to galaxy light
    this.galaxyLightIntensity = {
      base: 2,
      variation: 0.3,
      speed: 0.5,
    };

    // Create galaxy background
    this.createGalaxy();

    // Set initial camera position
    this.camera.position.z = 5;
  }

  createGalaxy() {
    // Parameters for galaxy generation
    const params = {
      count: 50000,
      size: 0.01,
      radius: 500,
      branches: 5,
      spin: 1,
      randomness: 0.2,
      randomnessPower: 3,
      insideColor: new THREE.Color(0x3388ff),
      outsideColor: new THREE.Color(0xff3388),
      centerColor: new THREE.Color(0xffffff),
      rotationSpeed: 0.0008,
      oscillationSpeed: 0.03,
      oscillationAmplitude: 0.035,
    };

    // Store colors for light animation
    this.galaxyColors = {
      inside: params.insideColor,
      outside: params.outsideColor,
      center: params.centerColor,
    };

    // Create geometry
    const positions = new Float32Array(params.count * 3);
    const colors = new Float32Array(params.count * 3);
    const scales = new Float32Array(params.count);
    const rotationOffsets = new Float32Array(params.count);
    const initialDistances = new Float32Array(params.count);
    const initialAngles = new Float32Array(params.count);

    const colorInside = new THREE.Color(params.insideColor);
    const colorOutside = new THREE.Color(params.outsideColor);
    const colorCenter = new THREE.Color(params.centerColor);

    // Generate stars
    for (let i = 0; i < params.count; i++) {
      const i3 = i * 3;

      // Position
      const radius = Math.random() * params.radius;
      const spinAngle = radius * params.spin;
      const branchAngle =
        ((i % params.branches) / params.branches) * Math.PI * 2;

      const randomX =
        Math.pow(Math.random(), params.randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        params.randomness *
        radius;
      const randomY =
        Math.pow(Math.random(), params.randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        params.randomness *
        radius;
      const randomZ =
        Math.pow(Math.random(), params.randomnessPower) *
        (Math.random() < 0.5 ? 1 : -1) *
        params.randomness *
        radius;

      // Store initial position data for animation
      initialDistances[i] = radius;
      initialAngles[i] = branchAngle + spinAngle;
      rotationOffsets[i] = Math.random() * Math.PI * 2;

      // Apply spiral pattern
      positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
      positions[i3 + 1] = randomY;
      positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

      // Color
      const mixedColor = new THREE.Color();

      if (radius < params.radius * 0.1) {
        // Center region
        mixedColor.copy(colorCenter);
      } else {
        // Outer regions
        const radiusPercent = radius / params.radius;
        mixedColor.copy(colorInside).lerp(colorOutside, radiusPercent);
      }

      colors[i3] = mixedColor.r;
      colors[i3 + 1] = mixedColor.g;
      colors[i3 + 2] = mixedColor.b;

      // Random star size
      scales[i] = Math.random() * 2.5;
    }

    // Create buffer geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute(
      "rotationOffset",
      new THREE.BufferAttribute(rotationOffsets, 1)
    );
    geometry.setAttribute(
      "initialDistance",
      new THREE.BufferAttribute(initialDistances, 1)
    );
    geometry.setAttribute(
      "initialAngle",
      new THREE.BufferAttribute(initialAngles, 1)
    );

    // Create material with custom shader for galaxy rotation
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float aScale;
        attribute float rotationOffset;
        attribute float initialDistance;
        attribute float initialAngle;
        varying vec3 vColor;
        uniform float uTime;
        uniform float uRotationSpeed;
        uniform float uOscillationSpeed;
        uniform float uOscillationAmplitude;

        void main() {
          vColor = color;
          
          // Calculate differential rotation based on distance from center
          float rotationSpeed = uRotationSpeed / (0.5 + pow(initialDistance * 0.002, 0.7));
          float angle = initialAngle + rotationOffset + uTime * rotationSpeed;
          
          // Calculate new position with differential rotation
          float radius = initialDistance;
          vec3 newPosition = position;
          
          // Apply spiral rotation
          newPosition.x = cos(angle) * radius + position.x - cos(initialAngle) * radius;
          newPosition.z = sin(angle) * radius + position.z - sin(initialAngle) * radius;
          
          // Add gentle vertical oscillation
          float oscillation = sin(uTime * uOscillationSpeed + rotationOffset) * uOscillationAmplitude * radius;
          newPosition.y += oscillation;

          vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);
          gl_PointSize = aScale * (300.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float strength = distance(gl_PointCoord, vec2(0.5));
          strength = 1.0 - strength;
          strength = pow(strength, 3.0);
          vec3 color = mix(vec3(0.0), vColor, strength);
          gl_FragColor = vec4(color, strength);
        }
      `,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      vertexColors: true,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uRotationSpeed: { value: params.rotationSpeed },
        uOscillationSpeed: { value: params.oscillationSpeed },
        uOscillationAmplitude: { value: params.oscillationAmplitude },
      },
    });

    // Create points
    const points = new THREE.Points(geometry, material);
    points.position.set(0, 0, -200); // Push galaxy behind the game scene
    this.scene.add(points);

    // Enhance bloom effect
    const bloomPass = this.composer.passes.find(
      (pass) => pass instanceof THREE.UnrealBloomPass
    );
    if (bloomPass) {
      bloomPass.threshold = 0.1;
      bloomPass.strength = 1;
      bloomPass.radius = 1;
    }

    // Store reference for animation
    this.galaxyPoints = points;
    this.galaxyParams = params;
  }

  setupWebSocket() {
    console.log("Setting up WebSocket...");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${protocol}//${window.location.host}`);

    this.ws.onopen = () => {
      console.log("Connected to server");
      this.connected = true;
      this.loadingProgress.connection = 100;
      this.updateLoadingScreen();
      document.getElementById("connection-status").textContent = "Connected";
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      this.loadingProgress.connection = 100; // Force progress to complete even on error
      this.updateLoadingScreen();
    };

    this.ws.onclose = () => {
      console.log("Disconnected from server");
      this.connected = false;
      document.getElementById("connection-status").textContent = "Disconnected";
    };

    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleServerMessage(message);
    };
  }

  handleServerMessage(message) {
    switch (message.type) {
      case "init":
        this.playerId = message.playerId;
        console.log("Received player ID:", this.playerId);
        // Send player name immediately after receiving playerId
        if (this.playerName) {
          console.log("Sending player name:", this.playerName);
          this.ws.send(
            JSON.stringify({
              type: "join",
              name: this.playerName,
            })
          );
        }
        this.updateGameState(message.gameState);
        break;
      case "gameState":
        this.updateGameState(message.state);
        break;
    }
  }

  setupControls() {
    this.keys = {
      rollLeft: false,
      rollRight: false,
      accelerate: false,
      shoot: false,
    };

    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
    window.addEventListener("keyup", (e) => this.handleKeyUp(e));
    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        // Left click
        this.keys.shoot = true;
        this.sendInputToServer();
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        // Left click
        this.keys.shoot = false;
        this.sendInputToServer();
      }
    });
  }

  handleKeyDown(event) {
    switch (event.key.toLowerCase()) {
      case "q":
        this.keys.rollLeft = true;
        break;
      case "e":
        this.keys.rollRight = true;
        break;
      case " ":
        this.keys.accelerate = true;
        break;
    }
    this.sendInputToServer();
  }

  handleKeyUp(event) {
    switch (event.key.toLowerCase()) {
      case "q":
        this.keys.rollLeft = false;
        break;
      case "e":
        this.keys.rollRight = false;
        break;
      case " ":
        this.keys.accelerate = false;
        break;
    }
    this.sendInputToServer();
  }

  sendInputToServer() {
    if (this.connected) {
      this.ws.send(
        JSON.stringify({
          type: "input",
          keys: this.keys,
        })
      );
    }
  }

  setupMouseControls() {
    // Mouse sensitivity
    this.mouseSensitivity = 0.002;

    // Request pointer lock on canvas click
    this.renderer.domElement.addEventListener("click", () => {
      if (!this.isPointerLocked) {
        this.renderer.domElement.requestPointerLock();
      }
    });

    // Handle pointer lock change
    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked =
        document.pointerLockElement === this.renderer.domElement;
    });

    // Handle mouse movement
    document.addEventListener("mousemove", (event) => {
      if (this.isPointerLocked) {
        // Get the current up vector in world space
        const shipMesh = this.players.get(this.playerId);
        if (!shipMesh) return;

        const upVector = new THREE.Vector3(0, 1, 0);
        upVector.applyQuaternion(shipMesh.quaternion);

        // Determine if we're inverted (more than 90 degrees from up)
        const isInverted = upVector.y < 0;

        // Update orbit angles based on mouse movement, inverting Y when upside down
        this.orbitAngle.y -=
          event.movementX * this.mouseSensitivity * (isInverted ? -1 : 1);
        this.orbitAngle.x += event.movementY * this.mouseSensitivity;

        // Normalize angles to keep them in reasonable range
        this.orbitAngle.x = this.orbitAngle.x % (Math.PI * 2);
        this.orbitAngle.y = this.orbitAngle.y % (Math.PI * 2);

        // Send target rotation to server
        if (this.connected) {
          this.ws.send(
            JSON.stringify({
              type: "rotation",
              rotation: {
                x: this.orbitAngle.x,
                y: this.orbitAngle.y,
              },
            })
          );
        }
      }
    });
  }

  createExplosion(position) {
    console.log("Creating explosion at position:", position); // Debug log
    const explosion = {
      particles: {
        flash: [],
        fire: [],
        smoke: [],
        debris: [],
      },
      time: 0,
      position: position.clone(),
    };

    // Create flash effect (bigger and brighter)
    for (let i = 0; i < 8; i++) {
      const particle = this.explosionParticles.flash.find((p) => !p.visible);
      if (particle) {
        particle.visible = true;
        particle.position.copy(position);
        particle.scale.setScalar(3 + Math.random() * 4); // Much bigger flash
        particle.material.color.setHex(0xffffaa); // Bright yellow-white
        particle.material.opacity = 1;
        particle.userData = {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 16,
            (Math.random() - 0.5) * 16,
            (Math.random() - 0.5) * 16
          ),
          expansion: 8 + Math.random() * 8, // Faster expansion
          maxLifetime: 0.3 + Math.random() * 0.2,
          lifetime: 0,
        };
        explosion.particles.flash.push(particle);
      }
    }

    // Create fire particles (more and more energetic)
    for (let i = 0; i < 30; i++) {
      const particle = this.explosionParticles.fire.find((p) => !p.visible);
      if (particle) {
        particle.visible = true;
        particle.position.copy(position);
        particle.scale.setScalar(2 + Math.random() * 2);
        particle.material.opacity = 1;
        particle.material.color.setHSL(
          0.05 + Math.random() * 0.05,
          1,
          0.7 + Math.random() * 0.3
        );
        particle.userData = {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30,
            (Math.random() - 0.5) * 30
          ),
          expansion: 4 + Math.random() * 4,
          maxLifetime: 0.8 + Math.random() * 0.4,
          lifetime: 0,
        };
        explosion.particles.fire.push(particle);
      }
    }

    // Create smoke particles (bigger and more spread)
    for (let i = 0; i < 35; i++) {
      const particle = this.explosionParticles.smoke.find((p) => !p.visible);
      if (particle) {
        particle.visible = true;
        particle.position.copy(position);
        particle.scale.setScalar(1.5);
        particle.material.opacity = 0.6;
        particle.userData = {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 20,
            2 + Math.random() * 8, // More upward movement
            (Math.random() - 0.5) * 20
          ),
          expansion: 6 + Math.random() * 4,
          maxLifetime: 2 + Math.random(),
          lifetime: 0,
        };
        explosion.particles.smoke.push(particle);
      }
    }

    // Create debris particles (more and faster)
    for (let i = 0; i < 25; i++) {
      const particle = this.explosionParticles.debris.find((p) => !p.visible);
      if (particle) {
        particle.visible = true;
        particle.position.copy(position);
        particle.scale.setScalar(0.4 + Math.random() * 0.6);
        particle.material.color.setHex(0xffaa44); // Orange-ish color
        particle.material.opacity = 1;
        particle.rotation.set(
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2,
          Math.random() * Math.PI * 2
        );
        particle.userData = {
          velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40,
            (Math.random() - 0.5) * 40
          ),
          rotation: new THREE.Vector3(
            Math.random() * 20,
            Math.random() * 20,
            Math.random() * 20
          ),
          maxLifetime: 2 + Math.random(),
          lifetime: 0,
        };
        explosion.particles.debris.push(particle);
      }
    }

    console.log("Created explosion with particles:", {
      flash: explosion.particles.flash.length,
      fire: explosion.particles.fire.length,
      smoke: explosion.particles.smoke.length,
      debris: explosion.particles.debris.length,
    }); // Debug log

    this.explosions.set(Date.now().toString(), explosion);

    // Play explosion sound
    this.playExplosionSound();
  }

  updateExplosions(deltaTime) {
    this.explosions.forEach((explosion, id) => {
      explosion.time += deltaTime;

      // Update flash particles
      explosion.particles.flash.forEach((particle) => {
        particle.userData.lifetime += deltaTime;
        const lifeProgress =
          particle.userData.lifetime / particle.userData.maxLifetime;
        if (lifeProgress >= 1) {
          particle.visible = false;
        } else {
          particle.position.add(
            particle.userData.velocity.clone().multiplyScalar(deltaTime)
          );
          particle.scale.addScalar(particle.userData.expansion * deltaTime);
          particle.material.opacity = (1 - lifeProgress) * 1;
        }
      });

      // Update fire particles
      explosion.particles.fire.forEach((particle) => {
        particle.userData.lifetime += deltaTime;
        const lifeProgress =
          particle.userData.lifetime / particle.userData.maxLifetime;
        if (lifeProgress >= 1) {
          particle.visible = false;
        } else {
          particle.position.add(
            particle.userData.velocity.clone().multiplyScalar(deltaTime)
          );
          particle.scale.addScalar(particle.userData.expansion * deltaTime);
          particle.material.opacity = (1 - lifeProgress) * 1;
          const hue = 0.05 + lifeProgress * 0.05;
          const saturation = 1;
          const lightness = Math.max(0.5, 0.9 - lifeProgress * 0.6);
          particle.material.color.setHSL(hue, saturation, lightness);
        }
      });

      // Update smoke particles
      explosion.particles.smoke.forEach((particle) => {
        particle.userData.lifetime += deltaTime;
        const lifeProgress =
          particle.userData.lifetime / particle.userData.maxLifetime;
        if (lifeProgress >= 1) {
          particle.visible = false;
        } else {
          particle.position.add(
            particle.userData.velocity.clone().multiplyScalar(deltaTime)
          );
          particle.scale.addScalar(particle.userData.expansion * deltaTime);
          particle.material.opacity = Math.max(0, 0.6 * (1 - lifeProgress));
        }
      });

      // Update debris particles
      explosion.particles.debris.forEach((particle) => {
        particle.userData.lifetime += deltaTime;
        const lifeProgress =
          particle.userData.lifetime / particle.userData.maxLifetime;
        if (lifeProgress >= 1) {
          particle.visible = false;
        } else {
          particle.userData.velocity.y -= 20 * deltaTime; // Stronger gravity
          particle.position.add(
            particle.userData.velocity.clone().multiplyScalar(deltaTime)
          );
          particle.rotation.x += particle.userData.rotation.x * deltaTime;
          particle.rotation.y += particle.userData.rotation.y * deltaTime;
          particle.rotation.z += particle.userData.rotation.z * deltaTime;
          particle.material.opacity = 1 - lifeProgress * lifeProgress;
        }
      });

      // Remove explosion if all particles are done
      if (explosion.time > 3) {
        // Longer duration
        Object.values(explosion.particles)
          .flat()
          .forEach((particle) => {
            particle.visible = false;
          });
        this.explosions.delete(id);
      }
    });
  }

  loadModel(shipGroup) {
    // Clone the loaded model for each player
    const shipMesh = this.shipModel.clone();

    shipMesh.rotateY(-Math.PI / 2);

    // Color adjustment for player identification
    shipMesh.traverse((child) => {
      if (child.isMesh) {
        // Ensure we clone the material
        child.material = child.material.clone();

        // Enhance the base material
        child.material.metalness = 0.8;
        child.material.roughness = 0.2;
      }
    });

    shipGroup.add(shipMesh);
  }

  updateGameState(state) {
    // Update projectiles
    const currentProjectileIds = new Set(state.projectiles.map((p) => p.id));

    // Remove old projectiles
    this.projectiles.forEach((mesh, id) => {
      if (!currentProjectileIds.has(id)) {
        this.scene.remove(mesh);
        this.projectiles.delete(id);
      }
    });

    // Update or create new projectiles
    state.projectiles.forEach((projectileData) => {
      let projectileMesh = this.projectiles.get(projectileData.id);

      if (!projectileMesh) {
        projectileMesh = new THREE.Mesh(
          this.projectileGeometry,
          this.projectileMaterial
        );
        this.projectiles.set(projectileData.id, projectileMesh);
        this.scene.add(projectileMesh);
        this.playShootSound();
      }

      projectileMesh.position.set(
        projectileData.position.x,
        projectileData.position.y,
        projectileData.position.z
      );
    });

    // Update scoreboard
    const playerList = document.getElementById("player-list");
    playerList.innerHTML = Array.from(state.players.values())
      .sort((a, b) => b.score - a.score)
      .map(
        (p) => `
        <div>${p.id === this.playerId ? "You" : p.name || "Player"}: ${
          p.score
        } points</div>
      `
      )
      .join("");

    // Update players
    state.players.forEach((playerData) => {
      const wasAlive =
        this.players.has(playerData.id) &&
        this.players.get(playerData.id).visible;

      if (!this.players.has(playerData.id)) {
        // Create ship mesh using custom model if available
        const shipGroup = new THREE.Group();

        if (!this.shipModel) {
          return;
        }

        if (
          !playerData.name ||
          playerData.name === "" ||
          playerData.name === "Player"
        ) {
          return;
        }

        const bodyMesh = new THREE.Mesh();
        shipGroup.add(bodyMesh);
        const wings = new THREE.Mesh();
        shipGroup.add(wings);

        // Create engine glow group
        const engineGroup = new THREE.Group();
        engineGroup.position.x = 2.5;
        engineGroup.position.y = 0.9;
        shipGroup.add(engineGroup);

        // Core glow (intense center)
        const coreGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const coreMaterial = new THREE.MeshBasicMaterial({
          color: playerData.id === this.playerId ? 0x00ffaa : 0xff0000,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
        });
        const coreGlow = new THREE.Mesh(coreGeometry, coreMaterial);
        engineGroup.add(coreGlow);

        // Outer glow (softer, larger)
        const outerGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const outerMaterial = new THREE.MeshBasicMaterial({
          color: playerData.id === this.playerId ? 0x00ff88 : 0xff0000,
          transparent: true,
          opacity: 0.4,
          blending: THREE.AdditiveBlending,
        });
        const outerGlow = new THREE.Mesh(outerGeometry, outerMaterial);
        engineGroup.add(outerGlow);

        // Flame cone
        const coneGeometry = new THREE.ConeGeometry(0.2, 0.8, 16);
        coneGeometry.rotateZ(Math.PI / 2);
        const coneMaterial = new THREE.MeshBasicMaterial({
          color: playerData.id === this.playerId ? 0x00ff66 : 0xff8800,
          transparent: true,
          opacity: 0.3,
          blending: THREE.AdditiveBlending,
        });
        const flameCone = new THREE.Mesh(coneGeometry, coneMaterial);
        flameCone.rotation.z = Math.PI;
        flameCone.position.x = 0.4;
        flameCone.position.y = -0.2;
        engineGroup.add(flameCone);

        // Particle system for engine exhaust
        const particleCount = 20;
        const particles = new THREE.Group();
        for (let i = 0; i < particleCount; i++) {
          const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
          const particleMaterial = new THREE.MeshBasicMaterial({
            color: playerData.id === this.playerId ? 0x00ff44 : 0xffaa00,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
          });
          const particle = new THREE.Mesh(particleGeometry, particleMaterial);
          particle.visible = false;
          particle.userData = {
            velocity: new THREE.Vector3(),
            lifetime: 0,
            maxLifetime: 0.5 + Math.random() * 0.5,
          };
          particles.add(particle);
        }
        engineGroup.add(particles);

        // Create player HUD elements (health bar and name)
        const hudGroup = new THREE.Group();
        hudGroup.position.y = 2; // Position above the ship
        // Create name tag
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext("2d");
        context.font = "bold 32px Arial";
        context.textAlign = "center";
        context.fillStyle = "#ffffff";
        context.fillText(
          playerData.id === this.playerId ? "You" : playerData.name || "Player",
          canvas.width / 2,
          40
        );

        const nameTexture = new THREE.CanvasTexture(canvas);
        const nameMaterial = new THREE.SpriteMaterial({
          map: nameTexture,
          transparent: true,
          opacity: 1,
          depthTest: false,
          sizeAttenuation: false, // Keep constant size regardless of distance
        });
        const nameSprite = new THREE.Sprite(nameMaterial);
        nameSprite.scale.set(0.15, 0.04, 1); // Adjusted scale for non-attenuated size
        nameSprite.position.y = 0.5;
        hudGroup.add(nameSprite);

        // Create health bar fill only (no background)
        const healthBarFillSprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 1,
            depthTest: false,
            sizeAttenuation: true, // Keep constant size regardless of distance
          })
        );
        healthBarFillSprite.scale.set(1, 0.15, 1); // Adjusted scale for non-attenuated size
        hudGroup.add(healthBarFillSprite);

        shipGroup.add(hudGroup);

        if (this.shipModel) {
          this.loadModel(shipGroup);
          this.loadingProgress.model = 100;
          this.updateLoadingScreen();
        }

        this.players.set(playerData.id, shipGroup);
        this.scene.add(shipGroup);
      }

      const shipMesh = this.players.get(playerData.id);

      // Track previous health to detect damage
      const previousHealth = shipMesh.userData.health || playerData.health;
      shipMesh.userData.health = playerData.health;

      // Create hit effect when damage is taken
      if (playerData.health < previousHealth) {
        this.createHitEffect(shipMesh.position);
      }

      // Handle death/respawn
      if (!playerData.isAlive) {
        if (wasAlive) {
          // Player just died, create explosion
          console.log("Player died, triggering explosion"); // Debug log
          this.createExplosion(shipMesh.position.clone());

          // Stop engine sound if it's the local player
          if (playerData.id === this.playerId && this.sounds.engine) {
            this.sounds.engine.setVolume(0);
          }

          // Show respawn message if it's the local player
          if (playerData.id === this.playerId) {
            const respawnMessage = document.getElementById("respawn-message");
            respawnMessage.style.display = "block";
          }
        }

        // Update respawn timer for local player
        if (playerData.id === this.playerId) {
          const respawnTimer = document.getElementById("respawn-timer");
          respawnTimer.textContent = Math.ceil(playerData.respawnTime);
        }

        shipMesh.visible = false;
        return;
      } else {
        // Hide respawn message when alive
        if (playerData.id === this.playerId) {
          const respawnMessage = document.getElementById("respawn-message");
          respawnMessage.style.display = "none";
        }
        shipMesh.visible = true;
      }

      // Update position and rotation
      shipMesh.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
      );

      if (playerData.quaternion) {
        shipMesh.quaternion.set(
          playerData.quaternion.x,
          playerData.quaternion.y,
          playerData.quaternion.z,
          playerData.quaternion.w
        );

        // Update HUD elements to face camera
        const hudGroup = shipMesh.children[3]; // HUD is the fourth child
        if (hudGroup) {
          // Update health bar
          const healthBarFill = hudGroup.children[1]; // Health bar fill is now the second child of hudGroup
          const healthPercent = playerData.health / 100;

          // Update health bar fill scale and position
          healthBarFill.scale.x = Math.max(0, healthPercent);
          healthBarFill.position.x = (healthPercent - 1) / 2;

          // Update health bar color based on health percentage
          const healthBarFillMaterial = healthBarFill.material;
          if (healthPercent > 0.6) {
            healthBarFillMaterial.color.setHex(0x00ff00); // Green
          } else if (healthPercent > 0.3) {
            healthBarFillMaterial.color.setHex(0xffff00); // Yellow
          } else {
            healthBarFillMaterial.color.setHex(0xff0000); // Red
          }

          // Hide HUD for local player (since we have the 2D HUD)
          if (playerData.id === this.playerId) {
            hudGroup.visible = false;
          } else {
            hudGroup.visible = playerData.isAlive;
          }
        }

        // Update engine glow based on acceleration
        const engineGroup = shipMesh.children[2];
        const [coreGlow, outerGlow, flameCone, particles] =
          engineGroup.children;

        if (playerData.speed > 0) {
          const speedFactor = playerData.speed;
          // Update core glow
          coreGlow.scale.setScalar(1 + speedFactor * 0.5);
          coreGlow.material.opacity = Math.min(0.9, 0.6 + speedFactor * 0.3);

          // Update outer glow
          outerGlow.scale.setScalar(1 + speedFactor * 0.7);
          outerGlow.material.opacity = Math.min(0.4, 0.2 + speedFactor * 0.2);

          // Update flame cone
          flameCone.scale.set(
            0.8 + speedFactor * 0.3,
            0.8 + speedFactor,
            0.8 + speedFactor * 0.3
          );
          flameCone.material.opacity = Math.min(0.3, 0.1 + speedFactor * 0.2);

          // Update particles
          const deltaTime = 1 / 120;
          particles.children.forEach((particle) => {
            if (!particle.visible) {
              // Initialize new particle
              particle.visible = true;
              particle.position.set(0.2, 0, 0);
              particle.userData.lifetime = 0;
              particle.userData.velocity
                .set(
                  (Math.random() - 0.5) * 2,
                  (Math.random() - 0.5) * 2,
                  (Math.random() - 0.5) * 2
                )
                .multiplyScalar(speedFactor * 2);
            }

            // Update particle position
            particle.position.add(
              particle.userData.velocity.clone().multiplyScalar(deltaTime)
            );
            particle.userData.lifetime += deltaTime;

            // Update particle appearance
            const lifeProgress =
              particle.userData.lifetime / particle.userData.maxLifetime;
            if (lifeProgress >= 1) {
              particle.visible = false;
            } else {
              particle.material.opacity = 0.5 * (1 - lifeProgress);
              particle.scale.setScalar(1 - lifeProgress * 0.5);
            }
          });
        } else {
          // Reset engine effects when not moving
          coreGlow.scale.setScalar(1);
          coreGlow.material.opacity = 0.6;
          outerGlow.scale.setScalar(1);
          outerGlow.material.opacity = 0.2;
          flameCone.scale.set(0.8, 0.8, 0.8);
          flameCone.material.opacity = 0;
          particles.children.forEach((particle) => {
            particle.visible = false;
          });
        }

        // Update HUD and camera if this is the local player
        if (playerData.id === this.playerId) {
          // Update health display
          const healthFill = document.getElementById("health-fill");
          if (healthFill) {
            healthFill.style.width = `${Math.max(0, playerData.health)}%`;
          }

          // Update score
          const scoreElement = document.getElementById("score");
          if (scoreElement) {
            scoreElement.textContent = playerData.score;
          }

          if (playerData.isAlive) {
            // Update aim indicator position
            if (shipMesh) {
              // Get ship's forward direction
              const forward = new THREE.Vector3(1, 0, 0); // Changed to point along X-axis
              forward.applyQuaternion(shipMesh.quaternion);

              // Position the aim indicator ahead of the ship
              const aimDistance = -20;
              const aimPosition = new THREE.Vector3(
                playerData.position.x + forward.x * aimDistance,
                playerData.position.y + forward.y * aimDistance,
                playerData.position.z + forward.z * aimDistance
              );

              // Update aim indicator
              this.aimIndicator.position.copy(aimPosition);
              this.aimIndicator.lookAt(this.camera.position);
              this.aimIndicator.visible = true;
            }

            const upVector = new THREE.Vector3(0, 1, 0);
            upVector.applyQuaternion(shipMesh.quaternion);

            // Camera settings
            const cameraDistance = 5;
            const heightOffset = 3;

            // Calculate offset vector in ship's local space
            const offsetVector = new THREE.Vector3(0, heightOffset, 0);
            offsetVector.applyQuaternion(shipMesh.quaternion);

            // Calculate camera position using spherical coordinates plus the offset
            const cameraX =
              playerData.position.x +
              offsetVector.x +
              cameraDistance *
                Math.cos(-this.orbitAngle.y) *
                Math.cos(this.orbitAngle.x);
            const cameraY =
              playerData.position.y +
              offsetVector.y +
              cameraDistance * Math.sin(this.orbitAngle.x);
            const cameraZ =
              playerData.position.z +
              offsetVector.z +
              cameraDistance *
                Math.sin(-this.orbitAngle.y) *
                Math.cos(this.orbitAngle.x);

            // Smoothly update camera position
            this.camera.position.lerp(
              new THREE.Vector3(cameraX, cameraY, cameraZ),
              0.1
            );

            // Make camera look at the ship with offset for lower position
            const lookAtOffset = new THREE.Vector3(0, 2, 0); // Base offset
            lookAtOffset.applyQuaternion(shipMesh.quaternion); // Apply ship's rotation to the offset
            const lookAtPoint = new THREE.Vector3()
              .copy(shipMesh.position)
              .add(lookAtOffset);
            this.camera.lookAt(lookAtPoint);

            // Adjust camera up vector based on ship's orientation
            this.camera.up.copy(upVector);
          } else {
            this.aimIndicator.visible = false;
          }
        }
      }

      // Update engine sound for local player
      if (playerData.id === this.playerId) {
        this.updateEngineSoundVolume(playerData.speed);
      }
    });

    // Remove disconnected players
    this.players.forEach((mesh, id) => {
      if (!state.players.find((p) => p.id === id)) {
        this.scene.remove(mesh);
        this.players.delete(id);
      }
    });
  }

  // Update the aim indicator color based on shooting cooldown
  updateAimIndicator(canShoot) {
    const color = canShoot ? 0x00ff00 : 0xff0000;
    this.aimIndicator.material.color.setHex(color);
  }

  createHitEffect(position) {
    const particleCount = 15;
    const particles = [];

    for (let i = 0; i < particleCount; i++) {
      const particle = this.hitParticles.find((p) => !p.visible);
      if (particle) {
        particle.visible = true;
        particle.position.copy(position);
        particle.userData.lifetime = 0;

        // Random velocity in all directions
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 2 + Math.random() * 3;

        particle.userData.velocity.set(
          speed * Math.sin(phi) * Math.cos(theta),
          speed * Math.sin(phi) * Math.sin(theta),
          speed * Math.cos(phi)
        );

        particles.push(particle);
      }
    }

    // Play hit sound
    this.playHitSound();

    return particles;
  }

  updateHitParticles(deltaTime) {
    this.hitParticles.forEach((particle) => {
      if (particle.visible) {
        particle.position.add(
          particle.userData.velocity.clone().multiplyScalar(deltaTime)
        );
        particle.userData.lifetime += deltaTime;

        const lifeProgress =
          particle.userData.lifetime / particle.userData.maxLifetime;
        if (lifeProgress >= 1) {
          particle.visible = false;
        } else {
          particle.material.opacity = 1 - lifeProgress;
          particle.scale.setScalar(1 - lifeProgress * 0.5);
        }
      }
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = 1 / 60;
    this.updateExplosions(deltaTime);
    this.updateHitParticles(deltaTime);

    // Update galaxy rotation
    if (this.galaxyPoints && this.galaxyPoints.material.uniforms) {
      this.galaxyPoints.material.uniforms.uTime.value += deltaTime;
    }

    // Update galaxy light
    if (this.galaxyLight) {
      // Pulsing intensity
      const pulseIntensity =
        this.galaxyLightIntensity.base +
        Math.sin(Date.now() * 0.001 * this.galaxyLightIntensity.speed) *
          this.galaxyLightIntensity.variation;

      this.galaxyLight.intensity = pulseIntensity;

      // Animate light color
      const time = Date.now() * 0.0005;
      const colorMix = (Math.sin(time) + 1) * 0.5;
      const currentColor = new THREE.Color();
      currentColor
        .copy(this.galaxyColors.inside)
        .lerp(this.galaxyColors.outside, colorMix);
      this.galaxyLight.color.copy(currentColor);
    }

    // Update skybox position to follow camera
    if (this.skybox) {
      this.skybox.position.copy(this.camera.position);
    }

    // Pulse the aim indicator
    if (this.aimIndicator.visible) {
      const pulseSpeed = 2;
      const pulseMin = 0.3;
      const pulseMax = 0.7;
      const pulse =
        pulseMin +
        (Math.sin(Date.now() * 0.003 * pulseSpeed) + 1) *
          0.5 *
          (pulseMax - pulseMin);
      this.aimIndicator.material.opacity = pulse;
    }

    // Render with post-processing
    this.composer.render();
  }

  updateLoadingScreen() {
    // Calculate total progress
    this.loadingProgress.total =
      (this.loadingProgress.model + this.loadingProgress.connection) / 2;

    console.log("Loading Progress:", {
      model: this.loadingProgress.model,
      connection: this.loadingProgress.connection,
      total: this.loadingProgress.total,
    });

    // Update loading bar
    const progressBar = document.getElementById("loading-progress");
    const loadingText = document.getElementById("loading-text");
    const loadingScreen = document.getElementById("loading-screen");

    if (progressBar) {
      progressBar.style.width = `${this.loadingProgress.total}%`;
    }

    // Update loading text
    if (loadingText) {
      if (this.loadingProgress.model < 100) {
        loadingText.textContent = `Loading model... ${Math.floor(
          this.loadingProgress.model
        )}%`;
      } else if (this.loadingProgress.connection < 100) {
        loadingText.textContent = "Connecting to server...";
      }
    }

    // Hide loading screen when everything is ready
    if (this.loadingProgress.total >= 100 && this.shipModel) {
      console.log("Loading complete, hiding loading screen");
      loadingScreen.style.opacity = "0";
      setTimeout(() => {
        loadingScreen.style.display = "none";
      }, 500);
    }
  }

  loadSounds() {
    if (!this.audioListener) return;

    const audioLoader = new THREE.AudioLoader();

    // Load engine sound (looping)
    this.sounds.engine = new THREE.Audio(this.audioListener);
    audioLoader.load("/sounds/engine_thrust.mp3", (buffer) => {
      this.sounds.engine.setBuffer(buffer);
      this.sounds.engine.setLoop(true);
      this.sounds.engine.setVolume(0);
      this.sounds.engine.play();
    });

    // Load laser shoot sound
    this.sounds.shoot = new THREE.Audio(this.audioListener);
    audioLoader.load("/sounds/laser_shoot.mp3", (buffer) => {
      this.sounds.shoot.setBuffer(buffer);
      this.sounds.shoot.setVolume(1);
    });

    // Load explosion sound
    this.sounds.explosion = new THREE.Audio(this.audioListener);
    audioLoader.load("/sounds/explosion.mp3", (buffer) => {
      this.sounds.explosion.setBuffer(buffer);
      this.sounds.explosion.setVolume(0.7);
    });

    // Load hit sound
    this.sounds.hit = new THREE.Audio(this.audioListener);
    audioLoader.load("/sounds/hit.mp3", (buffer) => {
      this.sounds.hit.setBuffer(buffer);
      this.sounds.hit.setVolume(0.6);
    });

    // Load and play ambient space sound
    this.sounds.ambient = new THREE.Audio(this.audioListener);
    audioLoader.load("/sounds/space_ambient.mp3", (buffer) => {
      this.sounds.ambient.setBuffer(buffer);
      this.sounds.ambient.setLoop(true);
      this.sounds.ambient.setVolume(1);
      this.sounds.ambient.play();
    });
  }

  // Modify sound playing methods to check for initialization
  playShootSound() {
    if (this.audioInitialized && this.sounds.shoot) {
      // Stop any currently playing shoot sound
      if (this.sounds.shoot.isPlaying) {
        this.sounds.shoot.stop();
      }

      this.sounds.shoot.play();
    }
  }

  playExplosionSound() {
    if (this.audioInitialized && this.sounds.explosion) {
      if (this.sounds.explosion.isPlaying) {
        this.sounds.explosion.stop();
      }
      this.sounds.explosion.play();
    }
  }

  playHitSound() {
    if (this.audioInitialized && this.sounds.hit) {
      if (this.sounds.hit.isPlaying) {
        this.sounds.hit.stop();
      }
      this.sounds.hit.play();
    }
  }

  updateEngineSoundVolume(speed) {
    if (this.audioInitialized && this.sounds.engine) {
      const targetVolume = Math.min(0.7, speed * 0.5);
      this.sounds.engine.setVolume(targetVolume);
    }
  }
}

// Don't automatically start the game, wait for menu interaction
window.onload = () => {
  new GameClient();
};
