import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const STATUS_COLORS = {
  ok: new THREE.Color('#5E8C61'),
  warn: new THREE.Color('#D49B35'),
  critical: new THREE.Color('#C05646'),
};

export default function JointRing({ status = 'ok', radius = 0.065, tube = 0.0035, isAnomaly = false, isHovered = false }) {
  const matRef = useRef();
  const currentStatus = isAnomaly ? 'critical' : status;

  useFrame((_, dt) => {
    if (!matRef.current) return;
    const targetColor = isHovered 
      ? new THREE.Color('#D97757') 
      : (STATUS_COLORS[currentStatus] || STATUS_COLORS.ok);
    matRef.current.color.lerp(targetColor, Math.min(1, dt * 10));
    
    // Pulse intensity if anomaly
    if (isAnomaly) {
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() * 0.008);
      matRef.current.emissive.copy(STATUS_COLORS.critical).multiplyScalar(pulse * 0.8);
    } else if (isHovered) {
      matRef.current.emissive.set('#D97757').multiplyScalar(0.4);
    } else {
      matRef.current.emissive.lerp(new THREE.Color('#000000'), dt * 8);
    }
  });

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, tube, 16, 48]} />
      <meshStandardMaterial
        ref={matRef}
        color={STATUS_COLORS[currentStatus] || STATUS_COLORS.ok}
        roughness={0.3}
        metalness={0.2}
      />
    </mesh>
  );
}
