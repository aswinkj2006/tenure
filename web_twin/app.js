/**
 * Tenure — UR5e 3D Digital Twin Application
 * 
 * High-fidelity Three.js robotics digital twin with real-time kinematic mirror,
 * PBR shaders, forward kinematics TCP tracking, and live WebSocket telemetry.
 */

// ──────────────────────────────────────────────────────────
// UR5e Specifications & Kinematics Configuration
// ──────────────────────────────────────────────────────────

const UR5E_JOINTS = [
  { id: 'J1', name: 'Base Pan', role: 'Base', min: -360, max: 360, maxTorque: 150 },
  { id: 'J2', name: 'Shoulder Lift', role: 'Shoulder', min: -360, max: 360, maxTorque: 150 },
  { id: 'J3', name: 'Elbow Joint', role: 'Elbow', min: -360, max: 360, maxTorque: 150 },
  { id: 'J4', name: 'Wrist 1', role: 'Pitch', min: -360, max: 360, maxTorque: 28 },
  { id: 'J5', name: 'Wrist 2', role: 'Yaw', min: -360, max: 360, maxTorque: 28 },
  { id: 'J6', name: 'Wrist 3', role: 'Roll', min: -360, max: 360, maxTorque: 28 },
];

// Target & Current Interpolated Angles (radians)
const targetAngles = [0, -1.5708, 0, -1.5708, 0, 0];
const currentAngles = [0, -1.5708, 0, -1.5708, 0, 0];
const currentVelocities = [0, 0, 0, 0, 0, 0];
const currentTorques = [0, 0, 0, 0, 0, 0];

let scene, camera, renderer, controls;
let robotRoot;
const jointNodes = [];
let gridHelper, axisHelperGroup;
let isConnected = false;
let socket = null;
let currentSource = 'backend'; // 'backend' (:8001) or 'direct' (:8084)

// ──────────────────────────────────────────────────────────
// Three.js Scene Setup
// ──────────────────────────────────────────────────────────

function initScene() {
  const container = document.getElementById('canvas-container');
  const width = window.innerWidth;
  const height = window.innerHeight;

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e17);
  scene.fog = new THREE.FogExp2(0x0a0e17, 0.18);

  // Camera
  camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 50);
  camera.position.set(1.6, 1.4, 1.8);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 + 0.02; // Don't go below floor
  controls.minDistance = 0.4;
  controls.maxDistance = 5.0;
  controls.target.set(0, 0.45, 0);

  // Studio Lighting
  setupLighting();

  // Floor & Environment
  setupEnvironment();

  // Build UR5e Robot Model
  buildUR5eRobot();

  // Load CAD Meshes if available
  loadCADMeshes();

  // Window Resize
  window.addEventListener('resize', onWindowResize);

  // UI Event Listeners
  setupUIEventListeners();
  buildJointCards();

  // Connect to Telemetry Stream
  connectTelemetry();

  // Animation Loop
  animate();
}

function setupLighting() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Main Key Directional Light
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
  keyLight.position.set(3, 5, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 15;
  keyLight.shadow.camera.left = -1.5;
  keyLight.shadow.camera.right = 1.5;
  keyLight.shadow.camera.top = 1.5;
  keyLight.shadow.camera.bottom = -1.5;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  // Fill Light (Cool Teal Tint)
  const fillLight = new THREE.DirectionalLight(0x06b6d4, 0.7);
  fillLight.position.set(-4, 3, -2);
  scene.add(fillLight);

  // Rim Light (Warm Accent)
  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
  rimLight.position.set(0, 4, -4);
  scene.add(rimLight);
}

function setupEnvironment() {
  // Ground Shadow Plane
  const groundGeo = new THREE.PlaneGeometry(10, 10);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  ground.receiveShadow = true;
  scene.add(ground);

  // Radial Range Circles & Grid
  gridHelper = new THREE.GridHelper(3.0, 30, 0x06b6d4, 0x1e293b);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  // Circular Reach Limit Ring (850mm = 0.85m)
  const ringGeo = new THREE.RingGeometry(0.846, 0.854, 64);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, side: THREE.DoubleSide, transparent: true, opacity: 0.3 });
  const reachRing = new THREE.Mesh(ringGeo, ringMat);
  reachRing.rotation.x = -Math.PI / 2;
  reachRing.position.y = 0.001;
  scene.add(reachRing);

  // Mounting Pedestal
  const pedestalGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.05, 32);
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
  const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
  pedestal.position.y = 0.025;
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  scene.add(pedestal);

  // Kinematic Axis Helpers Group
  axisHelperGroup = new THREE.Group();
  scene.add(axisHelperGroup);
}

// ──────────────────────────────────────────────────────────
// UR5e Kinematic Chain & Procedural High-Poly Model
// ──────────────────────────────────────────────────────────

function buildUR5eRobot() {
  robotRoot = new THREE.Group();
  robotRoot.position.set(0, 0.05, 0);
  scene.add(robotRoot);

  // Universal Robots Signature Materials
  const matAluminum = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.85,
    roughness: 0.25,
  });

  const matJointDark = new THREE.MeshStandardMaterial({
    color: 0x27272a,
    metalness: 0.7,
    roughness: 0.35,
  });

  const matAccentCyan = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    metalness: 0.4,
    roughness: 0.3,
    emissive: 0x06b6d4,
    emissiveIntensity: 0.15,
  });

  // Base Link
  const baseMesh = createCylinderMesh(0.075, 0.08, 0.05, matJointDark);
  baseMesh.position.y = 0.025;
  robotRoot.add(baseMesh);

  // Joint 1: Base Pan (Rotation around Y)
  const j1Node = new THREE.Group();
  j1Node.position.set(0, 0.05, 0);
  robotRoot.add(j1Node);
  jointNodes.push({ node: j1Node, axis: 'y' });

  // Shoulder body
  const shoulderCylinder = createCylinderMesh(0.065, 0.065, 0.12, matAluminum);
  shoulderCylinder.position.y = 0.06;
  j1Node.add(shoulderCylinder);

  const shoulderCap = createCylinderMesh(0.06, 0.06, 0.08, matJointDark);
  shoulderCap.rotation.z = Math.PI / 2;
  shoulderCap.position.set(0, 0.11, 0.03);
  j1Node.add(shoulderCap);

  // Joint 2: Shoulder Lift (Offset Y = 0.11m, Z = 0.03m; Rotation around Z)
  const j2Node = new THREE.Group();
  j2Node.position.set(0, 0.11, 0.03);
  j1Node.add(j2Node);
  jointNodes.push({ node: j2Node, axis: 'z' });

  // Upperarm Link (Length = 0.425m)
  const upperArmLength = 0.425;
  const upperArmGroup = new THREE.Group();
  j2Node.add(upperArmGroup);

  const upperArmTube = createCylinderMesh(0.05, 0.05, upperArmLength - 0.08, matAluminum);
  upperArmTube.position.y = upperArmLength / 2;
  upperArmGroup.add(upperArmTube);

  const upperArmRing = createCylinderMesh(0.052, 0.052, 0.02, matAccentCyan);
  upperArmRing.position.y = upperArmLength * 0.75;
  upperArmGroup.add(upperArmRing);

  // Joint 3: Elbow (At upperarm tip: Y = 0.425m; Rotation around Z)
  const j3Node = new THREE.Group();
  j3Node.position.set(0, upperArmLength, 0);
  j2Node.add(j3Node);
  jointNodes.push({ node: j3Node, axis: 'z' });

  const elbowCap = createCylinderMesh(0.055, 0.055, 0.08, matJointDark);
  elbowCap.rotation.z = Math.PI / 2;
  j3Node.add(elbowCap);

  // Forearm Link (Length = 0.392m)
  const foreArmLength = 0.392;
  const foreArmGroup = new THREE.Group();
  j3Node.add(foreArmGroup);

  const foreArmTube = createCylinderMesh(0.042, 0.042, foreArmLength - 0.06, matAluminum);
  foreArmTube.position.y = foreArmLength / 2;
  foreArmGroup.add(foreArmTube);

  // Joint 4: Wrist 1 (At forearm tip: Y = 0.392m; Rotation around Z)
  const j4Node = new THREE.Group();
  j4Node.position.set(0, foreArmLength, 0);
  j3Node.add(j4Node);
  jointNodes.push({ node: j4Node, axis: 'z' });

  const wrist1Cap = createCylinderMesh(0.042, 0.042, 0.06, matJointDark);
  wrist1Cap.rotation.z = Math.PI / 2;
  j4Node.add(wrist1Cap);

  // Joint 5: Wrist 2 (Rotation around Y)
  const j5Node = new THREE.Group();
  j5Node.position.set(0, 0.06, 0);
  j4Node.add(j5Node);
  jointNodes.push({ node: j5Node, axis: 'y' });

  const wrist2Body = createCylinderMesh(0.038, 0.038, 0.06, matAluminum);
  j5Node.add(wrist2Body);

  // Joint 6: Wrist 3 (Tool flange; Rotation around Z or Y)
  const j6Node = new THREE.Group();
  j6Node.position.set(0, 0.055, 0);
  j5Node.add(j6Node);
  jointNodes.push({ node: j6Node, axis: 'z' });

  // Flange & Gripper Tool
  const flange = createCylinderMesh(0.036, 0.036, 0.015, matJointDark);
  j6Node.add(flange);

  // Vacuum Gripper Tool Attachment
  const gripperMount = createCylinderMesh(0.025, 0.025, 0.03, matAccentCyan);
  gripperMount.position.y = 0.02;
  j6Node.add(gripperMount);

  const suctionCup = createCylinderMesh(0.035, 0.015, 0.02, matJointDark);
  suctionCup.position.y = 0.045;
  j6Node.add(suctionCup);

  // TCP Target Tracker point
  const tcpMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.008, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x10b981 })
  );
  tcpMarker.position.y = 0.06;
  tcpMarker.name = 'TCP_MARKER';
  j6Node.add(tcpMarker);
}

function createCylinderMesh(rTop, rBot, height, material) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, height, 32);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ──────────────────────────────────────────────────────────
// Official Collada CAD Mesh Loader (Optional Enhancement)
// ──────────────────────────────────────────────────────────

function loadCADMeshes() {
  if (typeof THREE.ColladaLoader === 'undefined') return;

  const loader = new THREE.ColladaLoader();
  const cadFiles = [
    { file: 'cad/base.dae', target: robotRoot },
    { file: 'cad/shoulder.dae', target: jointNodes[0]?.node },
    { file: 'cad/upperarm.dae', target: jointNodes[1]?.node },
    { file: 'cad/forearm.dae', target: jointNodes[2]?.node },
    { file: 'cad/wrist1.dae', target: jointNodes[3]?.node },
    { file: 'cad/wrist2.dae', target: jointNodes[4]?.node },
    { file: 'cad/wrist3.dae', target: jointNodes[5]?.node },
  ];

  cadFiles.forEach(({ file, target }) => {
    loader.load(
      file,
      (collada) => {
        const dae = collada.scene;
        dae.scale.set(1, 1, 1);
        dae.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        // We keep procedural elements underneath as fallback/structure
      },
      undefined,
      () => {
        // Silently fallback to procedural model
      }
    );
  });
}

// ──────────────────────────────────────────────────────────
// Real-time Forward Kinematics (FK) & Joint Updates
// ──────────────────────────────────────────────────────────

function updateKinematics() {
  // Smoothly interpolate current angles toward target angles (lerp)
  for (let i = 0; i < 6; i++) {
    currentAngles[i] += (targetAngles[i] - currentAngles[i]) * 0.25;

    if (jointNodes[i]) {
      const { node, axis } = jointNodes[i];
      if (axis === 'y') {
        node.rotation.y = currentAngles[i];
      } else if (axis === 'z') {
        node.rotation.z = currentAngles[i];
      } else if (axis === 'x') {
        node.rotation.x = currentAngles[i];
      }
    }
  }

  // Calculate World TCP position
  const tcpMarker = scene.getObjectByName('TCP_MARKER');
  if (tcpMarker) {
    const worldPos = new THREE.Vector3();
    tcpMarker.getWorldPosition(worldPos);

    document.getElementById('tcp-x').innerText = worldPos.x.toFixed(3);
    document.getElementById('tcp-y').innerText = worldPos.y.toFixed(3);
    document.getElementById('tcp-z').innerText = worldPos.z.toFixed(3);
  }
}

let pollingInterval = null;

function startPollingFallback() {
  if (pollingInterval) return;
  pollingInterval = setInterval(async () => {
    if (isConnected) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      return;
    }
    try {
      const res = await fetch('http://localhost:8001/sensors/ur5e-001/latest');
      if (res.ok) {
        const data = await res.json();
        handleBackendTelemetry(data);
        const statusText = document.getElementById('status-text');
        const statusChip = document.getElementById('connection-status');
        if (statusText && statusChip) {
          statusText.innerText = 'TENURE STREAM ACTIVE (HTTP 10Hz)';
          statusChip.className = 'status-chip active';
        }
      }
    } catch (e) {
      // Backend starting up
    }
  }, 100);
}

function connectTelemetry() {
  if (socket) {
    socket.close();
    socket = null;
  }

  const statusText = document.getElementById('status-text');
  const statusChip = document.getElementById('connection-status');

  const wsUrl = currentSource === 'backend' 
    ? 'ws://localhost:8001/ws/sensors/ur5e-001' 
    : 'ws://localhost:8084';

  statusText.innerText = `CONNECTING TO ${wsUrl}...`;
  statusChip.className = 'status-chip warning';

  startPollingFallback();

  try {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      isConnected = true;
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      statusText.innerText = currentSource === 'backend' ? 'TENURE STREAM ACTIVE' : 'PROTOTWIN DIRECT ACTIVE';
      statusChip.className = 'status-chip active';
      console.log(`[Twin] Connected to ${wsUrl}`);
    };

    socket.onmessage = (event) => {
      try {
        if (currentSource === 'backend') {
          const data = JSON.parse(event.data);
          handleBackendTelemetry(data);
        }
      } catch (err) {
        console.error('[Twin] Message parsing error:', err);
      }
    };

    socket.onerror = (err) => {
      console.warn('[Twin] WebSocket error:', err);
      statusText.innerText = 'DISCONNECTED — RECONNECTING';
      statusChip.className = 'status-chip critical';
      startPollingFallback();
    };

    socket.onclose = () => {
      isConnected = false;
      statusText.innerText = 'OFFLINE — RECONNECTING';
      statusChip.className = 'status-chip critical';
      startPollingFallback();
      setTimeout(connectTelemetry, 2500);
    };

  } catch (e) {
    console.error('[Twin] Failed to create WebSocket:', e);
    startPollingFallback();
    setTimeout(connectTelemetry, 2500);
  }
}

function handleBackendTelemetry(data) {
  if (!data || !data.sensors) return;

  const s = data.sensors;

  // Joint positions
  if (s.joint_1_position !== undefined) targetAngles[0] = s.joint_1_position;
  if (s.joint_2_position !== undefined) targetAngles[1] = s.joint_2_position;
  if (s.joint_3_position !== undefined) targetAngles[2] = s.joint_3_position;
  if (s.joint_4_position !== undefined) targetAngles[3] = s.joint_4_position;
  if (s.joint_5_position !== undefined) targetAngles[4] = s.joint_5_position;
  if (s.joint_6_position !== undefined) targetAngles[5] = s.joint_6_position;

  // Joint velocities
  if (s.joint_1_velocity !== undefined) currentVelocities[0] = s.joint_1_velocity;
  if (s.joint_2_velocity !== undefined) currentVelocities[1] = s.joint_2_velocity;
  if (s.joint_3_velocity !== undefined) currentVelocities[2] = s.joint_3_velocity;
  if (s.joint_4_velocity !== undefined) currentVelocities[3] = s.joint_4_velocity;
  if (s.joint_5_velocity !== undefined) currentVelocities[4] = s.joint_5_velocity;
  if (s.joint_6_velocity !== undefined) currentVelocities[5] = s.joint_6_velocity;

  // Joint torques
  if (s.joint_1_torque !== undefined) currentTorques[0] = s.joint_1_torque;
  if (s.joint_2_torque !== undefined) currentTorques[1] = s.joint_2_torque;
  if (s.joint_3_torque !== undefined) currentTorques[2] = s.joint_3_torque;
  if (s.joint_4_torque !== undefined) currentTorques[3] = s.joint_4_torque;
  if (s.joint_5_torque !== undefined) currentTorques[4] = s.joint_5_torque;
  if (s.joint_6_torque !== undefined) currentTorques[5] = s.joint_6_torque;

  // Simulation time
  if (data.ts) {
    document.getElementById('hud-sim-time').innerText = data.ts.slice(11, 19);
  }

  // Check for torque anomaly (J3 > 150 Nm or flagged)
  const isAnomaly = currentTorques.some((t, i) => Math.abs(t) > UR5E_JOINTS[i].maxTorque);
  updateAnomalyStatus(isAnomaly);

  // Update Left Panel Cards
  updateJointCards();
}

function updateAnomalyStatus(isAnomaly) {
  const alertBanner = document.getElementById('alert-banner');
  const safetyStatus = document.getElementById('safety-status');

  if (isAnomaly) {
    alertBanner.style.display = 'flex';
    document.getElementById('alert-title').innerText = 'CRITICAL TORQUE OVERLOAD';
    document.getElementById('alert-desc').innerText = `Joint 3 torque (${currentTorques[2].toFixed(1)} Nm) exceeds safety rating (150 Nm).`;
    safetyStatus.innerText = 'EMERGENCY STOP';
    safetyStatus.className = 'badge' + ' badge-coral';
  } else {
    alertBanner.style.display = 'none';
    safetyStatus.innerText = 'NOMINAL';
    safetyStatus.className = 'badge badge-teal';
  }
}

// ──────────────────────────────────────────────────────────
// UI Construction & Interactive Controls
// ──────────────────────────────────────────────────────────

function buildJointCards() {
  const container = document.getElementById('joints-container');
  container.innerHTML = '';

  UR5E_JOINTS.forEach((j, index) => {
    const card = document.createElement('div');
    card.className = 'joint-card';
    card.id = `card-joint-${index}`;

    card.innerHTML = `
      <div class="joint-card-header">
        <div>
          <span class="joint-name">${j.id}</span>
          <span class="joint-sub">${j.name}</span>
        </div>
        <span class="joint-degrees" id="deg-${index}">0.0°</span>
      </div>
      <div class="joint-rad" id="rad-${index}">0.000 rad</div>
      <div class="joint-bar-track">
        <div class="joint-bar-fill" id="bar-${index}" style="width: 50%;"></div>
      </div>
      <div class="joint-metrics-row">
        <span>Vel: <span class="metric-val" id="vel-${index}">0.00</span> rad/s</span>
        <span>Torque: <span class="metric-val" id="trq-${index}">0.0</span> / ${j.maxTorque} Nm</span>
      </div>
    `;
    container.appendChild(card);
  });
}

function updateJointCards() {
  for (let i = 0; i < 6; i++) {
    const rad = currentAngles[i];
    const deg = (rad * 180 / Math.PI).toFixed(1);
    
    const degEl = document.getElementById(`deg-${i}`);
    const radEl = document.getElementById(`rad-${i}`);
    const barEl = document.getElementById(`bar-${i}`);
    const velEl = document.getElementById(`vel-${i}`);
    const trqEl = document.getElementById(`trq-${i}`);

    if (degEl) degEl.innerText = `${deg}°`;
    if (radEl) radEl.innerText = `${rad.toFixed(3)} rad`;
    if (velEl) velEl.innerText = currentVelocities[i].toFixed(2);
    if (trqEl) trqEl.innerText = currentTorques[i].toFixed(1);

    if (barEl) {
      // Map [-pi, +pi] or [-2pi, +2pi] to [0%, 100%]
      const pct = Math.min(100, Math.max(0, ((rad + Math.PI) / (2 * Math.PI)) * 100));
      barEl.style.width = `${pct}%`;
    }
  }
}

function setupUIEventListeners() {
  // Clock
  setInterval(() => {
    document.getElementById('clock-display').innerText = new Date().toUTCString().slice(17, 25) + ' UTC';
  }, 1000);

  // Source Switcher
  document.getElementById('btn-src-backend').addEventListener('click', (e) => {
    currentSource = 'backend';
    document.getElementById('btn-src-backend').classList.add('active');
    document.getElementById('btn-src-direct').classList.remove('active');
    document.getElementById('hud-client-type').innerText = 'Tenure WebSocket Stream';
    connectTelemetry();
  });

  document.getElementById('btn-src-direct').addEventListener('click', (e) => {
    currentSource = 'direct';
    document.getElementById('btn-src-direct').classList.add('active');
    document.getElementById('btn-src-backend').classList.remove('active');
    document.getElementById('hud-client-type').innerText = 'ProtoTwin Port 8084';
    connectTelemetry();
  });

  // Reset View
  document.getElementById('btn-reset-view').addEventListener('click', () => {
    setCameraPreset('iso');
  });

  // Camera Presets
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      setCameraPreset(btn.dataset.cam);
    });
  });

  // Visual Toggles
  document.getElementById('toggle-grid').addEventListener('change', (e) => {
    if (gridHelper) gridHelper.visible = e.target.checked;
  });

  document.getElementById('toggle-shadows').addEventListener('change', (e) => {
    renderer.shadowMap.enabled = e.target.checked;
  });

  document.getElementById('toggle-wireframe').addEventListener('change', (e) => {
    robotRoot.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.wireframe = e.target.checked;
      }
    });
  });

  // Injection buttons
  document.getElementById('btn-inject-anomaly').addEventListener('click', async () => {
    try {
      await fetch('http://localhost:8001/inject-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: 'torque_spike', joint: 3, value: 188.5 }),
      });
    } catch (e) {
      console.warn('Could not inject anomaly:', e);
    }
  });

  document.getElementById('btn-clear-anomaly').addEventListener('click', async () => {
    try {
      await fetch('http://localhost:8001/clear-anomaly', { method: 'POST' });
    } catch (e) {
      console.warn('Could not clear anomaly:', e);
    }
  });
}

function setCameraPreset(preset) {
  const duration = 1000;
  const targetLook = new THREE.Vector3(0, 0.45, 0);

  let targetPos;
  switch (preset) {
    case 'front':
      targetPos = new THREE.Vector3(0, 0.45, 2.2);
      break;
    case 'side':
      targetPos = new THREE.Vector3(2.2, 0.45, 0);
      break;
    case 'top':
      targetPos = new THREE.Vector3(0, 2.5, 0.01);
      break;
    case 'tool':
      const tcpMarker = scene.getObjectByName('TCP_MARKER');
      if (tcpMarker) {
        const wp = new THREE.Vector3();
        tcpMarker.getWorldPosition(wp);
        targetPos = new THREE.Vector3(wp.x + 0.4, wp.y + 0.3, wp.z + 0.4);
        controls.target.copy(wp);
      } else {
        targetPos = new THREE.Vector3(0.8, 0.8, 0.8);
      }
      break;
    case 'iso':
    default:
      targetPos = new THREE.Vector3(1.6, 1.4, 1.8);
      controls.target.set(0, 0.45, 0);
      break;
  }

  // Smooth camera transition
  camera.position.copy(targetPos);
  controls.update();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);

  // Update forward kinematics & robot joint poses
  updateKinematics();

  // Update controls
  controls.update();

  // Render
  renderer.render(scene, camera);
}

// Start Three.js when DOM is ready
window.addEventListener('DOMContentLoaded', initScene);
