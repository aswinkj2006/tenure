import React, { useMemo } from 'react';
import * as THREE from 'three';

export default function FloorDisc() {
  // Grid / ring pattern on ground plane
  return (
    <group position={[0, -0.002, 0]}>
      {/* Soft warm circular platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.2, 64]} />
        <meshStandardMaterial
          color="#F2EFE9"
          roughness={0.8}
          metalness={0.05}
        />
      </mesh>

      {/* Subtle outer accent ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]}>
        <ringGeometry args={[1.18, 1.2, 64]} />
        <meshBasicMaterial color="#DDD6CE" transparent opacity={0.6} />
      </mesh>

      {/* Inner concentric technical rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]}>
        <ringGeometry args={[0.59, 0.60, 64]} />
        <meshBasicMaterial color="#DDD6CE" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]}>
        <ringGeometry args={[0.29, 0.30, 48]} />
        <meshBasicMaterial color="#DDD6CE" transparent opacity={0.4} />
      </mesh>

      {/* Subtle coordinate crosshair markings */}
      {[-0.8, -0.4, 0.4, 0.8].map((offset) => (
        <React.Fragment key={offset}>
          <mesh position={[offset, 0.0006, 0]}>
            <boxGeometry args={[0.04, 0.001, 0.003]} />
            <meshBasicMaterial color="#C5BCB2" transparent opacity={0.5} />
          </mesh>
          <mesh position={[0, 0.0006, offset]}>
            <boxGeometry args={[0.003, 0.001, 0.04]} />
            <meshBasicMaterial color="#C5BCB2" transparent opacity={0.5} />
          </mesh>
        </React.Fragment>
      ))}
    </group>
  );
}
