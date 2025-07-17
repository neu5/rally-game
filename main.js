import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

let scene, camera, renderer;
let car;
const keys = {};

// Car physics state
let velocity = 0;
const maxSpeed = 0.5;
const acceleration = 0.01;
const deceleration = 0.02;
const friction = 0.01;
const rotateSpeed = 0.03;
let angularVelocity = 0;
const angularAcceleration = 0.002;
const angularFriction = 0.01;
const maxAngularSpeed = 0.03;
const handbrakeAngularBoost = 1.8; // Multiplies turning sharpness
const handbrakeFrictionMultiplier = 0.4; // Reduces grip

// Setup
init();
animate();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  // Camera (top-down with adjustable angle)
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 50, 0);
  camera.lookAt(0, 0, 0);

  // Renderer
  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("gameCanvas"),
  });
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // Ground
  const groundGeometry = new THREE.PlaneGeometry(200, 200);
  const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Car
  const carGeometry = new THREE.BoxGeometry(2, 1, 4);
  const carMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  car = new THREE.Mesh(carGeometry, carMaterial);
  car.position.y = 0.5;
  scene.add(car);

  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  const gridHelper = new THREE.GridHelper(200, 20);
  scene.add(gridHelper);

  // Resize handling
  window.addEventListener("resize", onWindowResize, false);

  // Key controls
  window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
  window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.code === "Space") keys["space"] = true;
  });

  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.code === "Space") keys["space"] = false;
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  updateCar();
  updateCamera();

  renderer.render(scene, camera);
}

function updateCar() {
  // Forward
  if (keys["w"]) {
    velocity += acceleration;
  }
  // Backward
  if (keys["s"]) {
    velocity -= acceleration;
  }

  // Clamp speed
  velocity = Math.max(-maxSpeed, Math.min(maxSpeed, velocity));

  // Friction / natural deceleration
  if (!keys["w"] && !keys["s"]) {
    if (velocity > 0) {
      velocity -= friction;
      if (velocity < 0) velocity = 0;
    } else if (velocity < 0) {
      velocity += friction;
      if (velocity > 0) velocity = 0;
    }
  }

  let turnBoost = keys["space"] ? handbrakeAngularBoost : 1.0;

  // Smooth turning logic
  if (keys["a"]) {
    angularVelocity += angularAcceleration * turnBoost;
  }
  if (keys["d"]) {
    angularVelocity -= angularAcceleration * turnBoost;
  }

  let effectiveFriction = keys["space"]
    ? friction * handbrakeFrictionMultiplier
    : friction;

  // Apply angular friction
  if (!keys["w"] && !keys["s"]) {
    if (velocity > 0) {
      velocity -= effectiveFriction;
      if (velocity < 0) velocity = 0;
    } else if (velocity < 0) {
      velocity += effectiveFriction;
      if (velocity > 0) velocity = 0;
    }
  }

  // Clamp turn speed
  angularVelocity = Math.max(
    -maxAngularSpeed,
    Math.min(maxAngularSpeed, angularVelocity)
  );

  // Turning is only allowed while moving
  if (Math.abs(velocity) > 0.01) {
    car.rotation.y += angularVelocity * (velocity / maxSpeed);
  }

  // Apply movement
  car.position.x -= Math.sin(car.rotation.y) * velocity;
  car.position.z -= Math.cos(car.rotation.y) * velocity;
}

function updateCamera() {
  const height = 15;
  const behind = 10;

  const offsetX = Math.sin(car.rotation.y) * behind;
  const offsetZ = Math.cos(car.rotation.y) * behind;

  camera.position.x = car.position.x + offsetX;
  camera.position.z = car.position.z + offsetZ;
  camera.position.y = car.position.y + height;

  camera.lookAt(car.position);
}
