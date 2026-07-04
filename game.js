/* =========================
   GRAND TOURING - RACING GAME
   Built with Three.js
========================= */

class Game {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 2000);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLights();

    // World
    this.world = new World(this.scene);
    this.car = new Car(this.scene);
    this.traffic = new Traffic(this.scene);
    this.checkpoints = new Checkpoints(this.scene);
    this.weather = new Weather(this.scene);
    this.particles = new Particles(this.scene);

    this.camera.position.set(0, 6, 10);

    // Game State
    this.gameOver = false;
    this.startTime = Date.now();
    this.checkpointTimes = [];

    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    this.loop();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    this.sun = new THREE.DirectionalLight(0xffffff, 1.2);
    this.sun.position.set(100, 150, 50);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.far = 500;
    this.sun.shadow.camera.left = -300;
    this.sun.shadow.camera.right = 300;
    this.sun.shadow.camera.top = 300;
    this.sun.shadow.camera.bottom = -300;
    this.scene.add(this.sun);

    this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.002);
  }

  loop() {
    requestAnimationFrame(() => this.loop());

    if (!this.gameOver) {
      this.car.update(this.weather);
      this.traffic.update(this.car);
      this.checkpoints.update(this.car);
      this.weather.update(this.scene, this.car);
      this.particles.update();

      // Collision detection
      this.checkCollisions();
    }

    // Camera follow car
    this.updateCamera();

    // UI Update
    UI.update(this.car, this.checkpoints, this.weather);
    this.updateMiniMap();

    this.renderer.render(this.scene, this.camera);
  }

  checkCollisions() {
    // Car to traffic
    this.traffic.cars.forEach(trafficCar => {
      const distance = this.car.mesh.position.distanceTo(trafficCar.position);
      if (distance < 3) {
        this.car.speed *= 0.6;
        this.particles.crash(this.car.mesh.position);
      }
    });
  }

  updateCamera() {
    const targetX = this.car.mesh.position.x;
    const targetZ = this.car.mesh.position.z + 14;

    this.camera.position.x += (targetX - this.camera.position.x) * 0.08;
    this.camera.position.z += (targetZ - this.camera.position.z) * 0.08;
    this.camera.lookAt(this.car.mesh.position);
  }

  updateMiniMap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    // Scale
    const scale = 0.8;

    // Draw road
    ctx.fillStyle = '#444';
    ctx.fillRect(w / 2 - 60 * scale / 2, 0, 60 * scale, h);

    // Draw checkpoints
    ctx.fillStyle = '#ffff00';
    this.checkpoints.list.forEach((cp, i) => {
      const x = w / 2 + (cp.x * scale) / 3;
      const y = h / 2 + (cp.z * scale) / 3;
      ctx.fillRect(x - 3, y - 3, 6, 6);
    });

    // Draw car
    ctx.fillStyle = '#00ff00';
    const carX = w / 2 + (this.car.mesh.position.x * scale) / 3;
    const carY = h / 2 + (this.car.mesh.position.z * scale) / 3;
    ctx.fillRect(carX - 4, carY - 4, 8, 8);

    // Draw traffic
    ctx.fillStyle = '#ff0000';
    this.traffic.cars.forEach(tc => {
      const tcX = w / 2 + (tc.position.x * scale) / 3;
      const tcY = h / 2 + (tc.position.z * scale) / 3;
      ctx.fillRect(tcX - 2, tcY - 2, 4, 4);
    });
  }

  onWindowResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  handleKeyDown(e) {
    switch (e.key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        input.gasActive = true;
        break;
      case 'arrowdown':
      case 's':
        input.brakeActive = true;
        break;
      case 'arrowleft':
      case 'a':
        input.dir = -1;
        break;
      case 'arrowright':
      case 'd':
        input.dir = 1;
        break;
    }
  }

  handleKeyUp(e) {
    switch (e.key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        input.gasActive = false;
        break;
      case 'arrowdown':
      case 's':
        input.brakeActive = false;
        break;
      case 'arrowleft':
      case 'a':
      case 'arrowright':
      case 'd':
        input.dir = 0;
        break;
    }
  }

  finishRace() {
    this.gameOver = true;
    const time = ((Date.now() - this.startTime) / 1000).toFixed(2);
    const finalStats = `
      Final Credits: ${UI.credits}<br>
      Time: ${time}s<br>
      Checkpoints: ${this.checkpoints.index}/10
    `;
    document.getElementById('finalStats').innerHTML = finalStats;
    document.getElementById('gameOver').style.display = 'block';
  }
}

/* =========================
   WORLD
========================= */
class World {
  constructor(scene) {
    // Ground
    const groundGeo = new THREE.PlaneGeometry(800, 1000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1f5f1f,
      roughness: 0.9,
      metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Road
    const roadGeo = new THREE.PlaneGeometry(120, 1000);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.3,
      metalness: 0.2
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    road.position.z = 0;
    scene.add(road);

    // Road lines
    for (let i = 0; i < 15; i++) {
      const lineGeo = new THREE.PlaneGeometry(120, 5);
      const lineMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
      const line = new THREE.Mesh(lineGeo, lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.z = -i * 70;
      line.position.y = 0.01;
      scene.add(line);
    }

    // Trees
    for (let i = 0; i < 20; i++) {
      const treeGeo = new THREE.CylinderGeometry(3, 3, 15, 8);
      const treeMat = new THREE.MeshStandardMaterial({ color: 0x2d5016 });
      const tree = new THREE.Mesh(treeGeo, treeMat);
      tree.position.set(Math.random() * 300 - 150, 7.5, Math.random() * -800 - 100);
      tree.castShadow = true;
      scene.add(tree);
    }
  }
}

/* =========================
   CAR PHYSICS
========================= */
class Car {
  constructor(scene) {
    const carGeo = new THREE.BoxGeometry(2, 1, 4);
    const carMat = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      roughness: 0.3,
      metalness: 0.7
    });
    this.mesh = new THREE.Mesh(carGeo, carMat);
    this.mesh.position.y = 0.5;
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.speed = 0;
    this.maxSpeed = 1.5;
    this.acceleration = 0.05;
    this.friction = 0.97;
  }

  update(weather) {
    // Input
    if (input.gasActive) {
      this.speed = Math.min(this.speed + this.acceleration, this.maxSpeed);
    }
    if (input.brakeActive) {
      this.speed = Math.max(this.speed - 0.08, 0);
    }

    // Weather effects
    let grip = weather.state === 'Rain' ? 0.85 : 1;
    if (weather.state === 'Night') grip *= 0.95;

    // Turning
    this.mesh.rotation.y += input.dir * 0.025 * grip;

    // Movement
    this.mesh.position.x += Math.sin(this.mesh.rotation.y) * this.speed * 0.15;
    this.mesh.position.z += Math.cos(this.mesh.rotation.y) * this.speed * 0.15;

    // Friction
    this.speed *= this.friction;

    // Bounds check
    if (Math.abs(this.mesh.position.x) > 150) {
      this.speed *= 0.5;
      this.mesh.position.x = Math.sign(this.mesh.position.x) * 150;
    }
  }
}

/* =========================
   TRAFFIC AI
========================= */
class Traffic {
  constructor(scene) {
    this.cars = [];

    for (let i = 0; i < 15; i++) {
      const carGeo = new THREE.BoxGeometry(2, 1, 4);
      const carMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(Math.random(), 0.7, 0.6),
        roughness: 0.4
      });
      const car = new THREE.Mesh(carGeo, carMat);
      car.position.set(Math.random() * 100 - 50, 0.5, Math.random() * -600);
      car.castShadow = true;
      scene.add(car);

      this.cars.push({
        mesh: car,
        speed: 0.3 + Math.random() * 0.3,
        get position() { return this.mesh.position; }
      });
    }
  }

  update(playerCar) {
    this.cars.forEach(car => {
      // Move forward
      car.mesh.position.z += car.speed;

      // Reset if off screen
      if (car.mesh.position.z > 150) {
        car.mesh.position.z = -600;
        car.mesh.position.x = Math.random() * 100 - 50;
      }

      // Simple AI - avoid player
      const dx = playerCar.mesh.position.x - car.mesh.position.x;
      if (Math.abs(dx) < 15 && Math.abs(playerCar.mesh.position.z - car.mesh.position.z) < 30) {
        car.mesh.position.x += Math.sign(dx) > 0 ? -0.3 : 0.3;
      }
    });
  }
}

/* =========================
   CHECKPOINTS
========================= */
class Checkpoints {
  constructor(scene) {
    this.list = [];
    this.index = 0;
    this.passed = new Set();

    for (let i = 0; i < 10; i++) {
      this.list.push({
        x: Math.random() * 60 - 30,
        z: -i * 70,
        id: i
      });
    }
  }

  update(car) {
    const cp = this.list[this.index];
    if (!cp) {
      if (!this.raceFinished) {
        this.raceFinished = true;
        game.finishRace();
      }
      return;
    }

    const dx = car.mesh.position.x - cp.x;
    const dz = car.mesh.position.z - cp.z;
    const distance = Math.sqrt(dx * dx + dz * dz);

    if (distance < 10 && !this.passed.has(cp.id)) {
      this.passed.add(cp.id);
      this.index++;
      UI.credits += 100;

      // Checkpoint effect
      const indicator = document.getElementById('checkpoint-indicator');
      indicator.textContent = `CHECKPOINT ${this.index}! ✓`;
      indicator.classList.add('show');
      setTimeout(() => indicator.classList.remove('show'), 800);

      game.particles.checkpoint(car.mesh.position);
    }
  }
}

/* =========================
   WEATHER SYSTEM
========================= */
class Weather {
  constructor(scene) {
    this.state = 'Clear';
    this.timer = 0;
  }

  update(scene, car) {
    this.timer++;

    if (this.timer % 1800 === 0) {
      const r = Math.random();
      this.state = r < 0.6 ? 'Clear' : r < 0.85 ? 'Rain' : 'Night';
    }

    // Adjust lighting & fog
    if (this.state === 'Night') {
      scene.background = new THREE.Color(0x0a0a1a);
      scene.fog = new THREE.FogExp2(0x0a0a1a, 0.005);
    } else if (this.state === 'Rain') {
      scene.background = new THREE.Color(0x4a4a5a);
      scene.fog = new THREE.FogExp2(0x4a4a5a, 0.004);
    } else {
      scene.background = new THREE.Color(0x87CEEB);
      scene.fog = new THREE.FogExp2(0x9db3b5, 0.002);
    }
  }
}

/* =========================
   PARTICLE EFFECTS
========================= */
class Particles {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
  }

  crash(pos) {
    for (let i = 0; i < 10; i++) {
      const geo = new THREE.SphereGeometry(0.1, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff6600 });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(pos);
      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.2
      );
      particle.life = 1;
      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  checkpoint(pos) {
    for (let i = 0; i < 15; i++) {
      const geo = new THREE.SphereGeometry(0.15, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
      const particle = new THREE.Mesh(geo, mat);
      particle.position.copy(pos);
      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.4,
        (Math.random() - 0.5) * 0.3
      );
      particle.life = 1;
      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.position.add(p.velocity);
      p.velocity.y -= 0.01; // Gravity
      p.life -= 0.03;
      p.material.opacity = p.life;

      if (p.life <= 0) {
        this.scene.remove(p);
        this.particles.splice(i, 1);
      }
    }
  }
}

/* =========================
   INPUT HANDLER
========================= */
const input = {
  dir: 0,
  gasActive: false,
  brakeActive: false,

  gas() {
    this.gasActive = true;
  },

  stopGas() {
    this.gasActive = false;
  },

  brake() {
    this.brakeActive = true;
  },

  stopBrake() {
    this.brakeActive = false;
  },

  turn(v) {
    this.dir = v;
  },

  stopTurn() {
    this.dir = 0;
  }
};

/* =========================
   UI MANAGER
========================= */
const UI = {
  credits: 0,

  update(car, checkpoints, weather) {
    const speed = Math.round(car.speed * 80);
    document.getElementById('speed').textContent = speed;
    document.getElementById('credits').textContent = this.credits;
    document.getElementById('checkpoint').textContent = checkpoints.index;
    document.getElementById('weather').textContent = weather.state;
    document.getElementById('laps').textContent = Math.floor(checkpoints.index / 10);

    // Speed bar
    const speedPercent = Math.min(100, (speed / 120) * 100);
    document.getElementById('speed-bar-fill').style.width = speedPercent + '%';
  }
};

/* =========================
   GAME CONTROLS
========================= */
function toggleSpeed() {
  game.car.maxSpeed = game.car.maxSpeed === 1.5 ? 2.5 : 1.5;
  const bonus = game.car.maxSpeed > 1.5 ? ' (BOOSTED!)' : '';
  alert('Max Speed Changed' + bonus);
}

function resetGame() {
  game.car.speed = 0;
  game.car.mesh.position.set(0, 0.5, 0);
  game.car.mesh.rotation.y = 0;
  game.checkpoints.index = 0;
  game.checkpoints.passed.clear();
  UI.credits = 0;
  game.gameOver = false;
  game.startTime = Date.now();
  document.getElementById('gameOver').style.display = 'none';
}

/* =========================
   START GAME
========================= */
const game = new Game();
console.log('Grand Touring Game Started! 🏎️');