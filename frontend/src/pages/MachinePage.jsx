import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { JointCard, TCPCard } from '../components/SensorCard/SensorCard';
import AlertBanner from '../components/AlertBanner/AlertBanner';
import RobotTwin from '../components/RobotTwin/RobotTwin';
import BodyMap from '../components/BodyMap/BodyMap';
import HealthTimeline from '../components/HealthTimeline/HealthTimeline';
import Chatbot from '../components/Chatbot/Chatbot';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';
import useSensors from '../hooks/useSensors';
import useAlerts from '../hooks/useAlerts';
import useChat from '../hooks/useChat';
import useSensorStore from '../stores/sensorStore';
import { getMachine } from '../api/client';
import { healthLabel } from '../utils/format';
import './MachinePage.css';

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
  const anomalyJoint = useSensorStore((s) => s.anomalyJoint);

  // Fetch machine data
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

  // When alert fires, load context into chatbot
  useEffect(() => {
    if (activeAlert) {
      loadAnomalyContext(activeAlert);
    }
  }, [activeAlert, loadAnomalyContext]);

  // Simulate anomaly: trigger sensor spike + alert
  const handleSimulateAnomaly = () => {
    simulateAnomaly(2); // Joint 3 (elbow)
    triggerMockAlert('joint_3_torque');
  };

  if (error) {
    return <ErrorState title="Couldn't load machine" message={error} onRetry={fetchMachine} />;
  }

  // Build hero text
  const heroText = anomalyActive || activeAlert
    ? 'Elbow joint is experiencing an unexpected torque spike. Automated diagnosis in progress.'
    : machine
    ? `All 6 joints operating within safe tolerance envelopes. Machine is running smoothly.`
    : 'Connecting to UR5e real-time telemetry...';

  const heroSub = machine
    ? `${machine.name} · Universal Robots UR5e · ${healthLabel(anomalyActive ? 76.5 : machine.health_score)} · Health ${anomalyActive ? '76.5' : machine.health_score}%`
    : '';

  return (
    <div className="machine-page">
      {/* Alert banner */}
      <AlertBanner alert={activeAlert} onDismiss={dismissAlert} />

      {/* Status hero */}
      <div className={`machine-hero ${anomalyActive ? 'machine-hero--anomaly' : ''}`}>
        {loading ? (
          <Skeleton variant="heading" width="50%" />
        ) : (
          <div className="machine-hero__text">
            {heroText}
            <span>{heroSub}</span>
          </div>
        )}
        
        {/* Line art robot watermark */}
        <svg className="machine-hero__watermark" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M20 100 L40 100 L50 80 L75 40 L95 50 L105 60" />
          <circle cx="50" cy="80" r="4" fill="currentColor" opacity="0.3" />
          <circle cx="75" cy="40" r="4" fill="currentColor" opacity="0.3" />
          <circle cx="95" cy="50" r="3" fill="currentColor" opacity="0.3" />
          <path d="M105 60 L112 65 M105 60 L112 55" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Dev controls */}
      <div className="dev-controls">
        <div className="dev-controls__badge">
          <span className="dev-controls__label">Test Simulation</span>
        </div>
        <span className="dev-controls__text">Trigger a simulated collision / over-torque anomaly to verify 3D camera zoom, alerts & AI diagnosis</span>
        <button
          type="button"
          className="dev-controls__btn"
          onClick={handleSimulateAnomaly}
        >
          Simulate Anomaly
        </button>
      </div>

      {/* Primary 3D & Telemetry Grid */}
      <div className="machine-v2-grid">
        {/* Left: 3D Digital Twin & 24h Timeline */}
        <div className="machine-twin-col">
          <div className="machine-twin-wrapper">
            <RobotTwin />
          </div>
          <HealthTimeline />
        </div>

        {/* Right: Body Map & Joint Sensor Cards */}
        <div className="machine-telemetry-col">
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
        </div>
      </div>

      {/* Full-width Ask Tenure Chat Section */}
      <div className="machine-chat-section">
        <Chatbot
          messages={messages}
          isLoading={chatLoading}
          onSend={sendMessage}
          onFeedback={submitFeedback}
          title="Ask Tenure — AI Machine Technician"
          placeholder="Ask questions about telemetry, operating limits, or maintenance history..."
        />
      </div>
    </div>
  );
}
