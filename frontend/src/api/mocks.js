/**
 * Tenure — Mock Data
 * Matches exact API contracts from FRONTEND_SPEC.md with dynamic relative timestamps
 * and rich kinematic trajectory keyframes.
 */

const now = Date.now();
const minutesAgo = (m) => new Date(now - m * 60 * 1000).toISOString();
const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

// ── Machine data ──
export const MOCK_MACHINES = [
  {
    machine_id: 'ur5e-001',
    name: 'Universal Robots UR5e — Cell A',
    model: 'Universal Robots UR5e (6-Axis)',
    type: 'robot_arm',
    location: 'Cell A — High-Precision Deburring',
    status: 'online',
    health_score: 74.5,
    health_status: 'warning',
    active_alerts: 1,
    total_issues: 3,
    last_anomaly_at: hoursAgo(0.5),
  },
  {
    machine_id: 'kuka-kr10',
    name: 'KUKA KR 10 Cybertech — Bay 2',
    model: 'KUKA KR 10 R1420 (6-Axis)',
    type: 'robot_arm',
    location: 'Bay 2 — Heavy Packaging & Stacking',
    status: 'online',
    health_score: 61.0,
    health_status: 'warning',
    active_alerts: 1,
    total_issues: 2,
    last_anomaly_at: hoursAgo(1.2),
  },
  {
    machine_id: 'fanuc-crx10',
    name: 'FANUC CRX-10iA — Line 1',
    model: 'FANUC CRX-10iA Collaborative Robot',
    type: 'robot_arm',
    location: 'Line 1 — End-of-Arm Assembly',
    status: 'online',
    health_score: 52.0,
    health_status: 'critical',
    active_alerts: 1,
    total_issues: 4,
    last_anomaly_at: hoursAgo(2.1),
  },
  {
    machine_id: 'abb-irb1200',
    name: 'ABB IRB 1200-5/0.9 — Cell C',
    model: 'ABB IRB 1200 Compact Robot',
    type: 'robot_arm',
    location: 'Cell C — High-Speed Material Transfer',
    status: 'online',
    health_score: 94.8,
    health_status: 'healthy',
    active_alerts: 0,
    total_issues: 0,
    last_anomaly_at: null,
  },
];

// ── Dashboard summary ──
export const MOCK_DASHBOARD_SUMMARY = {
  total_machines: 4,
  machines_online: 4,
  active_alerts: 3,
  avg_health_score: 70.6,
  issues_last_24h: 3,
  issues_resolved_last_24h: 3,
};

// ── Sample issues for logs (Dynamic timestamps relative to current time) ──
export const MOCK_ISSUES = [
  {
    anomaly_id: 'anom-001',
    machine_id: 'ur5e-001',
    machine_name: 'UR5e Demo Unit',
    timestamp: hoursAgo(2.5),
    severity: 'critical',
    status: 'resolved',
    outcome: 'corrected',
    flagged_sensors: ['joint_3_torque'],
    diagnosis_summary: 'Elbow joint torque spike exceeding rated maximum. Likely caused by collision with fixture during pick cycle.',
  },
  {
    anomaly_id: 'anom-002',
    machine_id: 'ur5e-001',
    machine_name: 'UR5e Demo Unit',
    timestamp: hoursAgo(6),
    severity: 'medium',
    status: 'resolved',
    outcome: 'confirmed',
    flagged_sensors: ['tcp_x', 'tcp_y'],
    diagnosis_summary: 'Tool position drifting from expected path. Consistent with gradual calibration offset.',
  },
  {
    anomaly_id: 'anom-003',
    machine_id: 'ur5e-001',
    machine_name: 'UR5e Demo Unit',
    timestamp: hoursAgo(11),
    severity: 'high',
    status: 'resolved',
    outcome: 'confirmed',
    flagged_sensors: ['joint_2_torque', 'joint_2_velocity'],
    diagnosis_summary: 'Shoulder joint showing elevated torque with unusual velocity pattern during lift phase.',
  },
  {
    anomaly_id: 'anom-004',
    machine_id: 'ur5e-001',
    machine_name: 'UR5e Demo Unit',
    timestamp: hoursAgo(22),
    severity: 'low',
    status: 'resolved',
    outcome: 'confirmed',
    flagged_sensors: ['joint_5_torque'],
    diagnosis_summary: 'Minor wrist 2 torque fluctuation. Within acceptable range but worth monitoring.',
  },
  {
    anomaly_id: 'anom-005',
    machine_id: 'ur5e-001',
    machine_name: 'UR5e Demo Unit',
    timestamp: hoursAgo(28),
    severity: 'medium',
    status: 'resolved',
    outcome: 'corrected',
    flagged_sensors: ['joint_1_torque'],
    diagnosis_summary: 'Base joint torque exceeded warning threshold during rotation. Caused by payload shift.',
  },
];

// ── Full issue detail ──
export const MOCK_ISSUE_DETAIL = {
  anomaly_id: 'anom-001',
  machine_id: 'ur5e-001',
  machine_name: 'UR5e Demo Unit',
  timestamp: hoursAgo(2.5),
  severity: 'critical',
  status: 'resolved',
  anomaly_data: {
    flagged_sensors: ['joint_3_torque'],
    deviation_magnitude: { joint_3_torque: 2.34 },
    sensor_values_at_flag: { joint_3_torque: 185.2, joint_3_velocity: 1.2 },
  },
  diagnosis: {
    diagnosis_id: 'diag-001',
    text: 'The elbow joint (Joint 3) torque spike of 185 Nm exceeds the UR5e\'s rated maximum of 150 Nm. This magnitude of deviation (2.34σ above baseline) is most commonly associated with a physical collision event or an unexpected payload change.\n\nBased on the UR5e maintenance manual, Section 4.2 describes torque monitoring thresholds and recommended response procedures for over-torque events.',
    citations: [
      {
        source_ref: 'UR5e_Maintenance_Manual.pdf',
        chunk_text: 'Section 4.2: Joint torque monitoring — When torque readings exceed 120% of rated maximum, the controller should initiate a protective stop. Sustained over-torque may indicate mechanical obstruction or payload misconfiguration.',
        page: 47,
        relevance_score: 0.92,
      },
      {
        source_ref: 'UR5e_Maintenance_Manual.pdf',
        chunk_text: 'Section 5.1: Collision detection — The UR5e uses model-based collision detection comparing expected vs. actual torque. False positives may occur with sudden payload shifts.',
        page: 63,
        relevance_score: 0.87,
      },
    ],
    confidence: 0.87,
  },
  conversation: [
    { role: 'system', content: 'Anomaly detected: Elbow joint torque at 185.2 Nm (2.34σ above normal)', ts: hoursAgo(2.5) },
    { role: 'assistant', content: 'The elbow joint is showing a significant torque spike at 185 Nm — well above the safe operating range of 150 Nm. Based on the UR5e maintenance manual, this is most likely caused by a physical collision or unexpected payload change. I\'d recommend checking the workspace for obstructions.', ts: minutesAgo(148), citations: [{ source_ref: 'UR5e_Maintenance_Manual.pdf', page: 47, relevance_score: 0.92 }] },
    { role: 'user', content: 'Could this be a collision with the fixture?', ts: minutesAgo(145) },
    { role: 'assistant', content: 'Yes, that\'s very likely. Section 5.1 of the manual describes how the UR5e\'s collision detection works — it compares expected vs. actual torque. A fixture collision would produce exactly this pattern: a sudden spike localized to the elbow joint without corresponding velocity changes in other joints.', ts: minutesAgo(144), citations: [{ source_ref: 'UR5e_Maintenance_Manual.pdf', page: 63, relevance_score: 0.87 }] },
  ],
  feedback: {
    outcome: 'corrected',
    confirmed_cause: 'Gripper collision with fixture — not a joint failure',
    ts: minutesAgo(130),
  },
};

// ── Chat responses ──
export const MOCK_CHAT_RESPONSES = [
  {
    response: 'Based on the UR5e maintenance manual, elbow joint torque spikes are commonly caused by physical collisions, unexpected payload changes, or gradual joint wear. The manual recommends checking the workspace for obstructions first, then verifying the payload configuration.',
    citations: [
      {
        source_ref: 'UR5e_Maintenance_Manual.pdf',
        chunk_text: 'Section 4.2: Joint torque monitoring — When torque readings exceed 120% of rated maximum, the controller should initiate a protective stop.',
        page: 47,
        relevance_score: 0.92,
      },
    ],
    anomaly_id: null,
    chart_data: null,
  },
  {
    response: 'Here is the torque trend for the elbow joint over the last hour. Operating parameters are normal with baseline variance within safe limits.',
    citations: [],
    anomaly_id: null,
    chart_data: {
      chart_type: 'line',
      title: 'Elbow Joint Torque — Last Hour',
      x_label: 'Time',
      y_label: 'Torque (Nm)',
      series: [
        {
          name: 'Elbow Torque',
          data: Array.from({ length: 12 }, (_, i) => ({
            x: minutesAgo(60 - i * 5),
            y: 48 + Math.sin(i * 0.8) * 6 + (Math.random() - 0.5) * 3,
          })),
        },
      ],
      pin_to_dashboard: false,
    },
  },
];

// ── Sensor baseline values ──
export const SENSOR_BASELINES = {
  joint_1: { position: 0.523, velocity: 0.12, torque: 45.2 },
  joint_2: { position: -0.891, velocity: 0.08, torque: 62.1 },
  joint_3: { position: 1.204, velocity: 0.15, torque: 51.8 },
  joint_4: { position: -0.314, velocity: 0.0, torque: 12.3 },
  joint_5: { position: 0.0, velocity: 0.02, torque: 8.7 },
  joint_6: { position: 0.0, velocity: 0.01, torque: 3.2 },
  tcp: { x: 0.42, y: -0.15, z: 0.38 },
};

// ── Pick-and-Place Looping Trajectory Keyframes (Radians) ──
export const TRAJECTORY_KEYFRAMES = [
  // [J1, J2, J3, J4, J5, J6]
  { t: 0.0, angles: [0.0, -0.9, 1.4, -0.5, 0.0, 0.0] },         // Ready / Home
  { t: 1.2, angles: [0.5, -0.6, 1.7, -1.1, 0.5, 0.2] },         // Slew to Pick Station
  { t: 2.2, angles: [0.5, -0.35, 2.05, -1.7, 0.5, 0.2] },       // Lower Gripper
  { t: 3.2, angles: [0.5, -0.85, 1.5, -0.65, 0.5, 0.2] },       // Lift Payload
  { t: 4.8, angles: [-0.65, -0.8, 1.45, -0.65, -0.65, -0.2] },  // Slew to Place Station
  { t: 5.8, angles: [-0.65, -0.4, 1.95, -1.55, -0.65, -0.2] },  // Lower to Fixture
  { t: 6.8, angles: [-0.65, -0.85, 1.5, -0.65, -0.65, -0.2] },  // Retract
  { t: 8.0, angles: [0.0, -0.9, 1.4, -0.5, 0.0, 0.0] },         // Return Home
];
