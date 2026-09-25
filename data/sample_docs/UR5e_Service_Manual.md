# Universal Robots UR5e — Technical Specifications & Service Manual

## 1. Machine Overview
- **Model:** Universal Robots UR5e
- **Degrees of Freedom:** 6 rotating joints
- **Payload Capacity:** 5.0 kg (11 lbs)
- **Reach Radius:** 850 mm (33.5 in)
- **Weight:** 20.6 kg (45.4 lbs)
- **Tool Center Point (TCP) Max Speed:** 1.0 m/s
- **Repeatability:** +/- 0.03 mm

## 2. Joint Operating Limits & Specifications
| Joint | Working Range | Max Speed | Rated Max Torque |
|---|---|---|---|
| Base (Joint 1) | +/- 360 deg (+/- 6.28 rad) | 180 deg/s (3.14 rad/s) | 150.0 Nm |
| Shoulder (Joint 2) | +/- 360 deg (+/- 6.28 rad) | 180 deg/s (3.14 rad/s) | 150.0 Nm |
| Elbow (Joint 3) | +/- 180 deg (+/- 3.14 rad) | 180 deg/s (3.14 rad/s) | 150.0 Nm |
| Wrist 1 (Joint 4) | +/- 360 deg (+/- 6.28 rad) | 360 deg/s (6.28 rad/s) | 28.0 Nm |
| Wrist 2 (Joint 5) | +/- 360 deg (+/- 6.28 rad) | 360 deg/s (6.28 rad/s) | 28.0 Nm |
| Wrist 3 (Joint 6) | +/- 360 deg (+/- 6.28 rad) | 360 deg/s (6.28 rad/s) | 28.0 Nm |

## 3. Telemetry Signals & Sensor Names
The internal controller publishes real-time telemetry across the following sensor channels:
- `joint_1_position` through `joint_6_position` (radians)
- `joint_1_velocity` through `joint_6_velocity` (rad/s)
- `joint_1_torque` through `joint_6_torque` (Nm)
- `tcp_x`, `tcp_y`, `tcp_z` (meters from base frame)

## 4. Anomaly Diagnostics & Troubleshooting Guide

### Issue: Joint Torque Spike (Joints 1, 2, or 3 > 150 Nm)
- **Likely Causes:**
  1. Mechanical collision or tool path obstruction.
  2. Gearbox / harmonic drive friction or lubrication degradation.
  3. Excessive end-effector payload or sudden emergency deceleration.
  4. Loose mounting bolt on the joint flange causing mechanical vibration and false strain gauge feedback.
- **Recommended Procedure:**
  1. Trigger safety lockout and manually inspect the joint rotation for resistance.
  2. Inspect gearbox seals for grease seepage or metal particle contamination.
  3. Verify payload mass and center of gravity offset in the installation configuration.
  4. Perform zero-point encoder calibration if torque offset persists after cooling.

### Issue: Wrist Joint Torque Spike (Joints 4, 5, or 6 > 28 Nm)
- **Likely Causes:**
  1. Cable wrap-around or pneumatic hose snagging around the wrist.
  2. Gripper jaw jamming during pick-and-place operation.
  3. Tool inertia exceeding rated limits for high-speed wrist orientation changes.
- **Recommended Procedure:**
  1. Check pneumatic dress pack routing.
  2. Inspect gripper actuation current and mechanical guide rails.

## 5. Maintenance Intervals
- **Inspection (Every 500 operating hours):** Visual check of joint seals, cable harness inspection, and emergency stop test.
- **Calibration (Every 2000 hours):** Kinematic joint calibration and torque sensor baseline verification.
