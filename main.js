import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

let scene, camera, renderer;
const keys = {};

// Car camera config
let cameraAngle = 0;
let cameraRadius = 15;
let cameraHeight = 12;
const minCameraHeight = 5;
const maxCameraHeight = 25;
const dragRotateSpeed = 0.005;
const verticalDragSpeed = 0.05;

// Mouse drag
let isDragging = false;
let previousMouseX = 0;

// Player car
let playerCar;

init();
animate();

// ==============================
// 🏎️ Car Creation Factory
// ==============================
function createCar({
  color = 0xff0000,
  position = new THREE.Vector3(0, 0, 0),
} = {}) {
  const car = new THREE.Group();

  // Body
  const bodyGeometry = new THREE.BoxGeometry(2, 1, 4);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = 0.5;
  car.add(body);

  // Wheels
  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });

  const wheelPositions = [
    [-0.9, -0.5, 1.5], // FL
    [0.9, -0.5, 1.5], // FR
    [-0.9, -0.5, -1.5], // RL
    [0.9, -0.5, -1.5], // RR
  ];

  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);

    // Marker to show rotation
    const markerGeometry = new THREE.BoxGeometry(0.3, 0.02, 0.02);
    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(0, x < 0 ? 0.16 : -0.16, 0);
    wheel.add(marker);

    car.add(wheel);
    wheels.push(wheel);
  }

  car.position.set(position.x, 0.9, position.z);
  scene.add(car);

  return {
    mesh: car,
    wheels,
    velocity: 0,
    angularVelocity: 0,
    lastPosition: car.position.clone(),
  };
}

// ==============================
// 🚀 Init
// ==============================
function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  // Camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 15, 15);
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
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshPhongMaterial({ color: 0x444444 })
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Player Car
  playerCar = createCar({
    color: 0x00ff00,
    position: new THREE.Vector3(0, 0, 0),
  });

  // Resize
  window.addEventListener("resize", onWindowResize, false);

  // Controls
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.code === "Space") keys["space"] = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
    if (e.code === "Space") keys["space"] = false;
  });

  // Mouse drag
  window.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      isDragging = true;
      previousMouseX = e.clientX;
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) isDragging = false;
  });
  window.addEventListener("mousemove", (e) => {
    if (isDragging) {
      const deltaX = e.clientX - previousMouseX;
      const deltaY = e.movementY;

      cameraAngle -= deltaX * dragRotateSpeed;
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

// ==============================
// 🧠 Game Loop
// ==============================
function animate() {
  requestAnimationFrame(animate);
  updateCar(playerCar);
  updateWheelRotation(playerCar);
  updateCamera(playerCar);
  renderer.render(scene, camera);
}

// ==============================
// 🧠 Car Movement
// ==============================
function updateCar(carObj) {
  const { mesh } = carObj;

  const maxSpeed = 0.5;
  const acceleration = 0.01;
  const friction = 0.01;
  const angularAcceleration = 0.002;
  const angularFriction = 0.01;
  const maxAngularSpeed = 0.03;
  const handbrakeTurnBoost = 1.8;
  const handbrakeFrictionFactor = 0.4;

  // Acceleration
  if (keys["w"]) {
    carObj.velocity += keys["space"] ? acceleration * 0.5 : acceleration;
  }
  if (keys["s"]) {
    carObj.velocity -= keys["space"] ? acceleration * 0.5 : acceleration;
  }

  // Clamp speed
  carObj.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, carObj.velocity));

  // Friction
  const effectiveFriction = keys["space"]
    ? friction * handbrakeFrictionFactor
    : friction;
  if (!keys["w"] && !keys["s"]) {
    if (carObj.velocity > 0) {
      carObj.velocity -= effectiveFriction;
      if (carObj.velocity < 0) carObj.velocity = 0;
    } else if (carObj.velocity < 0) {
      carObj.velocity += effectiveFriction;
      if (carObj.velocity > 0) carObj.velocity = 0;
    }
  }

  // Turning
  const turnBoost = keys["space"] ? handbrakeTurnBoost : 1.0;
  if (keys["a"]) carObj.angularVelocity += angularAcceleration * turnBoost;
  if (keys["d"]) carObj.angularVelocity -= angularAcceleration * turnBoost;

  if (!keys["a"] && !keys["d"]) {
    if (carObj.angularVelocity > 0) {
      carObj.angularVelocity -= angularFriction;
      if (carObj.angularVelocity < 0) carObj.angularVelocity = 0;
    } else if (carObj.angularVelocity < 0) {
      carObj.angularVelocity += angularFriction;
      if (carObj.angularVelocity > 0) carObj.angularVelocity = 0;
    }
  }

  // Clamp turning
  carObj.angularVelocity = Math.max(
    -maxAngularSpeed,
    Math.min(maxAngularSpeed, carObj.angularVelocity)
  );

  // Only turn while moving
  if (Math.abs(carObj.velocity) > 0.01) {
    mesh.rotation.y += carObj.angularVelocity * (carObj.velocity / maxSpeed);
  }

  // Apply movement
  mesh.position.x -= Math.sin(mesh.rotation.y) * carObj.velocity;
  mesh.position.z -= Math.cos(mesh.rotation.y) * carObj.velocity;
}

// ==============================
// 🛞 Wheel Rotation
// ==============================
function updateWheelRotation(carObj) {
  const { mesh, wheels, lastPosition } = carObj;
  const currentPos = mesh.position.clone();
  const movementVec = currentPos.clone().sub(lastPosition);
  lastPosition.copy(currentPos);

  if (movementVec.length() === 0) return;

  const forward = new THREE.Vector3(
    -Math.sin(mesh.rotation.y),
    0,
    -Math.cos(mesh.rotation.y)
  );
  const directionSign = Math.sign(forward.dot(movementVec));
  const wheelRadius = 0.4;
  const rotationAmount = -directionSign * (movementVec.length() / wheelRadius);

  for (const wheel of wheels) {
    wheel.rotation.x += rotationAmount;
  }
}

// ==============================
// 🎥 Camera
// ==============================
function updateCamera(carObj) {
  const { mesh } = carObj;

  const offsetX = Math.sin(cameraAngle) * cameraRadius;
  const offsetZ = Math.cos(cameraAngle) * cameraRadius;

  camera.position.x = mesh.position.x + offsetX;
  camera.position.z = mesh.position.z + offsetZ;
  camera.position.y = mesh.position.y + cameraHeight;

  camera.lookAt(mesh.position);
}
