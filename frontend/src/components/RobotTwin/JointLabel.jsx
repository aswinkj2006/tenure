import React from 'react';
import { Html } from '@react-three/drei';

export default function JointLabel({ name, value, unit = '°', status = 'ok', isAnomaly = false }) {
  const badgeClass = isAnomaly ? 'joint-label-anomaly' : `joint-label-${status}`;

  return (
    <Html
      position={[0.08, 0.05, 0]}
      center
      distanceFactor={6}
      style={{
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <div className={`robot-joint-chip ${badgeClass}`}>
        <span className="joint-chip-name">{name}</span>
        {value !== undefined && (
          <span className="joint-chip-val font-mono">{typeof value === 'number' ? value.toFixed(1) : value}{unit}</span>
        )}
      </div>
    </Html>
  );
}
