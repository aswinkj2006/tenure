import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSensorStore from '../../stores/sensorStore';
import JointRing from './JointRing';
import JointLabel from './JointLabel';
import TcpTrail from './TcpTrail';
import { JOINT_NAMES, dampAngle } from './kinematics';

export default function URModel({ onJointClick }) {
  // References to joint rotation groups
  const j1Ref = useRef();
  const j2Ref = useRef();
  const j3Ref = useRef();
  const j4Ref = useRef();
  const j5Ref = useRef();
  const j6Ref = useRef();
  const tcpRef = useRef();

  // Part pick-and-place animation refs
  const partInGripperRef = useRef();
  const partAtPickRef = useRef();
  const partAtPlaceRef = useRef();

  // Energy pulse mesh refs
  const energyUpperRef = useRef();
  const energyForearmRef = useRef();

  // Joint current smoothed angles starting from compact folded boot pose
  const anglesRef = useRef([0, -Math.PI / 2, Math.PI * 0.85, -Math.PI / 2, 0, 0]);

  // Subscribe to store state for UI interaction without full re-render
  const hoveredJoint = useSensorStore((s) => s.hoveredJoint);
  const selectedJoint = useSensorStore((s) => s.selectedJoint);
  const anomalyJoint = useSensorStore((s) => s.anomalyJoint);
  const setHoveredJoint = useSensorStore((s) => s.setHoveredJoint);
  const setSelectedJoint = useSensorStore((s) => s.setSelectedJoint);

  // Materials
  const matMetal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#DDD7D0',
        roughness: 0.38,
        metalness: 0.35,
      }),
    []
  );

  const matWorkpiece = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#D4AF37', // Polished brass workpiece part
        metalness: 0.85,
        roughness: 0.22,
      }),
    []
  );

  const matDarkAccent = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2C2724',
        roughness: 0.45,
        metalness: 0.25,
      }),
    []
  );

  const matTerracotta = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#B8723B',
        roughness: 0.4,
        metalness: 0.2,
      }),
    []
  );

  const matEnergy = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#B8723B',
        emissive: new THREE.Color('#B8723B'),
        emissiveIntensity: 0.4,
        roughness: 0.2,
      }),
    []
  );

  const matChamfer = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#B5ACA2',
        roughness: 0.3,
        metalness: 0.5,
      }),
    []
  );

  useFrame((state, dt) => {
    const store = useSensorStore.getState();
    const joints = store.joints || [];

    // Target angles from store or nominal operating pose
    const targets = [
      joints[0]?.position ?? 0,
      joints[1]?.position ?? -0.8,
      joints[2]?.position ?? 1.4,
      joints[3]?.position ?? -0.6,
      joints[4]?.position ?? 0,
      joints[5]?.position ?? 0,
    ];

    // Smooth damp angles
    for (let i = 0; i < 6; i++) {
      anglesRef.current[i] = dampAngle(anglesRef.current[i], targets[i], 10, dt);
    }

    // Apply rotations
    if (j1Ref.current) j1Ref.current.rotation.y = anglesRef.current[0];
    if (j2Ref.current) j2Ref.current.rotation.z = anglesRef.current[1];
    if (j3Ref.current) j3Ref.current.rotation.z = anglesRef.current[2];
    if (j4Ref.current) j4Ref.current.rotation.z = anglesRef.current[3];
    if (j5Ref.current) j5Ref.current.rotation.y = anglesRef.current[4];
    if (j6Ref.current) j6Ref.current.rotation.x = anglesRef.current[5];

    // Torque energy pulse animation
    const time = state.clock.getElapsedTime();
    const pulseIntensity = 0.3 + 0.4 * Math.sin(time * 4);
    if (matEnergy) {
      if (store.anomalyActive) {
        matEnergy.emissive.set('#B23A2E');
        matEnergy.emissiveIntensity = 0.8 + 0.5 * Math.sin(time * 8);
      } else {
        matEnergy.emissive.set('#B8723B');
        matEnergy.emissiveIntensity = pulseIntensity;
      }
    }

    // Pick-and-Place workpiece transfer animation state
    // Trajectory period is 8.0s:
    // 0.0 - 2.2s: Arm swoops to pick station (part is waiting on pick feeder)
    // 2.2 - 5.8s: Gripper grasps part, lifts and slews to place conveyor fixture
    // 5.8 - 8.0s: Gripper deposits part on place fixture and returns home
    const tCycle = time % 8.0;
    const isCarrying = tCycle >= 2.2 && tCycle < 5.8;
    const isAtPlace = tCycle >= 5.8;
    const isAtPick = tCycle < 2.2;

    if (partInGripperRef.current) partInGripperRef.current.visible = isCarrying;
    if (partAtPickRef.current) partAtPickRef.current.visible = isAtPick;
    if (partAtPlaceRef.current) partAtPlaceRef.current.visible = isAtPlace;
  });

  const handlePointerOver = (idx, e) => {
    e.stopPropagation();
    setHoveredJoint(idx);
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHoveredJoint(null);
  };

  const handleClick = (idx, e) => {
    e.stopPropagation();
    setSelectedJoint(idx);
    if (onJointClick) onJointClick(idx);
  };

  // Dimensions
  const BASE_H = 0.1625;
  const UPPER_ARM_L = 0.425;
  const FOREARM_L = 0.3922;

  const storeJoints = useSensorStore.getState().joints || [];

  return (
    <group position={[0, 0, 0]}>
      {/* ── BASE (Static) ── */}
      <group
        onPointerOver={(e) => handlePointerOver(0, e)}
        onPointerOut={handlePointerOut}
        onClick={(e) => handleClick(0, e)}
      >
        <mesh position={[0, 0.015, 0]} material={matDarkAccent} castShadow receiveShadow>
          <cylinderGeometry args={[0.085, 0.09, 0.03, 32]} />
        </mesh>
        <mesh position={[0, BASE_H / 2 + 0.015, 0]} material={matMetal} castShadow receiveShadow>
          <cylinderGeometry args={[0.075, 0.075, BASE_H - 0.03, 32]} />
        </mesh>
        <mesh position={[0, BASE_H * 0.4, 0]} material={matChamfer}>
          <cylinderGeometry args={[0.076, 0.076, 0.005, 32]} />
        </mesh>
      </group>

      {/* ── JOINT 1 (Base Yaw) ── */}
      <group ref={j1Ref} position={[0, BASE_H, 0]}>
        <group position={[0, 0.01, 0]}>
          <JointRing
            status={storeJoints[0]?.status || 'ok'}
            radius={0.078}
            isAnomaly={anomalyJoint === 0}
            isHovered={hoveredJoint === 0 || selectedJoint === 0}
          />
          {(hoveredJoint === 0 || selectedJoint === 0 || anomalyJoint === 0) && (
            <JointLabel
              name={JOINT_NAMES[0]}
              value={(anglesRef.current[0] * 180) / Math.PI}
              torque={storeJoints[0]?.torque}
              status={storeJoints[0]?.status || 'ok'}
              isAnomaly={anomalyJoint === 0}
            />
          )}
        </group>

        {/* Shoulder housing */}
        <group
          position={[0, 0.06, 0]}
          onPointerOver={(e) => handlePointerOver(0, e)}
          onPointerOut={handlePointerOut}
          onClick={(e) => handleClick(0, e)}
        >
          <mesh material={matDarkAccent} castShadow>
            <cylinderGeometry args={[0.068, 0.072, 0.1, 32]} />
          </mesh>
          <mesh position={[0, 0.052, 0]} material={matTerracotta}>
            <cylinderGeometry args={[0.05, 0.05, 0.006, 32]} />
          </mesh>
        </group>

        {/* ── JOINT 2 (Shoulder Pitch) ── */}
        <group
          ref={j2Ref}
          position={[0, 0.08, 0.04]}
          onPointerOver={(e) => handlePointerOver(1, e)}
          onPointerOut={handlePointerOut}
          onClick={(e) => handleClick(1, e)}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]} material={matDarkAccent} castShadow>
            <cylinderGeometry args={[0.062, 0.062, 0.12, 32]} />
          </mesh>
          <group rotation={[0, Math.PI / 2, 0]}>
            <JointRing
              status={storeJoints[1]?.status || 'ok'}
              radius={0.065}
              isAnomaly={anomalyJoint === 1}
              isHovered={hoveredJoint === 1 || selectedJoint === 1}
            />
          </group>
          {(hoveredJoint === 1 || selectedJoint === 1 || anomalyJoint === 1) && (
            <JointLabel
              name={JOINT_NAMES[1]}
              value={(anglesRef.current[1] * 180) / Math.PI}
              torque={storeJoints[1]?.torque}
              status={storeJoints[1]?.status || 'ok'}
              isAnomaly={anomalyJoint === 1}
            />
          )}

          {/* Upper arm body + Energy Flow Pulse */}
          <group position={[0, UPPER_ARM_L / 2, 0]}>
            <mesh material={matMetal} castShadow>
              <cylinderGeometry args={[0.045, 0.05, UPPER_ARM_L, 24]} />
            </mesh>
            <mesh ref={energyUpperRef} position={[0.046, 0, 0]} material={matEnergy}>
              <boxGeometry args={[0.004, UPPER_ARM_L * 0.75, 0.008]} />
            </mesh>
          </group>

          {/* ── JOINT 3 (Elbow Pitch) ── */}
          <group
            ref={j3Ref}
            position={[0, UPPER_ARM_L, 0]}
            onPointerOver={(e) => handlePointerOver(2, e)}
            onPointerOut={handlePointerOut}
            onClick={(e) => handleClick(2, e)}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]} material={matDarkAccent} castShadow>
              <cylinderGeometry args={[0.055, 0.055, 0.11, 32]} />
            </mesh>
            <group rotation={[0, Math.PI / 2, 0]}>
              <JointRing
                status={storeJoints[2]?.status || 'ok'}
                radius={0.058}
                isAnomaly={anomalyJoint === 2}
                isHovered={hoveredJoint === 2 || selectedJoint === 2}
              />
            </group>
            {(hoveredJoint === 2 || selectedJoint === 2 || anomalyJoint === 2) && (
              <JointLabel
                name={JOINT_NAMES[2]}
                value={(anglesRef.current[2] * 180) / Math.PI}
                torque={storeJoints[2]?.torque}
                status={storeJoints[2]?.status || 'ok'}
                isAnomaly={anomalyJoint === 2}
              />
            )}

            {/* Forearm body + Energy Flow Pulse */}
            <group position={[0, FOREARM_L / 2, 0]}>
              <mesh material={matMetal} castShadow>
                <cylinderGeometry args={[0.038, 0.042, FOREARM_L, 24]} />
              </mesh>
              <mesh ref={energyForearmRef} position={[-0.039, 0, 0]} material={matEnergy}>
                <boxGeometry args={[0.003, FOREARM_L * 0.7, 0.006]} />
              </mesh>
            </group>

            {/* ── JOINT 4 (Wrist 1 Pitch) ── */}
            <group
              ref={j4Ref}
              position={[0, FOREARM_L, 0]}
              onPointerOver={(e) => handlePointerOver(3, e)}
              onPointerOut={handlePointerOut}
              onClick={(e) => handleClick(3, e)}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} material={matDarkAccent} castShadow>
                <cylinderGeometry args={[0.042, 0.042, 0.09, 28]} />
              </mesh>
              <group rotation={[0, Math.PI / 2, 0]}>
                <JointRing
                  status={storeJoints[3]?.status || 'ok'}
                  radius={0.045}
                  isAnomaly={anomalyJoint === 3}
                  isHovered={hoveredJoint === 3 || selectedJoint === 3}
                />
              </group>
              {(hoveredJoint === 3 || selectedJoint === 3 || anomalyJoint === 3) && (
                <JointLabel
                  name={JOINT_NAMES[3]}
                  value={(anglesRef.current[3] * 180) / Math.PI}
                  torque={storeJoints[3]?.torque}
                  status={storeJoints[3]?.status || 'ok'}
                  isAnomaly={anomalyJoint === 3}
                />
              )}

              {/* ── JOINT 5 (Wrist 2 Yaw) ── */}
              <group
                ref={j5Ref}
                position={[0, 0.065, 0]}
                onPointerOver={(e) => handlePointerOver(4, e)}
                onPointerOut={handlePointerOut}
                onClick={(e) => handleClick(4, e)}
              >
                <mesh material={matMetal} castShadow>
                  <cylinderGeometry args={[0.035, 0.038, 0.07, 24]} />
                </mesh>
                <group position={[0, 0.03, 0]}>
                  <JointRing
                    status={storeJoints[4]?.status || 'ok'}
                    radius={0.039}
                    isAnomaly={anomalyJoint === 4}
                    isHovered={hoveredJoint === 4 || selectedJoint === 4}
                  />
                </group>
                {(hoveredJoint === 4 || selectedJoint === 4 || anomalyJoint === 4) && (
                  <JointLabel
                    name={JOINT_NAMES[4]}
                    value={(anglesRef.current[4] * 180) / Math.PI}
                    torque={storeJoints[4]?.torque}
                    status={storeJoints[4]?.status || 'ok'}
                    isAnomaly={anomalyJoint === 4}
                  />
                )}

                {/* ── JOINT 6 (Wrist 3 Roll / Flange) ── */}
                <group
                  ref={j6Ref}
                  position={[0, 0.055, 0]}
                  onPointerOver={(e) => handlePointerOver(5, e)}
                  onPointerOut={handlePointerOut}
                  onClick={(e) => handleClick(5, e)}
                >
                  <mesh material={matDarkAccent} castShadow>
                    <cylinderGeometry args={[0.032, 0.032, 0.025, 24]} />
                  </mesh>
                  <mesh position={[0, 0.02, 0]} material={matTerracotta}>
                    <cylinderGeometry args={[0.02, 0.025, 0.015, 24]} />
                  </mesh>

                  {/* Gripper Fingers */}
                  <group position={[0, 0.032, 0]}>
                    <mesh material={matDarkAccent}>
                      <boxGeometry args={[0.045, 0.012, 0.025]} />
                    </mesh>
                    <mesh position={[-0.016, 0.02, 0]} material={matMetal}>
                      <boxGeometry args={[0.006, 0.028, 0.014]} />
                    </mesh>
                    <mesh position={[0.016, 0.02, 0]} material={matMetal}>
                      <boxGeometry args={[0.006, 0.028, 0.014]} />
                    </mesh>

                    {/* Part in Gripper (Held while carrying) */}
                    <mesh ref={partInGripperRef} position={[0, 0.022, 0]} material={matWorkpiece} castShadow>
                      <cylinderGeometry args={[0.012, 0.012, 0.026, 16]} />
                    </mesh>
                  </group>

                  {/* TCP Anchor Point */}
                  <group ref={tcpRef} position={[0, 0.055, 0]} />

                  <group position={[0, 0.01, 0]}>
                    <JointRing
                      status={storeJoints[5]?.status || 'ok'}
                      radius={0.034}
                      isAnomaly={anomalyJoint === 5}
                      isHovered={hoveredJoint === 5 || selectedJoint === 5}
                    />
                  </group>
                  {(hoveredJoint === 5 || selectedJoint === 5 || anomalyJoint === 5) && (
                    <JointLabel
                      name={JOINT_NAMES[5]}
                      value={(anglesRef.current[5] * 180) / Math.PI}
                      torque={storeJoints[5]?.torque}
                      status={storeJoints[5]?.status || 'ok'}
                      isAnomaly={anomalyJoint === 5}
                    />
                  )}
                </group>
              </group>
            </group>
          </group>
        </group>
      </group>

      {/* ── Industrial Pick Feeder Station ── */}
      <group position={[0.28, 0, 0.32]}>
        <mesh position={[0, 0.02, 0]} material={matDarkAccent} castShadow receiveShadow>
          <cylinderGeometry args={[0.045, 0.052, 0.04, 24]} />
        </mesh>
        <mesh position={[0, 0.042, 0]} material={matChamfer}>
          <cylinderGeometry args={[0.04, 0.04, 0.005, 24]} />
        </mesh>
        {/* Workpiece resting at Pick Station */}
        <mesh ref={partAtPickRef} position={[0, 0.058, 0]} material={matWorkpiece} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.026, 16]} />
        </mesh>
      </group>

      {/* ── Industrial Place Conveyor Station ── */}
      <group position={[-0.34, 0, 0.30]}>
        <mesh position={[0, 0.02, 0]} material={matDarkAccent} castShadow receiveShadow>
          <boxGeometry args={[0.09, 0.04, 0.09]} />
        </mesh>
        <mesh position={[0, 0.042, 0]} material={matChamfer}>
          <boxGeometry args={[0.08, 0.005, 0.08]} />
        </mesh>
        {/* Deposited Workpiece at Place Station */}
        <mesh ref={partAtPlaceRef} position={[0, 0.058, 0]} material={matWorkpiece} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.026, 16]} />
        </mesh>
      </group>

      {/* Dynamic TCP Motion Trail */}
      <TcpTrail targetRef={tcpRef} />
    </group>
  );
}
