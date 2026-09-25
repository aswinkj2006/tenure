import { useState, useEffect, useRef, useCallback } from 'react';
import useSensorStore from '../stores/sensorStore';
import { TRAJECTORY_KEYFRAMES, SENSOR_BASELINES } from '../api/mocks';
import { getTcpPosition } from '../components/RobotTwin/kinematics';

const HISTORY_LENGTH = 30;
const TICK_INTERVAL = 50; // 20Hz (50ms) for smooth real-time stream
const TRAJECTORY_DURATION = 8.0; // seconds

/**
 * Interpolate angles smoothly along trajectory keyframes
 */
function interpolateTrajectory(timeSec) {
  const tNorm = ((timeSec % TRAJECTORY_DURATION) + TRAJECTORY_DURATION) % TRAJECTORY_DURATION;
  
  // Find adjacent keyframes
  let idx = 0;
  for (let i = 0; i < TRAJECTORY_KEYFRAMES.length - 1; i++) {
    if (tNorm >= TRAJECTORY_KEYFRAMES[i].t && tNorm <= TRAJECTORY_KEYFRAMES[i + 1].t) {
      idx = i;
      break;
    }
  }

  const k1 = TRAJECTORY_KEYFRAMES[idx];
  const k2 = TRAJECTORY_KEYFRAMES[idx + 1] || TRAJECTORY_KEYFRAMES[0];
  const span = k2.t - k1.t || 1;
  const progress = (tNorm - k1.t) / span;

  // Smooth Hermite / Cosine interpolation
  const factor = (1 - Math.cos(progress * Math.PI)) / 2;

  const angles = [];
  for (let j = 0; j < 6; j++) {
    const a1 = k1.angles[j];
    const a2 = k2.angles[j];
    angles.push(a1 + (a2 - a1) * factor);
  }

  return angles;
}

export default function useSensors(machineId) {
  const [sensors, setSensors] = useState(null);
  const [sensorHistory, setSensorHistory] = useState({});
  const isConnected = useSensorStore((s) => s.connected);
  const anomalyActive = useSensorStore((s) => s.anomalyActive);
  const anomalyJoint = useSensorStore((s) => s.anomalyJoint);

  const prevAnglesRef = useRef([0, 0, 0, 0, 0, 0]);
  const startTimeRef = useRef(Date.now());
  const tickRef = useRef(null);

  // Generate tick at 20Hz
  const generateTick = useCallback(() => {
    const now = Date.now();
    const elapsedSec = (now - startTimeRef.current) / 1000;
    const store = useSensorStore.getState();
    const activeAnomalyIdx = store.anomalyJoint;

    // Current joint angles from trajectory
    const angles = interpolateTrajectory(elapsedSec);
    const prevAngles = prevAnglesRef.current;
    prevAnglesRef.current = angles;

    const baseTorques = [45, 62, 52, 12, 9, 3];
    const newJointArray = [];
    const formattedSensors = {};
    const historyUpdates = {};

    for (let i = 0; i < 6; i++) {
      const key = `joint_${i + 1}`;
      const angle = angles[i];
      const vel = (angle - prevAngles[i]) / (TICK_INTERVAL / 1000);
      const isAnomalous = activeAnomalyIdx === i;

      // Realistic torque variation
      let torque = baseTorques[i] + Math.sin(angle) * 8 + Math.abs(vel) * 15 + (Math.random() - 0.5) * 1.5;
      let status = 'ok';

      if (isAnomalous) {
        // High spike for anomaly
        torque = 185.2 + (Math.random() - 0.5) * 3;
        status = 'critical';
      }

      const jointObj = {
        position: angle,
        velocity: vel,
        torque: Math.max(0.5, torque),
        status,
      };

      newJointArray.push(jointObj);
      formattedSensors[key] = jointObj;
      historyUpdates[`${key}_torque`] = { ts: new Date(now).toISOString(), value: jointObj.torque };
    }

    // Compute TCP position via kinematics
    const tcpPos = getTcpPosition(angles);
    const tcpObj = {
      x: tcpPos.x,
      y: tcpPos.y,
      z: tcpPos.z,
      status: 'ok',
    };
    formattedSensors.tcp = tcpObj;

    // Push into Zustand store for 60fps 3D twin
    store.updateSensors({
      joints: newJointArray,
      tcp: { x: tcpPos.x, y: tcpPos.y, z: tcpPos.z },
    });

    // Update React states for standard UI consumers
    setSensors(formattedSensors);
    setSensorHistory((prev) => {
      const next = { ...prev };
      Object.entries(historyUpdates).forEach(([k, v]) => {
        const arr = next[k] ? [...next[k], v] : [];
        next[k] = [...arr, v].slice(-HISTORY_LENGTH);
      });
      return next;
    });
  }, []);

  const simulateAnomaly = useCallback((jointIdx = 2) => {
    // Support joint name or index
    let idx = 2;
    if (typeof jointIdx === 'string') {
      const match = jointIdx.match(/\d+/);
      if (match) idx = parseInt(match[0], 10) - 1;
    } else if (typeof jointIdx === 'number') {
      idx = jointIdx;
    }

    const store = useSensorStore.getState();
    store.triggerAnomaly(idx);

    // Auto recover after 12s
    setTimeout(() => {
      useSensorStore.getState().clearAnomaly();
    }, 12000);
  }, []);

  useEffect(() => {
    useSensorStore.getState().setConnected(true);
    generateTick();
    tickRef.current = setInterval(generateTick, TICK_INTERVAL);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [generateTick, machineId]);

  return {
    sensors,
    sensorHistory,
    isConnected,
    anomalyActive,
    anomalyJoint,
    simulateAnomaly,
  };
}
