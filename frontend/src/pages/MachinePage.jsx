import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import { JointCard, TCPCard } from '../components/SensorCard/SensorCard';
import AlertBanner from '../components/AlertBanner/AlertBanner';
import RobotTwin from '../components/RobotTwin/RobotTwin';
import BodyMap from '../components/BodyMap/BodyMap';
import HealthTimeline from '../components/HealthTimeline/HealthTimeline';
import JointHeatmap from '../components/JointHeatmap/JointHeatmap';
import Chatbot from '../components/Chatbot/Chatbot';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';
import useSensors from '../hooks/useSensors';
import useAlerts from '../hooks/useAlerts';
import useChat from '../hooks/useChat';
import useSensorStore from '../stores/sensorStore';
import { getMachine } from '../api/client';
import { healthLabel } from '../utils/format';
import { staggerContainerVariants, itemFadeUpVariants } from '../utils/motion';
import './MachinePage.css';

/**
 * Magnetic button wrapper for primary action
 */
function MagneticButton({ children, onClick, className }) {
  const btnRef = useRef(null);

  const handleMouseMove = (e) => {
    const btn = btnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.22}px, ${y * 0.22}px)`;
  };

  const handleMouseLeave = () => {
    const btn = btnRef.current;
    if (!btn) return;
    btn.style.transform = 'translate(0px, 0px)';
  };

  return (
    <button
      ref={btnRef}
      type="button"
      className={className}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
    >
      {children}
    </button>
  );
}

export default function MachinePage() {
  const { id } = useParams();
  const machineId = id || 'ur5e-001';

  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { sensors, sensorHistory, isConnected, simulateAnomaly } = useSensors(machineId);
  const { activeAlert, dismissAlert, triggerMockAlert } = useAlerts(machineId);
  const { messages, isLoading: chatLoading, send: sendMessage, submitFeedback, loadAnomalyContext } = useChat(machineId);

  const anomalyActive = useSensorStore((s) => s.anomalyActive);

  const fetchMachine = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMachine(machineId);
      setMachine(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMachine();
  }, [machineId]);

  useEffect(() => {
    if (activeAlert) {
      loadAnomalyContext(activeAlert);
    }
  }, [activeAlert, loadAnomalyContext]);

  const [isRamping, setIsRamping] = useState(false);
  const [eStopEngaged, setEStopEngaged] = useState(false);
  const [currentRampTorque, setCurrentRampTorque] = useState(48.0);

  const handleSimulateGradualBreakdown = async () => {
    setIsRamping(true);
    setEStopEngaged(false);
    setCurrentRampTorque(48.0);

    // Call backend gradual degradation
    try {
      await fetch('http://localhost:8001/simulate-gradual-degradation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joint: 3, rate: 22.0 }),
      });
    } catch (e) {
      console.warn('Backend degradation note:', e);
    }

    // Step-wise visual ramp for presentation showcase
    let currentT = 48.0;
    const interval = setInterval(async () => {
      currentT += 24.5;
      setCurrentRampTorque(Math.min(148.5, currentT));

      if (currentT >= 148.0) {
        clearInterval(interval);
        setIsRamping(false);
        setEStopEngaged(true);

        // Engage store anomaly & E-stop
        useSensorStore.getState().triggerAnomaly(2);

        // Trigger alert and Slack notification
        const anomId = `brk-${Date.now().toString(36)}`;
        try {
          await fetch('http://localhost:8002/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              anomaly_id: anomId,
              machine_id: machineId,
              severity: 'critical',
              flagged_sensors: ['joint_3_torque'],
              deviation_magnitude: { joint_3_torque: 48.5 },
              message: 'Elbow joint harmonic reducer gear torque drift (>145 Nm). Automatic E-Stop engaged to protect kinematic drive train.',
            }),
          });
        } catch (err) {
          console.warn('Alert dispatch note:', err);
        }

        toast.error('EMERGENCY BREAKDOWN PREDICTED!', {
          description: 'Joint 3 torque reached 148.5 Nm. Automatic E-Stop engaged. Slack alert dispatched to #fixer-ai-escalations!',
        });
      }
    }, 900);
  };

  const handleResetEStop = async () => {
    setEStopEngaged(false);
    setIsRamping(false);
    setCurrentRampTorque(48.0);
    useSensorStore.getState().clearAnomaly();

    try {
      await fetch('http://localhost:8001/reset-safety-stop', { method: 'POST' });
      await fetch('http://localhost:8001/clear-anomaly', { method: 'POST' });
    } catch (e) {
      console.warn('Reset note:', e);
    }
    toast.success('Safety Stop Cleared — Pick-and-Place Resumed');
  };

  if (error) {
    return <ErrorState title="Couldn't load machine" message={error} onRetry={fetchMachine} />;
  }

  const heroText = eStopEngaged || anomalyActive || activeAlert
    ? 'Elbow joint harmonic drive reached critical threshold (148.5 Nm). Automatic safety stop engaged.'
    : machine
    ? `All 6 joints operating within safe tolerance envelopes. Machine is running smooth pick-and-place cycle.`
    : 'Connecting to UR5e real-time telemetry...';

  const heroSub = machine
    ? `${machine.name} · Universal Robots UR5e · ${healthLabel(eStopEngaged ? 38.0 : machine.health_score)} · Health ${eStopEngaged ? '38.0' : machine.health_score}%`
    : '';

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="machine-page"
    >
      {/* Alert banner */}
      <AlertBanner alert={activeAlert} onDismiss={dismissAlert} />

      {/* Emergency Breakdown & Slack Escalation Callout Banner */}
      {eStopEngaged && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="emergency-breakdown-banner glass-strong"
        >
          <div className="banner-left">
            <span className="pulse-danger-dot" />
            <div>
              <h3 className="banner-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShieldAlert size={18} />
                <span>AUTOMATIC SAFETY STOP ENGAGED • KINEMATICS FROZEN</span>
              </h3>
              <p className="banner-sub">
                Predictive breakdown prevented catastrophic failure on Joint 3 Harmonic Drive. Slack alert dispatched to <strong>#fixer-ai-escalations</strong>.
              </p>
            </div>
          </div>
          <div className="banner-actions">
            <button
              type="button"
              className="btn-launch-fixer"
              onClick={() => (window.location.href = `/technician/anom-breakdown-${Date.now()}`)}
            >
              <span>Open Dedicated Technician Portal</span>
            </button>
            <button
              type="button"
              className="btn-reset-simple"
              onClick={handleResetEStop}
            >
              <span>Reset E-Stop</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Status hero */}
      <motion.div
        variants={itemFadeUpVariants}
        className={`machine-hero glass glass-sheen ${eStopEngaged || anomalyActive ? 'machine-hero--anomaly' : ''}`}
      >
        {loading ? (
          <Skeleton variant="heading" width="50%" />
        ) : (
          <div className="machine-hero__text">
            {heroText}
            <span>{heroSub}</span>
          </div>
        )}

        <svg className="machine-hero__watermark" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M20 100 L40 100 L50 80 L75 40 L95 50 L105 60" />
          <circle cx="50" cy="80" r="4" fill="currentColor" opacity="0.3" />
          <circle cx="75" cy="40" r="4" fill="currentColor" opacity="0.3" />
          <circle cx="95" cy="50" r="3" fill="currentColor" opacity="0.3" />
          <path d="M105 60 L112 65 M105 60 L112 55" strokeWidth="1.5" />
        </svg>
      </motion.div>

      {/* Breakdown Prediction & Simulation Bar */}
      <motion.div variants={itemFadeUpVariants} className="dev-controls glass-subtle">
        <div className="dev-controls__badge">
          <span className="dev-controls__label font-mono">Breakdown Simulation</span>
        </div>
        <span className="dev-controls__text">
          {isRamping ? (
            <strong className="text-amber animate-pulse">
              Simulating gradual harmonic drive wear... Torque drifting: {currentRampTorque.toFixed(1)} Nm / 150 Nm
            </strong>
          ) : eStopEngaged ? (
            <strong className="text-crimson">
              Critical breakdown threshold exceeded (148.5 Nm). E-Stop active. Arm frozen.
            </strong>
          ) : (
            'Simulate a slowly rising mechanical degradation condition leading to automatic E-Stop and Slack technician dispatch.'
          )}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <MagneticButton
            className="dev-controls__btn"
            onClick={handleSimulateGradualBreakdown}
            disabled={isRamping}
          >
            {isRamping ? 'Degradation in Progress...' : 'Simulate Gradual Breakdown'}
          </MagneticButton>
          {eStopEngaged && (
            <button
              type="button"
              className="dev-controls__btn"
              onClick={handleResetEStop}
              style={{ background: '#2E7D32', color: '#fff' }}
            >
              Reset Safety Stop
            </button>
          )}
        </div>
      </motion.div>

      {/* Primary 3D & Telemetry Grid */}
      <div className="machine-v2-grid">
        {/* Left: 3D Digital Twin & 24h Timelines */}
        <motion.div variants={itemFadeUpVariants} className="machine-twin-col">
          <div className="machine-twin-wrapper">
            <RobotTwin />
          </div>
          <HealthTimeline />
          <JointHeatmap />
        </motion.div>

        {/* Right: Body Map & Joint Sensor Cards */}
        <motion.div variants={itemFadeUpVariants} className="machine-telemetry-col">
          <BodyMap />

          <div className="sensor-grid-v2">
            {loading || !sensors ? (
              Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} variant="card" />
              ))
            ) : (
              <>
                {[1, 2, 3, 4, 5, 6].map((n) => {
                  const jointKey = `joint_${n}`;
                  return (
                    <JointCard
                      key={jointKey}
                      jointKey={jointKey}
                      data={sensors[jointKey]}
                      history={sensorHistory[`${jointKey}_torque`] || []}
                    />
                  );
                })}
                <TCPCard data={sensors.tcp} />
              </>
            )}
          </div>
        </motion.div>
      </div>

      {/* Full-width Ask Tenure Chat Section */}
      <motion.div variants={itemFadeUpVariants} className="machine-chat-section">
        <Chatbot
          messages={messages}
          isLoading={chatLoading}
          onSend={sendMessage}
          onFeedback={submitFeedback}
          title="Ask Tenure — AI Machine Technician"
          placeholder="Ask questions about telemetry, operating limits, or maintenance history..."
        />
      </motion.div>
    </motion.div>
  );
}
