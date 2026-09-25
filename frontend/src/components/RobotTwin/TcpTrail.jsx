import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MAX_POINTS = 60;

export default function TcpTrail({ targetRef }) {
  const lineRef = useRef();
  const points = useMemo(() => {
    const arr = [];
    for (let i = 0; i < MAX_POINTS; i++) {
      arr.push(new THREE.Vector3(0, 0, 0));
    }
    return arr;
  }, []);

  const countRef = useRef(0);
  const lastSampleTime = useRef(0);

  useFrame((state) => {
    if (!targetRef.current || !lineRef.current) return;

    const now = state.clock.getElapsedTime();
    if (now - lastSampleTime.current > 0.05) { // 20Hz sample
      lastSampleTime.current = now;
      const worldPos = new THREE.Vector3();
      targetRef.current.getWorldPosition(worldPos);

      // Shift points
      for (let i = MAX_POINTS - 1; i > 0; i--) {
        points[i].copy(points[i - 1]);
      }
      points[0].copy(worldPos);

      if (countRef.current < MAX_POINTS) countRef.current++;

      lineRef.current.geometry.setFromPoints(points.slice(0, countRef.current));
    }
  });

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]), []);

  return (
    <line ref={lineRef} geometry={geometry}>
      <lineBasicMaterial color="#D97757" transparent opacity={0.45} linewidth={1.5} />
    </line>
  );
}
