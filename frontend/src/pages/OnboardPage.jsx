import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlusCircle, FileText, CheckCircle2, ArrowRight, Bot, Cpu, ShieldAlert, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { onboardMachine } from '../api/client';
import './OnboardPage.css';

const SAMPLE_MANUAL_UR5E = `### Universal Robots UR5e Technical Specifications & Service Manual
1. Mechanical Architecture: 6-degree-of-freedom articulated robotic arm.
2. Nominal Payload: 5.0 kg (11 lbs). Maximum Reach: 850 mm (33.5 in).
3. Joint Speed Limits: Base & Shoulder: ±180°/s; Elbow & Wrists: ±180°/s (Wrist 3: ±360°/s).
4. Joint Torque Limits:
   - Base (Joint 1): 150 Nm
   - Shoulder (Joint 2): 150 Nm
   - Elbow (Joint 3): 150 Nm (Warning threshold: 140 Nm; Critical E-stop: 150 Nm)
   - Wrist 1 (Joint 4): 28 Nm
   - Wrist 2 (Joint 5): 28 Nm
   - Wrist 3 (Joint 6): 28 Nm
5. Diagnostic & Anomaly Signatures:
   - Elbow Torque Spikes (>145 Nm): Indicates harmonic reducer gear degradation, mechanical collision with workpiece fixture, or foreign particulate obstruction.
   - Thermal Drift (>55°C): Inspect heat sink dissipation fins and fan ventilation ducts.
   - Recommended Lubrication: Mobilgrease 28 or Klüberplex BEM 34-132 every 5,000 operational hours.`;

const SAMPLE_MANUAL_KUKA = `### KUKA KR10 Cybertech Technical Data
1. Configuration: 6-Axis Articulated Industrial Robot.
2. Rated Payload: 10.0 kg. Maximum Reach: 1420 mm.
3. Repeatability (ISO 9283): ±0.03 mm.
4. Protection Rating: IP65 / Foundry Option IP67.
5. Axis Data (Range of Motion):
   - A1: ±185°, Speed 300°/s
   - A2: -185° / +65°, Speed 225°/s
   - A3: -138° / +175°, Speed 225°/s
   - A4: ±350°, Speed 381°/s
   - A5: ±130°, Speed 381°/s
   - A6: ±350°, Speed 492°/s
6. Preventative Maintenance:
   - Replace synthetic gear oil in A1-A6 gearboxes every 20,000 operating hours.
   - Check belt tension on wrist axes quarterly.`;

export default function OnboardPage() {
  const [formData, setFormData] = useState({
    machine_id: 'ur5e-002',
    name: 'Universal Robots UR5e — Cell B Palletizer',
    type: 'robot_arm',
    location: 'Bay 4 — Palletizing Station 2',
    payload_kg: '5.0',
    reach_mm: '850',
    manual_text: SAMPLE_MANUAL_UR5E,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0); // 0: Idle, 1: Kinematics, 2: Envelope, 3: Vector RAG, 4: Done
  const [createdMachineId, setCreatedMachineId] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLoadSample = (sampleType) => {
    if (sampleType === 'ur5e') {
      setFormData({
        machine_id: 'ur5e-002',
        name: 'Universal Robots UR5e — Cell B Palletizer',
        type: 'robot_arm',
        location: 'Bay 4 — Palletizing Station 2',
        payload_kg: '5.0',
        reach_mm: '850',
        manual_text: SAMPLE_MANUAL_UR5E,
      });
      toast.info('Loaded UR5e Specification & Service Manual');
    } else {
      setFormData({
        machine_id: 'kuka-kr10-01',
        name: 'KUKA KR10 Cybertech — Cell C Welding',
        type: 'robot_arm',
        location: 'Bay 2 — Heavy Arc Welding Cell',
        payload_kg: '10.0',
        reach_mm: '1420',
        manual_text: SAMPLE_MANUAL_KUKA,
      });
      toast.info('Loaded KUKA KR10 Specification Sheet');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_id.trim() || !formData.name.trim()) {
      toast.error('Please specify both Machine ID and Machine Name.');
      return;
    }

    try {
      setIsSubmitting(true);
      setPipelineStep(1); // Stage 1: Parsing Kinematics

      await new Promise((r) => setTimeout(r, 600));
      setPipelineStep(2); // Stage 2: Calibrating Nominal Envelopes

      await new Promise((r) => setTimeout(r, 600));
      setPipelineStep(3); // Stage 3: Indexing Vector Memory

      // Call API
      const res = await onboardMachine({
        machine_id: formData.machine_id,
        name: formData.name,
        type: formData.type,
        location: formData.location,
        manual_text: formData.manual_text,
      });

      await new Promise((r) => setTimeout(r, 600));
      setPipelineStep(4); // Stage 4: Done
      setCreatedMachineId(formData.machine_id);

      toast.success(`Asset ${formData.name} Registered!`, {
        description: 'Kinematics parsed, vector memory indexed, and telemetry initialized.',
      });
    } catch (err) {
      toast.error(`Onboarding failed: ${err.message}`);
      setPipelineStep(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="onboard-page">
      <div className="onboard-header">
        <h1 className="onboard-title">Onboard Industrial Asset</h1>
        <p className="onboard-subtitle">
          Register new robotic manipulators, ingest technical service manuals into isolated ChromaDB vector memory,
          and initialize telemetry streams.
        </p>
      </div>

      <div className="onboard-grid">
        {/* Left Column: Form */}
        <div className="onboard-form-card glass-strong">
          <h2 className="form-section-title">
            <Cpu size={20} className="text-terracotta" />
            <span>Asset Identification & Kinematics</span>
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-row">
              <div className="onboard-field">
                <label className="onboard-label" htmlFor="machine_id">
                  <span>Asset Unique ID</span>
                  <span className="onboard-hint">e.g. ur5e-002</span>
                </label>
                <input
                  id="machine_id"
                  name="machine_id"
                  type="text"
                  className="onboard-input"
                  value={formData.machine_id}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="onboard-field">
                <label className="onboard-label" htmlFor="type">
                  <span>Kinematic Classification</span>
                </label>
                <select
                  id="type"
                  name="type"
                  className="onboard-select"
                  value={formData.type}
                  onChange={handleChange}
                >
                  <option value="robot_arm">6-DOF Articulated Arm (e.g. UR5e)</option>
                  <option value="scara">4-DOF SCARA Assembly Unit</option>
                  <option value="gantry">Cartesian 3-Axis Gantry</option>
                  <option value="cnc">5-Axis CNC Milling Station</option>
                </select>
              </div>
            </div>

            <div className="onboard-field">
              <label className="onboard-label" htmlFor="name">
                <span>Display Name / Workcell Description</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="onboard-input"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="onboard-field">
                <label className="onboard-label" htmlFor="location">
                  <span>Physical Bay / Location</span>
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  className="onboard-input"
                  value={formData.location}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row" style={{ gap: '8px' }}>
                <div className="onboard-field">
                  <label className="onboard-label" htmlFor="payload_kg">
                    <span>Payload</span>
                  </label>
                  <input
                    id="payload_kg"
                    name="payload_kg"
                    type="text"
                    className="onboard-input"
                    value={formData.payload_kg}
                    onChange={handleChange}
                    placeholder="kg"
                  />
                </div>
                <div className="onboard-field">
                  <label className="onboard-label" htmlFor="reach_mm">
                    <span>Reach</span>
                  </label>
                  <input
                    id="reach_mm"
                    name="reach_mm"
                    type="text"
                    className="onboard-input"
                    value={formData.reach_mm}
                    onChange={handleChange}
                    placeholder="mm"
                  />
                </div>
              </div>
            </div>

            <div className="onboard-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <label className="onboard-label" htmlFor="manual_text" style={{ margin: 0 }}>
                  <span>Technical Documentation & Manual (RAG Knowledge Source)</span>
                </label>
                <div className="docs-actions">
                  <button
                    type="button"
                    className="secondary-pill-btn"
                    onClick={() => handleLoadSample('ur5e')}
                  >
                    <Sparkles size={12} />
                    <span>Load UR5e Spec</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-pill-btn"
                    onClick={() => handleLoadSample('kuka')}
                  >
                    <Sparkles size={12} />
                    <span>Load KUKA Spec</span>
                  </button>
                </div>
              </div>
              <textarea
                id="manual_text"
                name="manual_text"
                className="onboard-textarea"
                value={formData.manual_text}
                onChange={handleChange}
                placeholder="Paste service manual sections, torque thresholds, or lubrication guides..."
              />
            </div>

            <button
              type="submit"
              className="submit-onboard-btn"
              disabled={isSubmitting}
            >
              <PlusCircle size={18} />
              <span>{isSubmitting ? 'Ingesting Knowledge & Setting Up...' : 'Register Asset & Build Vector Index'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Pipeline Status & Quick Links */}
        <div className="onboard-info-column">
          {pipelineStep === 4 && createdMachineId ? (
            <motion.div
              className="success-box glass-strong"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <div className="success-icon">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="success-title">Asset Operational!</h3>
              <p className="success-desc">
                <strong>{formData.name}</strong> is now live in the fleet registry. Vector chunks are indexed for instant technician citations.
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Link to={`/machine/${createdMachineId}`} className="view-twin-btn">
                  <span>View Digital Twin</span>
                  <ArrowRight size={14} />
                </Link>
                <Link to="/" className="secondary-pill-btn" style={{ padding: '10px 16px', marginTop: '8px' }}>
                  <span>Back to Fleet</span>
                </Link>
              </div>
            </motion.div>
          ) : (
            <div className="info-banner-card glass-strong">
              <h3 className="info-banner-title">
                <Bot size={18} className="text-terracotta" />
                <span>Onboarding Pipeline Architecture</span>
              </h3>

              <ul className="steps-list">
                <li className="step-item">
                  <div className={`step-number ${pipelineStep > 1 ? 'step-number--done' : pipelineStep === 1 ? 'step-number--active' : ''}`}>
                    {pipelineStep > 1 ? '✓' : '1'}
                  </div>
                  <div className="step-text">
                    <div className="step-title">Kinematics & Forward Joint Solver</div>
                    <span>Extracts DH kinematic matrices and 3D visual geometry boundaries.</span>
                  </div>
                </li>

                <li className="step-item">
                  <div className={`step-number ${pipelineStep > 2 ? 'step-number--done' : pipelineStep === 2 ? 'step-number--active' : ''}`}>
                    {pipelineStep > 2 ? '✓' : '2'}
                  </div>
                  <div className="step-text">
                    <div className="step-title">Nominal Operating Envelope</div>
                    <span>Calibrates baseline Z-scores, peak torque ratings, and thermal thresholds.</span>
                  </div>
                </li>

                <li className="step-item">
                  <div className={`step-number ${pipelineStep > 3 ? 'step-number--done' : pipelineStep === 3 ? 'step-number--active' : ''}`}>
                    {pipelineStep > 3 ? '✓' : '3'}
                  </div>
                  <div className="step-text">
                    <div className="step-title">Isolated Vector Index (ChromaDB)</div>
                    <span>Partitions documentation chunks for cited RAG diagnostic inference.</span>
                  </div>
                </li>

                <li className="step-item">
                  <div className={`step-number ${pipelineStep === 4 ? 'step-number--done' : ''}`}>
                    {pipelineStep === 4 ? '✓' : '4'}
                  </div>
                  <div className="step-text">
                    <div className="step-title">Telemetry & ProtoTwin Handshake</div>
                    <span>Binds real-time 20Hz WebSocket stream with digital twin scene.</span>
                  </div>
                </li>
              </ul>
            </div>
          )}

          <div className="info-banner-card glass">
            <h4 style={{ margin: '0 0 8px 0', fontFamily: 'var(--font-heading)', fontSize: '0.9375rem' }}>
              Multi-Asset Fleet Readiness
            </h4>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              All onboarded machines maintain isolated RAG vector namespaces, preventing cross-contamination of diagnostic manuals and safety codes between different manufacturer models.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
