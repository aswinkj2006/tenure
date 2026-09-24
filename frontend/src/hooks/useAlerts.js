import { useState, useCallback, useRef, useEffect } from 'react';
import { friendlyJointName } from '../utils/format';

/**
 * Alert management hook.
 * In production, connects to WS at ws://localhost:8002/ws/alerts/{machineId}
 * In dev, alerts are triggered by simulateAnomaly in useSensors.
 *
 * Returns: { alerts, activeAlert, dismissAlert, triggerMockAlert }
 */
export default function useAlerts(machineId) {
  const [alerts, setAlerts] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);

  const triggerMockAlert = useCallback((sensorKey = 'joint_3_torque') => {
    const alert = {
      anomaly_id: `anom-${Date.now()}`,
      machine_id: machineId,
      ts: new Date().toISOString(),
      severity: 'critical',
      flagged_sensors: [sensorKey],
      deviation_magnitude: { [sensorKey]: 2.34 },
      message: `${friendlyJointName(sensorKey)} torque exceeded safe operating threshold`,
      auto_action: 'slowdown',
      // Plain-language three lines
      what: `${friendlyJointName(sensorKey)} is showing unusual torque — 185 Nm, well above the safe range.`,
      why: 'This usually happens when the arm collides with something or the payload shifts unexpectedly.',
      todo: 'Check the workspace for obstructions, then review the diagnosis below.',
    };

    setAlerts((prev) => [alert, ...prev]);
    setActiveAlert(alert);
  }, [machineId]);

  const dismissAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  return {
    alerts,
    activeAlert,
    dismissAlert,
    triggerMockAlert,
  };
}
