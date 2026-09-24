import { create } from 'zustand';

/**
 * Tenure — Sensor Store (Zustand)
 *
 * Critical architecture: sensor data lives here as plain JS objects,
 * NOT React state. The 3D twin reads via store.getState() inside useFrame
 * at 60fps. React UI subscribes at ~10Hz for numeric display only.
 */

const HISTORY_LENGTH = 30;

const initialJoint = (i) => ({
  position: 0,
  velocity: 0,
  torque: [45, 62, 52, 12, 9, 3][i] || 10,
  status: 'ok',
});

const useSensorStore = create((set, get) => ({
  // Connection state — single source of truth
  connected: false,
  setConnected: (v) => set({ connected: v }),

  // Reduce Effects accessibility / performance mode
  reduceEffects: false,
  setReduceEffects: (v) => {
    if (v) document.body.classList.add('reduce-effects');
    else document.body.classList.remove('reduce-effects');
    set({ reduceEffects: v });
  },
  toggleReduceEffects: () => {
    const next = !get().reduceEffects;
    if (next) document.body.classList.add('reduce-effects');
    else document.body.classList.remove('reduce-effects');
    set({ reduceEffects: next });
  },

  // Joint data (1-indexed in accessors, 0-indexed in array)
  joints: Array.from({ length: 6 }, (_, i) => initialJoint(i)),

  // TCP position
  tcp: { x: 0.4, y: -0.1, z: 0.3 },

  // Torque history ring buffers (for sparklines)
  history: Array.from({ length: 6 }, () => []),

  // Anomaly state
  anomalyJoint: null, // null or 0-5
  anomalyActive: false,

  // Selected/hovered joint (for 3D ↔ card linking)
  selectedJoint: null, // null or 0-5
  hoveredJoint: null,  // null or 0-5
  setSelectedJoint: (j) => set({ selectedJoint: j }),
  setHoveredJoint: (j) => set({ hoveredJoint: j }),

  // Tick counter for UI throttling
  tickCount: 0,

  /**
   * Update all sensor data in one batch.
   * Called by the mock stream at ~20Hz.
   */
  updateSensors: (data) => {
    const state = get();
    const newJoints = data.joints || state.joints;
    const newTcp = data.tcp || state.tcp;

    // Update history
    const newHistory = state.history.map((arr, i) => {
      const entry = { ts: Date.now(), value: newJoints[i].torque };
      const next = [...arr, entry];
      return next.length > HISTORY_LENGTH ? next.slice(-HISTORY_LENGTH) : next;
    });

    set({
      joints: newJoints,
      tcp: newTcp,
      history: newHistory,
      tickCount: state.tickCount + 1,
    });
  },

  /**
   * Trigger anomaly on a joint (0-indexed)
   */
  triggerAnomaly: (jointIdx = 2) => {
    set({ anomalyJoint: jointIdx, anomalyActive: true });
  },

  clearAnomaly: () => {
    set({ anomalyJoint: null, anomalyActive: false });
  },
}));

export default useSensorStore;
