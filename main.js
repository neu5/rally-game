import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

let scene, camera, renderer;
let car;
const keys = {};
const wheels = [];

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
let isDragging = false;
let previousMouseX = 0;
const dragRotateSpeed = 0.005; // Smaller = slower rotation
let cameraAngle = 0;
const cameraRadius = 15;
let cameraHeight = 12; // This is now adjustable
const minCameraHeight = 5;
const maxCameraHeight = 25;
const verticalDragSpeed = 0.05; // How sensitive vertical drag is
let lastCarPosition = new THREE.Vector3();

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
  car.position.y = 0.9;
  scene.add(car);

  lastCarPosition.copy(car.position);

  const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });

  function createWheel(x, z) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);

    // Rotate wheel to lay flat
    wheel.rotation.z = Math.PI / 2;

    // Position the wheel relative to the car
    wheel.position.set(x, -0.5, z);

    // Create a visible spinning marker (a long bar across the wheel face)
    const markerLength = 0.3;
    const markerGeometry = new THREE.BoxGeometry(markerLength, 0.02, 0.02);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);

    // Place marker on correct face of wheel
    // Left wheels (x < 0): marker goes on +Y
    // Right wheels (x > 0): marker goes on -Y
    const yOffset = 0.16; // Outside the face
    marker.position.set(0, x < 0 ? yOffset : -yOffset, 0);

    wheel.add(marker);
    car.add(wheel);
    wheels.push(wheel);
  }

  // Front-left, front-right, rear-left, rear-right
  createWheel(-0.9, 1.5); // Left front
  createWheel(0.9, 1.5); // Right front
  createWheel(-0.9, -1.5); // Left rear
  createWheel(0.9, -1.5); // Right rear

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

  // Mouse drag for camera rotation
  window.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      // Left mouse button
      isDragging = true;
      previousMouseX = e.clientX;
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      isDragging = false;
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const deltaX = e.clientX - previousMouseX;
      const deltaY = e.movementY; // or e.clientY - previousMouseY

      cameraAngle -= deltaX * dragRotateSpeed;

      // Adjust camera height with vertical drag (clamped)
      cameraHeight -= deltaY * verticalDragSpeed;
      cameraHeight = Math.max(
        minCameraHeight,
        Math.min(maxCameraHeight, cameraHeight)
      );

      previousMouseX = e.clientX;
    }
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
  updateWheelRotation();

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
  const offsetX = Math.sin(cameraAngle) * cameraRadius;
  const offsetZ = Math.cos(cameraAngle) * cameraRadius;

  camera.position.x = car.position.x + offsetX;
  camera.position.z = car.position.z + offsetZ;
  camera.position.y = car.position.y + cameraHeight;

  camera.lookAt(car.position);
}

function updateWheelRotation() {
  const currentPos = car.position.clone();
  const movementVec = currentPos.clone().sub(lastCarPosition);
  lastCarPosition.copy(currentPos);

  // No movement → no rotation
  if (movementVec.length() === 0) return;

  // Get car's forward direction vector
  const forward = new THREE.Vector3(
    -Math.sin(car.rotation.y),
    0,
    -Math.cos(car.rotation.y)
  );

  // Dot product: +1 = forward, -1 = reverse
  const directionSign = Math.sign(forward.dot(movementVec));

  // Compute how much to rotate wheels
  const wheelRadius = 0.4;
  const distanceMoved = movementVec.length();
  const rotationAmount = -directionSign * (distanceMoved / wheelRadius);

  // Apply to all wheels
  for (const wheel of wheels) {
    wheel.rotation.x += rotationAmount;
  }
}
