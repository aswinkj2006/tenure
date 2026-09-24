import React from 'react';
import { Html } from '@react-three/drei';
import NumberFlow from '@number-flow/react';

export default function JointLabel({ name, value, torque, unit = '°', status = 'ok', isAnomaly = false }) {
  const statusColor = isAnomaly ? '#B23A2E' : status === 'warn' ? '#D9A441' : '#5E8C61';

  return (
    <Html
      position={[0.08, 0.06, 0]}
      center
      distanceFactor={5.5}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div className={`robot-joint-chip glass-subtle ${isAnomaly ? 'joint-label-anomaly' : ''}`}>
        <span
          className="joint-chip-dot"
          style={{ backgroundColor: statusColor }}
        />
        <span className="joint-chip-name">{name}</span>
        {value !== undefined && typeof value === 'number' && (
          <span className="joint-chip-val font-mono">
            <NumberFlow value={value} format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} />
            {unit}
          </span>
        )}
        {torque !== undefined && typeof torque === 'number' && (
          <span className="joint-chip-torque font-mono">
            <NumberFlow value={torque} format={{ minimumFractionDigits: 0, maximumFractionDigits: 0 }} /> Nm
          </span>
        )}
      </div>
    </Html>
  );
}
