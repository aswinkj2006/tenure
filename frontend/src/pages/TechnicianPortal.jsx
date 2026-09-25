import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  RefreshCw,
  Send,
  Sparkles,
  Bot,
  User,
  ArrowLeft,
  Activity,
  Cpu,
  FileText,
  ThumbsUp,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import RobotTwin from '../components/RobotTwin/RobotTwin';
import useSensorStore from '../stores/sensorStore';
import { sendChat, submitFeedback, getAnomalies } from '../api/client';
import './TechnicianPortal.css';

export default function TechnicianPortal() {
  const { anomalyId } = useParams();
  const navigate = useNavigate();

  const [machineId, setMachineId] = useState('ur5e-001');
  const [incidentData, setIncidentData] = useState({
    id: anomalyId || 'inc-breakdown-01',
    machine_id: 'ur5e-001',
    severity: 'critical',
    status: 'open',
    flagged_sensors: ['joint_3_torque'],
    deviation_magnitude: { joint_3_torque: 48.5 },
    created_at: new Date().toISOString(),
  });

  const [messages, setMessages] = useState([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `**CRITICAL ALERT: EMERGENCY STOP ENGAGED FOR UR5e-001 (Incident ${anomalyId || 'INC-BREAKDOWN-01'})**\n\n**Diagnosis Summary:**\nA slowly rising torque drift was detected on Joint 3 (Elbow Harmonic Reducer), reaching **148.5 Nm** (rated safety maximum is 150.0 Nm). The autonomous zero-shot anomaly detector engaged the emergency safety stop to prevent catastrophic gear tooth shear.\n\n**Recommended First Actions:**\n1. Verify physical LOTO lock on UR5e main control cabinet.\n2. Inspect Joint 3 harmonic gearbox for lubricant degradation or foreign particulate ingress.\n3. Refer to Section 5.3 of the UR5e Service Manual (Lubrication: Mobilgrease 28 / Klüberplex BEM 34-132).\n\nAsk me any doubts regarding the disassembly, torque wrench specs, or verification steps.`,
      citations: [
        { source_ref: 'UR5e_Service_Manual.md#sec-4', text: 'Elbow Joint 3 rated envelope max 150 Nm. Over-torque indicates harmonic drive degradation.' },
        { source_ref: 'UR5e_Service_Manual.md#sec-5', text: 'Lubricate with Klüberplex BEM 34-132 or Mobilgrease 28 every 5,000 hrs.' },
      ],
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [isSubmittingFix, setIsSubmittingFix] = useState(false);
  const [technicianNotes, setTechnicianNotes] = useState('Replaced degraded grease in Joint 3 harmonic drive; verified backlash <0.02mm and cleared particulate obstruction.');
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Set store anomaly on Joint 3 (index 2) so 3D model highlights fault pose
    const store = useSensorStore.getState();
    store.triggerAnomaly(2);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const query = inputMessage.trim();
    if (!query || isSending) return;

    setInputMessage('');
    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);

    try {
      const res = await sendChat({
        machine_id: machineId,
        message: query,
        anomaly_id: anomalyId,
      });

      const aiReply = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: res.reply || res.response || 'Action confirmed. Proceed with manufacturer maintenance protocol.',
        citations: res.citations || [],
        ts: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiReply]);
    } catch (err) {
      toast.error('Failed to query AI Assistant: ' + err.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleMarkAsFixed = async () => {
    setIsSubmittingFix(true);
    try {
      // Submit positive reinforcement feedback to Orchestrator (rewards vector memory & restarts machine)
      const res = await submitFeedback({
        diagnosis_id: `diag-${anomalyId || '01'}`,
        anomaly_id: anomalyId,
        machine_id: machineId,
        outcome: 'confirmed',
        confirmed_cause: technicianNotes,
        verified: true,
      });

      // Clear store anomaly
      const store = useSensorStore.getState();
      store.clearAnomaly();

      setIsFixed(true);
      setFeedbackGiven(true);
      setIncidentData((prev) => ({ ...prev, status: 'resolved' }));

      toast.success('Machine Verified & Restarted!', {
        description: 'Vector memory rewarded with verified repair protocol. Safety stop cleared — pick-and-place resumed!',
      });
    } catch (err) {
      toast.error('Failed to submit resolution: ' + err.message);
    } finally {
      setIsSubmittingFix(false);
    }
  };

  return (
    <div className="technician-portal">
      {/* Top Banner / Breadcrumb */}
      <div className="portal-top-bar glass-strong">
        <div className="portal-top-left">
          <Link to="/" className="portal-back-btn">
            <ArrowLeft size={16} />
            <span>Fleet Dashboard</span>
          </Link>
          <div className="portal-divider" />
          <div className="portal-title-block">
            <span className="portal-incident-tag">
              <ShieldAlert size={14} />
              <span>INCIDENT {anomalyId || 'UR5E-BRK-001'}</span>
            </span>
            <h1 className="portal-heading">Dedicated Technician Fixer Workbench</h1>
          </div>
        </div>

        <div className="portal-status-badge">
          {isFixed ? (
            <div className="badge-resolved glass-subtle">
              <CheckCircle2 size={16} className="text-emerald" />
              <span>RESOLVED & RESTARTED</span>
            </div>
          ) : (
            <div className="badge-emergency-halt glass-subtle">
              <AlertTriangle size={16} className="text-crimson animate-pulse" />
              <span>E-STOP ENGAGED • KINEMATICS FROZEN</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Left = 3D Twin & Telemetry, Right = AI Guidance & Resolution */}
      <div className="portal-grid">
        {/* Left Column: 3D Twin & Sensor Diagnostics */}
        <div className="portal-left-col">
          <div className="portal-twin-card glass-strong">
            <div className="portal-card-header">
              <div className="header-meta">
                <Cpu size={18} className="text-terracotta" />
                <span className="card-title">UR5e-001 Digital Twin State</span>
              </div>
              <span className={`status-pill ${isFixed ? 'status-pill--active' : 'status-pill--fault'}`}>
                {isFixed ? 'Operating 60 FPS' : 'Arm Frozen at Fault Pose'}
              </span>
            </div>

            <div className="portal-twin-viewport">
              <RobotTwin compact={false} />
            </div>

            <div className="portal-fault-telemetry">
              <div className="fault-metric-box">
                <span className="metric-label">Joint 3 Elbow Torque</span>
                <span className={`metric-value ${isFixed ? 'text-emerald' : 'text-crimson'}`}>
                  {isFixed ? '48.2 Nm (Nominal)' : '148.5 Nm (Critical)'}
                </span>
                <div className="metric-bar">
                  <div
                    className={`metric-bar-fill ${isFixed ? 'fill-emerald' : 'fill-crimson'}`}
                    style={{ width: isFixed ? '32%' : '98%' }}
                  />
                </div>
              </div>

              <div className="fault-metric-box">
                <span className="metric-label">Harmonic Drive Temperature</span>
                <span className={`metric-value ${isFixed ? 'text-emerald' : 'text-amber'}`}>
                  {isFixed ? '42.1 °C' : '64.5 °C (Drift)'}
                </span>
                <div className="metric-bar">
                  <div
                    className={`metric-bar-fill ${isFixed ? 'fill-emerald' : 'fill-amber'}`}
                    style={{ width: isFixed ? '40%' : '78%' }}
                  />
                </div>
              </div>

              <div className="fault-metric-box">
                <span className="metric-label">Sub-Pixel Micro-Vibration</span>
                <span className={`metric-value ${isFixed ? 'text-emerald' : 'text-amber'}`}>
                  {isFixed ? '0.04 g' : '4.82 g (Wear)'}
                </span>
                <div className="metric-bar">
                  <div
                    className={`metric-bar-fill ${isFixed ? 'fill-emerald' : 'fill-amber'}`}
                    style={{ width: isFixed ? '20%' : '88%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Slack Escalation Receipt */}
          <div className="portal-slack-receipt glass-subtle">
            <div className="slack-header">
              <div className="slack-icon-badge">#</div>
              <span>Automated Slack Alert dispatched to <strong>#fixer-ai-escalations</strong></span>
            </div>
            <p className="slack-text">
              "[CRITICAL] Emergency Breakdown predicted on ur5e-001: Automatic E-Stop engaged. Technician assistance required. Assigned to Lead Mechatronics Technician."
            </p>
          </div>
        </div>

        {/* Right Column: AI Guidance Chat & Feedback Resolution */}
        <div className="portal-right-col">
          {/* Chat Window */}
          <div className="portal-chat-card glass-strong">
            <div className="portal-card-header">
              <div className="header-meta">
                <Sparkles size={18} className="text-terracotta" />
                <span className="card-title">Grounded AI Technician Assistant (RAG)</span>
              </div>
              <span className="model-badge">Gemini Flash • UR5e Service Manual</span>
            </div>

            <div className="portal-messages-scroll">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`portal-message ${m.sender === 'user' ? 'portal-message--user' : 'portal-message--ai'}`}
                >
                  <div className="message-sender-tag">
                    {m.sender === 'user' ? <User size={13} /> : <Bot size={13} />}
                    <span>{m.sender === 'user' ? 'Technician' : 'Tenure AI Engine'}</span>
                    <span className="message-time">{m.ts}</span>
                  </div>
                  <div className="message-body" style={{ whiteSpace: 'pre-wrap' }}>
                    {m.text}
                  </div>
                  {m.citations && m.citations.length > 0 && (
                    <div className="message-citations">
                      <span className="citation-header">
                        <FileText size={12} /> Grounded OEM Sources:
                      </span>
                      {m.citations.map((c, i) => (
                        <span key={i} className="citation-pill" title={c.text}>
                          {c.source_ref}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isSending && (
                <div className="portal-message portal-message--ai portal-message--loading">
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Consulting technical documentation and kinematic telemetry...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            {!isFixed && (
              <div className="quick-prompts">
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => setInputMessage('What torque wrench spec is required for Joint 3 housing bolts?')}
                >
                  Torque wrench spec?
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => setInputMessage('Which lubricant is OEM certified for the harmonic drive?')}
                >
                  Certified grease?
                </button>
                <button
                  type="button"
                  className="quick-chip"
                  onClick={() => setInputMessage('What are the verification steps before clearing the emergency stop?')}
                >
                  E-Stop clear checklist?
                </button>
              </div>
            )}

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="portal-chat-input-form">
              <input
                type="text"
                className="portal-input"
                placeholder={isFixed ? 'Repair verified. Ask any follow-up questions...' : 'Ask doubts about disassembly, torque specs, or grease...'}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isSending}
              />
              <button type="submit" className="portal-send-btn" disabled={!inputMessage.trim() || isSending}>
                <Send size={15} />
              </button>
            </form>
          </div>

          {/* Mark as Fixed & RLHF Feedback Box */}
          <div className="portal-resolution-card glass-strong">
            <h3 className="resolution-title">
              <Wrench size={18} className="text-terracotta" />
              <span>Technician Verification & Machine Restart</span>
            </h3>

            {!isFixed ? (
              <div className="resolution-action-box">
                <div className="resolution-field">
                  <label className="resolution-label">Technician Intervention Notes (Indexed for Continuous Learning)</label>
                  <input
                    type="text"
                    className="portal-input"
                    value={technicianNotes}
                    onChange={(e) => setTechnicianNotes(e.target.value)}
                  />
                </div>

                <div className="resolution-buttons">
                  <button
                    type="button"
                    className="btn-mark-fixed glass-sheen"
                    onClick={handleMarkAsFixed}
                    disabled={isSubmittingFix}
                  >
                    {isSubmittingFix ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" />
                        <span>Updating Vector Memory & Restarting...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Mark as Fixed & Restart Machine</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="resolution-success-box">
                <div className="success-banner">
                  <CheckCircle2 size={24} className="text-emerald" />
                  <div>
                    <h4>Breakdown Cleared — Machine Operational</h4>
                    <p>
                      Feedback recorded in ChromaDB. The AI engine rewarded its weights with your verified repair procedure. The UR5e has restarted its automated pick-and-place cycle.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-back-dashboard"
                  onClick={() => navigate('/machine/ur5e-001')}
                >
                  <span>View Live Machine Digital Twin</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
