import React, { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import URModel from './URModel';
import FloorDisc from './FloorDisc';
import useSensorStore from '../../stores/sensorStore';
import { JOINT_NAMES } from './kinematics';
import './RobotTwin.css';

function CameraController({ anomalyJoint, isResetting, onResetComplete }) {
  const { camera } = useThree();
  const controlsRef = useRef();
  const defaultPos = useRef(new THREE.Vector3(1.15, 0.9, 1.15));
  const defaultTarget = useRef(new THREE.Vector3(0, 0.35, 0));

  useFrame((_, dt) => {
    if (isResetting) {
      camera.position.lerp(defaultPos.current, Math.min(1, dt * 6));
      if (controlsRef.current) {
        controlsRef.current.target.lerp(defaultTarget.current, Math.min(1, dt * 6));
        controlsRef.current.update();
      }
      if (camera.position.distanceTo(defaultPos.current) < 0.02) {
        onResetComplete();
      }
    } else if (anomalyJoint !== null && anomalyJoint !== undefined) {
      // Gentle camera focus shift towards affected joint
      const targetFocus = new THREE.Vector3(0.6, 0.45 + anomalyJoint * 0.05, 0.6);
      camera.position.lerp(targetFocus, Math.min(1, dt * 2.5));
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={0.6}
      maxDistance={2.5}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.2}
      target={[0, 0.35, 0]}
    />
  );
}

export default function RobotTwin({ compact = false, onJointClick }) {
  const [isResetting, setIsResetting] = useState(false);
  const anomalyJoint = useSensorStore((s) => s.anomalyJoint);
  const connected = useSensorStore((s) => s.connected);
  const reduceEffects = useSensorStore((s) => s.reduceEffects);

  const handleResetCamera = useCallback(() => {
    setIsResetting(true);
  }, []);

  return (
    <div className={`robot-twin-container glass ${compact ? 'compact' : ''}`}>
      {/* Live Badge */}
      <div className="twin-badge-live glass-subtle">
        <span className="twin-pulse-dot" />
        <span>{connected ? 'Digital Twin • Live 60fps' : 'Digital Twin • Standby'}</span>
      </div>

      {/* Overlay Controls */}
      <div className="twin-overlay-controls">
        <button
          type="button"
          className="twin-control-btn glass-subtle"
          onClick={handleResetCamera}
          title="Reset Camera View"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span>Reset View</span>
        </button>
      </div>

      {/* Anomaly Callout */}
      {anomalyJoint !== null && (
        <div className="twin-anomaly-focus-banner glass-strong">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Focusing on {JOINT_NAMES[anomalyJoint]} over-torque anomaly</span>
        </div>
      )}

      {/* 3D Canvas */}
      <Suspense
        fallback={
          <div className="twin-loading-spinner">
            <div className="twin-pulse-dot" />
            <span>Initializing UR5e Kinematics...</span>
          </div>
        }
      >
        <Canvas
          className="twin-canvas"
          camera={{ position: [1.15, 0.9, 1.15], fov: 42 }}
          dpr={reduceEffects ? 1 : [1, 2]}
          shadows
        >
          {/* Lighting */}
          <ambientLight intensity={0.7} color="#FFFBF7" />
          <hemisphereLight
            skyColor="#FFF9F2"
            groundColor="#8A8178"
            intensity={0.45}
          />
          <directionalLight
            position={[2.5, 4.5, 2]}
            intensity={1.2}
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0001}
          />
          <directionalLight
            position={[-2, 1.5, -2]}
            intensity={0.35}
            color="#EAD9C8"
          />

          {/* Floor & Shadows */}
          <FloorDisc />
          <ContactShadows
            position={[0, -0.001, 0]}
            opacity={0.4}
            scale={2.0}
            blur={2.0}
            far={1.4}
            color="#3C3228"
          />

          {/* Robot Arm Model */}
          <URModel onJointClick={onJointClick} />

          {/* Orbit Controls & Camera Animator */}
          <CameraController
            anomalyJoint={anomalyJoint}
            isResetting={isResetting}
            onResetComplete={() => setIsResetting(false)}
          />

          {/* Subtle Postprocessing for Cinematic Warm Atmosphere */}
          {!reduceEffects && (
            <EffectComposer multisampling={0}>
              <Bloom
                luminanceThreshold={0.82}
                intensity={0.45}
                radius={0.65}
              />
              <Vignette
                offset={0.32}
                darkness={0.42}
                eskil={false}
              />
            </EffectComposer>
          )}
        </Canvas>
      </Suspense>
    </div>
  );
}
