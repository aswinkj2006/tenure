import * as THREE from 'three';

/**
 * Tenure — UR5e Forward Kinematics
 *
 * Modified DH parameters for Universal Robots UR5e.
 * Each joint rotates about its local Z axis.
 */

// DH Parameters: [d, a, alpha] for each joint
// Joint angles (theta) come from the sensor stream
export const DH_PARAMS = [
  { d: 0.1625, a: 0,       alpha: Math.PI / 2 },   // Joint 1 (Base)
  { d: 0,      a: -0.425,  alpha: 0 },              // Joint 2 (Shoulder)
  { d: 0,      a: -0.3922, alpha: 0 },              // Joint 3 (Elbow)
  { d: 0.1333, a: 0,       alpha: Math.PI / 2 },    // Joint 4 (Wrist 1)
  { d: 0.0997, a: 0,       alpha: -Math.PI / 2 },   // Joint 5 (Wrist 2)
  { d: 0.0996, a: 0,       alpha: 0 },              // Joint 6 (Wrist 3)
];

// Link lengths for procedural geometry (meters, used for visual sizing)
export const LINK_DIMS = {
  base:     { radius: 0.075, height: 0.1625 },
  shoulder: { radius: 0.060, height: 0.120 },
  upperArm: { radius: 0.045, length: 0.425 },
  forearm:  { radius: 0.038, length: 0.3922 },
  wrist1:   { radius: 0.032, height: 0.1333 },
  wrist2:   { radius: 0.032, height: 0.0997 },
  wrist3:   { radius: 0.028, height: 0.0996 },
  flange:   { radius: 0.025, height: 0.030 },
};

// Joint friendly names
export const JOINT_NAMES = [
  'Base', 'Shoulder', 'Elbow', 'Wrist 1', 'Wrist 2', 'Wrist 3',
];

/**
 * Compute the DH transformation matrix for one joint.
 *
 * T = Rz(theta) * Tz(d) * Tx(a) * Rx(alpha)
 */
export function dhMatrix(theta, d, a, alpha) {
  const ct = Math.cos(theta);
  const st = Math.sin(theta);
  const ca = Math.cos(alpha);
  const sa = Math.sin(alpha);

  const m = new THREE.Matrix4();
  m.set(
    ct, -st * ca,  st * sa, a * ct,
    st,  ct * ca, -ct * sa, a * st,
    0,   sa,       ca,      d,
    0,   0,        0,       1
  );
  return m;
}

/**
 * Compute forward kinematics for all joints.
 * Returns an array of 7 Matrix4 (base + 6 joints) representing
 * the cumulative transform at each joint origin.
 *
 * @param {number[]} angles - 6 joint angles in radians
 * @returns {THREE.Matrix4[]} - 7 cumulative transforms (world space)
 */
export function forwardKinematics(angles) {
  const transforms = [new THREE.Matrix4()]; // identity for base
  let cumulative = new THREE.Matrix4();

  for (let i = 0; i < 6; i++) {
    const { d, a, alpha } = DH_PARAMS[i];
    const T = dhMatrix(angles[i], d, a, alpha);
    cumulative = cumulative.clone().multiply(T);
    transforms.push(cumulative.clone());
  }

  return transforms;
}

/**
 * Extract TCP position from the final transform.
 */
export function getTcpPosition(angles) {
  const transforms = forwardKinematics(angles);
  const pos = new THREE.Vector3();
  pos.setFromMatrixPosition(transforms[6]);
  return pos;
}

/**
 * Smooth interpolation helper for joint angles.
 * Uses THREE.MathUtils.damp for frame-rate-independent smoothing.
 */
export function dampAngle(current, target, lambda, dt) {
  // Handle angle wrapping
  let diff = target - current;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return current + diff * (1 - Math.exp(-lambda * dt));
}
