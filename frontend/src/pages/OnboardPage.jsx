import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlusCircle,
  FileText,
  CheckCircle2,
  ArrowRight,
  Bot,
  Cpu,
  ShieldAlert,
  Sparkles,
  Globe,
  UploadCloud,
  Box,
  Layers,
  Database,
  Camera,
  Activity,
  Thermometer,
  Eye,
  Radio,
  RefreshCw,
  Sliders,
  Check,
} from 'lucide-react';
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

const INBUILT_MODELS = [
  {
    id: 'ur5e-001',
    modelKey: 'ur5e',
    name: 'Universal Robots UR5e — Cell A',
    modelName: 'Universal Robots UR5e',
    manufacturer: 'Universal Robots A/S',
    type: 'robot_arm',
    location: 'Cell A — Precision Assembly',
    payload_kg: '5.0',
    reach_mm: '850',
    cadFile: 'UR5e_Kinematics_Assembly.step',
    scenarioId: 'recurrence',
    scenarioTitle: 'Scenario 1: xAI Recurrence Intelligence',
    scenarioBadge: 'Hardware Fault vs Skill Gap',
    scenarioDesc: 'Analyzes 3 prior failed repair attempts on Joint 3 torque drift. Causal engine determines hardware fault vs technician skill gap with long-term fix.',
    manual_text: SAMPLE_MANUAL_UR5E,
  },
  {
    id: 'kuka-kr10',
    modelKey: 'kuka',
    name: 'KUKA KR 10 Cybertech — Bay 2',
    modelName: 'KUKA KR 10 Cybertech R1420',
    manufacturer: 'KUKA AG',
    type: 'robot_arm',
    location: 'Bay 2 — Heavy Arc Welding',
    payload_kg: '10.0',
    reach_mm: '1420',
    cadFile: 'KUKA_KR10_Kinematics.step',
    scenarioId: 'availability',
    scenarioTitle: 'Scenario 2: Technician Availability Fallback',
    scenarioBadge: 'Autonomous Skill Cascade',
    scenarioDesc: 'Top specialist Sarah Chen (98% match) is Busy on another cell. Agent automatically cascades to next best qualified available engineer Marcus Vance to prevent $1,200/hr downtime.',
    manual_text: `### KUKA KR 10 Cybertech R1420 Technical Datasheet\n1. Mechanical Architecture: 6-axis industrial articulated robot.\n2. Rated Payload: 10.0 kg. Maximum Reach: 1,420 mm.\n3. Repeatability: ±0.04 mm.\n4. Nominal Joint Torques: Axis 1: 280 Nm; Axis 2: 320 Nm; Axis 3: 210 Nm; Axis 5: 55 Nm.\n5. Lubrication: Castrol Optimol Optigear Synthetic A6 every 10,000 hrs.`,
  },
  {
    id: 'fanuc-crx10',
    modelKey: 'fanuc',
    name: 'FANUC CRX-10iA — Line 1',
    modelName: 'FANUC CRX-10iA Collaborative Robot',
    manufacturer: 'FANUC Corporation',
    type: 'robot_arm',
    location: 'Line 1 — End-of-Line Packaging',
    payload_kg: '10.0',
    reach_mm: '1249',
    cadFile: 'FANUC_CRX10_Kinematics.step',
    scenarioId: 'procurement',
    scenarioTitle: 'Scenario 3: Autonomous Multi-Vendor Procurement',
    scenarioBadge: 'xAI Validation & Multi-Vendor Fallback',
    scenarioDesc: 'Part #FANUC-A06B-0115 is Out of Stock. Primary vendor Apex has 14-day backlog. Agent auto-cascades to MotionPro (1-day delivery), withheld by xAI validation gate.',
    manual_text: `### FANUC CRX-10iA Service Manual & Specifications\n1. Mechanical Architecture: 6-axis smooth collaborative robot.\n2. Rated Payload: 10.0 kg. Reach: 1,249 mm.\n3. Motion Envelope: High sensitivity contact stop sensorized skin.\n4. Axis 4 AC Servo Motor: Part #FANUC-A06B-0115 (Alpha-i4/5000).\n5. Maintenance: Molywhite RE No. 00 Grease every 8,000 hrs.`,
  },
  {
    id: 'abb-irb1200',
    modelKey: 'abb',
    name: 'ABB IRB 1200-5/0.9 — Cell C',
    modelName: 'ABB IRB 1200-5/0.9',
    manufacturer: 'ABB Robotics',
    type: 'robot_arm',
    location: 'Cell C — Machining & Pick-and-Place',
    payload_kg: '5.0',
    reach_mm: '901',
    cadFile: 'ABB_IRB1200_Kinematics.step',
    scenarioId: 'telemetry',
    scenarioTitle: 'Scenario 4: Live Telemetry & Economic Yield',
    scenarioBadge: 'Real-time Profit & Risk Model',
    scenarioDesc: 'High-speed assembly baseline. Real-time yield calculator displays $450/hr profit generation, expected repair in 4,820 hrs, and $32,400 saved by zero-shot detector.',
    manual_text: `### ABB IRB 1200-5/0.9 Technical Specifications\n1. Mechanical Architecture: Compact 6-axis industrial robot.\n2. Rated Payload: 5.0 kg. Working Range: 901 mm.\n3. Cycle Time: Fast working envelope machine tending.\n4. Gear Lubricant: Shell Omala S4 WE 320 every 6,000 operational hours.\n5. Rated Radial Seals: Viton seal kit Part #ABB-SEAL-1200.`,
  },
];

export default function OnboardPage() {
  const navigate = useNavigate();

  // Selected Inbuilt Model preset
  const [selectedInbuiltModel, setSelectedInbuiltModel] = useState('ur5e-001');

  // ── Mode Switch: 'docs' | 'manual' | 'scrape' ──
  const [inputMode, setInputMode] = useState('docs');

  // Form specifications
  const [formData, setFormData] = useState({
    machine_id: 'ur5e-001',
    name: 'Universal Robots UR5e — Cell A',
    type: 'robot_arm',
    location: 'Cell A — Precision Assembly',
    payload_kg: '5.0',
    reach_mm: '850',
    manual_text: SAMPLE_MANUAL_UR5E,
  });

  // Scraping query
  const [scrapeQuery, setScrapeQuery] = useState('Universal Robots UR5e');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedInfo, setScrapedInfo] = useState(null);

  // Document upload state
  const [uploadedDocName, setUploadedDocName] = useState('UR5e_Service_Manual.md');
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);

  // CAD to 3D Twin simulation tool state
  const [cadFile, setCadFile] = useState('UR5e_Kinematics_Assembly.step');
  const [cadStage, setCadStage] = useState(0); // 0: Idle, 1: Tessellating, 2: Kinematic Rigging, 3: Colliders, 4: Done
  const [cadTwinReady, setCadTwinReady] = useState(false);

  // Past Records & Telemetry Data Ingestion state
  const [dataIngested, setDataIngested] = useState(true);
  const [selectedFormat, setSelectedFormat] = useState('CSV (Timeseries)');

  // ProtoTwin connection state
  const [protoTwinConnected, setProtoTwinConnected] = useState(true);

  // Camera-Based Sensing Suite state
  const [activeCameraModal, setActiveCameraModal] = useState(null); // 'vision' | 'magnification' | 'thermal'
  const [cameraStates, setCameraStates] = useState({
    visionTwin: false,
    magnification: false,
    thermalCamera: false,
  });

  // Submission pipeline
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Option 1: LLM Auto-Identify from Documents
  const handleExtractFromDoc = async () => {
    setIsExtractingDoc(true);
    try {
      const res = await fetch('http://localhost:8000/api/extract-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: formData.manual_text }),
      });
      const data = await res.json();
      setFormData((prev) => ({
        ...prev,
        machine_id: data.machine_id || prev.machine_id,
        name: data.name || prev.name,
        payload_kg: String(data.payload_kg || prev.payload_kg),
        reach_mm: String(data.reach_mm || prev.reach_mm),
        location: data.location || prev.location,
      }));
      toast.success('LLM Auto-Extraction Complete!', {
        description: `Parsed kinematics, nominal envelope, and 6-axis torque ratings with ${Math.round(data.confidence * 100)}% confidence.`,
      });
    } catch (err) {
      toast.error('Failed to extract: ' + err.message);
    } finally {
      setIsExtractingDoc(false);
    }
  };

  // Option 3: Web Scraping by Model Name
  const handleScrapeModel = async () => {
    if (!scrapeQuery.trim()) return;
    setIsScraping(true);
    try {
      const res = await fetch('http://localhost:8000/api/scrape-specs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: scrapeQuery }),
      });
      const data = await res.json();
      setScrapedInfo(data);
      setFormData((prev) => ({
        ...prev,
        machine_id: data.machine_id,
        name: data.name,
        type: data.type,
        payload_kg: String(data.payload_kg),
        reach_mm: String(data.reach_mm),
        manual_text: data.manual_text,
      }));
      toast.success(`Scraped Specifications for ${data.name}!`, {
        description: `Retrieved OEM kinematic limits and service guidelines from ${data.specs.manufacturer}.`,
      });
    } catch (err) {
      toast.error('Web Scraping failed: ' + err.message);
    } finally {
      setIsScraping(false);
    }
  };

  // CAD to 3D Digital Twin Simulation pipeline
  const handleConvertCAD = async () => {
    setCadStage(1);
    await new Promise((r) => setTimeout(r, 600));
    setCadStage(2);
    await new Promise((r) => setTimeout(r, 600));
    setCadStage(3);
    await new Promise((r) => setTimeout(r, 600));
    setCadStage(4);
    setCadTwinReady(true);
    toast.success('CAD Compilation Successful!', {
      description: 'STEP B-Rep tessellated into GLTF 2.0 dual-quaternion mesh with ProtoTwin colliders.',
    });
  };

  // Toggle Camera Sensing tools
  const toggleCameraTool = (toolKey) => {
    setCameraStates((prev) => {
      const next = !prev[toolKey];
      toast.info(`${toolKey === 'visionTwin' ? 'Vision Digital Twin' : toolKey === 'magnification' ? 'Micro-Vibration Magnification' : 'FLIR Thermal Camera'} ${next ? 'Activated' : 'Standby'}`);
      return { ...prev, [toolKey]: next };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.machine_id.trim() || !formData.name.trim()) {
      toast.error('Please specify both Machine ID and Machine Name.');
      return;
    }

    try {
      setIsSubmitting(true);
      setPipelineStep(1); // Stage 1: Parsing Kinematics & CAD Rig

      await new Promise((r) => setTimeout(r, 600));
      setPipelineStep(2); // Stage 2: Binding ProtoTwin Physics Signals

      await new Promise((r) => setTimeout(r, 600));
      setPipelineStep(3); // Stage 3: Vector Memory Indexing

      // Call API
      await onboardMachine({
        machine_id: formData.machine_id,
        name: formData.name,
        type: formData.type,
        location: formData.location,
        manual_text: formData.manual_text,
        payload_kg: parseFloat(formData.payload_kg) || 5.0,
        reach_mm: parseFloat(formData.reach_mm) || 850.0,
      });

      await new Promise((r) => setTimeout(r, 600));
      setPipelineStep(4); // Stage 4: Done

      toast.success(`Asset ${formData.name} Registered!`, {
        description: 'Kinematics parsed, vector memory indexed, and live telemetry initialized.',
      });

      // Navigate to the newly created machine's digital twin page
      setTimeout(() => {
        navigate(`/machine/${formData.machine_id}`);
      }, 1200);
    } catch (err) {
      toast.error(`Onboarding failed: ${err.message}`);
      setPipelineStep(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectInbuiltModel = (model) => {
    setSelectedInbuiltModel(model.id);
    setFormData({
      machine_id: model.id,
      name: model.name,
      type: model.type,
      location: model.location,
      payload_kg: model.payload_kg,
      reach_mm: model.reach_mm,
      manual_text: model.manual_text,
    });
    setScrapeQuery(model.modelName);
    setCadFile(model.cadFile);
    setCadStage(4);
    setCadTwinReady(true);
    toast.success(`Loaded Preset: ${model.name}`, {
      description: `${model.scenarioTitle} configured.`,
    });
  };

  const handleSwitchToDemoAccount = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'plantops.demo@industrial.com',
          password: 'Tenure2026!',
        }),
      });
      if (!res.ok) throw new Error('Authentication failed');
      const data = await res.json();
      localStorage.setItem('tenure_user', JSON.stringify(data.user));
      toast.success('Switched to Master Demo Fleet Account', {
        description: 'All 4 machines and scenarios are ready in Operations Hub.',
      });
      navigate('/operations');
    } catch (err) {
      toast.error('Switch Failed: ' + err.message);
    }
  };

  return (
    <div className="onboard-page">
      {/* Page Header */}
      <div className="onboard-header">
        <h1 className="onboard-title">Onboard Industrial Asset</h1>
        <p className="onboard-subtitle">
          Register robotic manipulators via document auto-extraction, manual specification, or OEM web scraping.
          Synthesize 3D digital twins from CAD and connect streaming telemetry.
        </p>
      </div>

      <div className="onboard-grid">
        {/* Left Column: 3 Input Options & Specifications Form */}
        <div className="onboard-left-column">
          {/* Quick Demo Switcher Banner */}
          <div className="demo-account-banner glass-subtle">
            <div className="demo-account-banner__left">
              <Sparkles size={18} className="text-terracotta" />
              <div>
                <div className="demo-account-banner__title">Master Demo Fleet Ready (4 Machines Pre-Configured)</div>
                <div className="demo-account-banner__sub">
                  Want to skip onboarding and inspect all 4 live machines and scenarios? Log into the master demo account with 1 click.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="demo-switch-btn"
              onClick={handleSwitchToDemoAccount}
            >
              <ShieldAlert size={14} />
              <span>Log Into Demo Fleet</span>
            </button>
          </div>

          <div className="onboard-form-card glass-strong">
            {/* Inbuilt Industrial Model Presets */}
            <div className="inbuilt-models-section">
              <div className="inbuilt-section-head">
                <Cpu size={16} className="text-terracotta" />
                <span className="inbuilt-section-title">Inbuilt Industrial Robotic Presets</span>
                <span className="inbuilt-section-hint">Select a model to auto-populate kinematics & load its live scenario</span>
              </div>
              <div className="inbuilt-models-grid">
                {INBUILT_MODELS.map((m) => (
                  <div
                    key={m.id}
                    className={`inbuilt-model-card${selectedInbuiltModel === m.id ? ' inbuilt-model-card--selected' : ''}`}
                    onClick={() => handleSelectInbuiltModel(m)}
                  >
                    <div className="inbuilt-card-header">
                      <span className="inbuilt-card-name">{m.modelName}</span>
                      <span className="inbuilt-card-tag">{m.scenarioBadge}</span>
                    </div>
                    <div className="inbuilt-card-meta">
                      <span>{m.manufacturer}</span> · <span>Payload {m.payload_kg}kg</span> · <span>Reach {m.reach_mm}mm</span>
                    </div>
                    <div className="inbuilt-card-desc">
                      {m.scenarioDesc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3 Options Tabs */}
            <div className="input-options-tabs">
              <button
                type="button"
                className={`tab-btn ${inputMode === 'docs' ? 'tab-btn--active' : ''}`}
                onClick={() => setInputMode('docs')}
              >
                <FileText size={15} />
                <span>1. Drop Documents (LLM Auto-ID)</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${inputMode === 'manual' ? 'tab-btn--active' : ''}`}
                onClick={() => setInputMode('manual')}
              >
                <Sliders size={15} />
                <span>2. Manual Entry</span>
              </button>
              <button
                type="button"
                className={`tab-btn ${inputMode === 'scrape' ? 'tab-btn--active' : ''}`}
                onClick={() => setInputMode('scrape')}
              >
                <Globe size={15} />
                <span>3. Web Scraping by Model</span>
              </button>
            </div>

            {/* Mode 1: Document Drop / LLM Auto-Identify */}
            {inputMode === 'docs' && (
              <div className="mode-panel glass-subtle">
                <div className="panel-title">
                  <Bot size={16} className="text-terracotta" />
                  <span>LLM Automated Document Parsing</span>
                </div>
                <p className="panel-description">
                  Upload an OEM technical service manual or specification sheet. Gemini Flash analyzes the unformatted text to auto-identify model name, payload, reach, and torque safety limits.
                </p>

                <div className="dropzone-box">
                  <UploadCloud size={28} className="text-terracotta" />
                  <span className="dropzone-filename">{uploadedDocName}</span>
                  <span className="dropzone-hint">Compatible with PDF, Markdown, Word, TXT, JSON</span>
                </div>

                <button
                  type="button"
                  className="btn-action-primary"
                  onClick={handleExtractFromDoc}
                  disabled={isExtractingDoc}
                >
                  {isExtractingDoc ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Extracting Kinematic Parameters...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      <span>Auto-Identify Details with LLM</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Mode 3: Web Scraping by Model Name */}
            {inputMode === 'scrape' && (
              <div className="mode-panel glass-subtle">
                <div className="panel-title">
                  <Globe size={16} className="text-terracotta" />
                  <span>Manufacturer OEM Web Scraping</span>
                </div>
                <p className="panel-description">
                  Enter any industrial robotic model name. Our web scraper queries OEM technical repositories to fetch rated payloads, reaches, and gear lubrication specifications.
                </p>

                <div className="scrape-input-row">
                  <input
                    type="text"
                    className="onboard-input"
                    value={scrapeQuery}
                    onChange={(e) => setScrapeQuery(e.target.value)}
                    placeholder="e.g. Universal Robots UR5e, KUKA KR10, FANUC CRX-10iA"
                  />
                  <button
                    type="button"
                    className="btn-action-primary"
                    onClick={handleScrapeModel}
                    disabled={isScraping}
                  >
                    {isScraping ? <RefreshCw size={15} className="animate-spin" /> : <Globe size={15} />}
                    <span>{isScraping ? 'Scraping...' : 'Scrape Specs'}</span>
                  </button>
                </div>

                {scrapedInfo && (
                  <div className="scraped-pill-badge">
                    <CheckCircle2 size={14} className="text-emerald" />
                    <span>Scraped: {scrapedInfo.specs.manufacturer} • {scrapedInfo.specs.model_name} (Payload {scrapedInfo.specs.payload_kg}kg)</span>
                  </div>
                )}
              </div>
            )}

            {/* Asset Details Form */}
            <form onSubmit={handleSubmit} className="onboard-actual-form">
              <h3 className="form-subheading">
                <Cpu size={16} className="text-terracotta" />
                <span>Asset Kinematics & Machine Metadata</span>
              </h3>

              <div className="form-row">
                <div className="onboard-field">
                  <label className="onboard-label" htmlFor="machine_id">
                    <span>Machine Unique ID</span>
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
                    <span>Physical Location</span>
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
                <label className="onboard-label" htmlFor="manual_text">
                  <span>Service Manual & Knowledge Base (Stored in Chroma RAG)</span>
                </label>
                <textarea
                  id="manual_text"
                  name="manual_text"
                  className="onboard-textarea"
                  rows={4}
                  value={formData.manual_text}
                  onChange={handleChange}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="onboard-submit-btn glass-sheen"
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Registering & Calibrating Digital Twin...' : 'Register Asset & Connect Telemetry'}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: CAD-to-Twin Tool, Industry Sensor Data Ingestion & Camera Suite */}
        <div className="onboard-right-column">
          {/* CAD to 3D Digital Twin Compiler Tool */}
          <div className="tool-card glass-strong">
            <div className="tool-header">
              <Box size={18} className="text-terracotta" />
              <h3 className="tool-title">CAD to 3D Digital Twin Synthesizer</h3>
            </div>
            <p className="tool-description">
              Upload raw CAD geometry (.STEP, .IGES, .SLDPRT). Compiles B-Rep surfaces into interactive WebGL dual-quaternion skinned rigs linked to ProtoTwin physics.
            </p>

            <div className="cad-upload-area">
              <div className="cad-file-badge">
                <Layers size={16} />
                <span>{cadFile}</span>
                <span className="cad-ext-tag">STEP B-Rep</span>
              </div>

              {cadStage === 0 && (
                <button
                  type="button"
                  className="btn-cad-convert glass-subtle"
                  onClick={handleConvertCAD}
                >
                  <Box size={15} />
                  <span>Synthesize 3D Digital Twin</span>
                </button>
              )}

              {cadStage > 0 && cadStage < 4 && (
                <div className="cad-progress-box">
                  <div className="cad-step-text">
                    <RefreshCw size={13} className="animate-spin" />
                    <span>
                      {cadStage === 1 && 'Tessellating boundary surfaces (28,450 triangles)...'}
                      {cadStage === 2 && 'Inferring 6-DOF kinematic rotation joints...'}
                      {cadStage === 3 && 'Binding ProtoTwin physics colliders & TCP anchor...'}
                    </span>
                  </div>
                  <div className="progress-bar-bg">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(cadStage / 3) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {cadTwinReady && (
                <div className="cad-ready-badge">
                  <CheckCircle2 size={16} className="text-emerald" />
                  <span>3D Digital Twin Compiled • 6 Joints Rigged</span>
                </div>
              )}
            </div>
          </div>

          {/* Past Records & Sensor Data Ingestion (Universal Formats) */}
          <div className="tool-card glass-strong">
            <div className="tool-header">
              <Database size={18} className="text-terracotta" />
              <h3 className="tool-title">Sensor & Past Records Memory Store</h3>
            </div>
            <p className="tool-description">
              Ingests historical maintenance logs, telemetry batches, and failure audits into isolated ChromaDB vector memory. Compatible with all industry formats:
            </p>

            <div className="industry-formats-chips">
              {['CSV (Timeseries)', 'JSON (Telemetry)', 'MQTT Schema', 'OPC-UA XML', 'Apache Parquet'].map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  className={`format-chip ${selectedFormat === fmt ? 'format-chip--active' : ''}`}
                  onClick={() => setSelectedFormat(fmt)}
                >
                  {fmt}
                </button>
              ))}
            </div>

            <div className="data-ingested-status glass-subtle">
              <Database size={14} className="text-emerald" />
              <span>1,420 Historical Readings & Service Manual Chunks Ready for RAG Retrieval</span>
            </div>
          </div>

          {/* ProtoTwin Headless Simulator Connection */}
          <div className="tool-card glass-strong">
            <div className="tool-header">
              <Radio size={18} className="text-terracotta" />
              <h3 className="tool-title">Physics Simulation Engine</h3>
            </div>
            <p className="tool-description">
              Streams real-time joint positions, velocities, and motor torques from the ProtoTwin physics simulator (Port 8084).
            </p>

            <div className="prototwin-btn-row">
              <button
                type="button"
                className={`btn-prototwin ${protoTwinConnected ? 'btn-prototwin--connected' : ''}`}
                onClick={() => {
                  setProtoTwinConnected(!protoTwinConnected);
                  toast.info(protoTwinConnected ? 'ProtoTwin Disconnected' : 'Connected to ProtoTwin Headless Simulator');
                }}
              >
                <Radio size={15} className={protoTwinConnected ? 'animate-pulse' : ''} />
                <span>{protoTwinConnected ? 'ProtoTwin Headless Connected' : 'Connect ProtoTwin Headless'}</span>
              </button>
            </div>
          </div>

          {/* Alternative Camera-Based Sensing Suite */}
          <div className="tool-card glass-strong">
            <div className="tool-header">
              <Camera size={18} className="text-terracotta" />
              <h3 className="tool-title">Camera-Based Optical Sensing Suite</h3>
            </div>
            <p className="tool-description">
              In cases where physical encoders are inaccessible, reconstruct the digital twin and monitor wear using computer vision cameras:
            </p>

            <div className="camera-showcase-buttons">
              <button
                type="button"
                className={`cam-btn ${cameraStates.visionTwin ? 'cam-btn--active' : ''}`}
                onClick={() => {
                  toggleCameraTool('visionTwin');
                  setActiveCameraModal('vision');
                }}
              >
                <Eye size={15} />
                <span>Vision Digital Twin (Pose Estimation)</span>
              </button>

              <button
                type="button"
                className={`cam-btn ${cameraStates.magnification ? 'cam-btn--active' : ''}`}
                onClick={() => {
                  toggleCameraTool('magnification');
                  setActiveCameraModal('magnification');
                }}
              >
                <Activity size={15} />
                <span>Eulerian Video Magnification (Micro-Vibrations)</span>
              </button>

              <button
                type="button"
                className={`cam-btn ${cameraStates.thermalCamera ? 'cam-btn--active' : ''}`}
                onClick={() => {
                  toggleCameraTool('thermalCamera');
                  setActiveCameraModal('thermal');
                }}
              >
                <Thermometer size={15} />
                <span>FLIR Infrared Thermal Mapping</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Technology Explanation Modal */}
      <AnimatePresence>
        {activeCameraModal && (
          <div className="camera-modal-backdrop" onClick={() => setActiveCameraModal(null)}>
            <motion.div
              className="camera-modal-card glass-strong"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                {activeCameraModal === 'vision' && <Eye size={22} className="text-terracotta" />}
                {activeCameraModal === 'magnification' && <Activity size={22} className="text-terracotta" />}
                {activeCameraModal === 'thermal' && <Thermometer size={22} className="text-terracotta" />}
                <h3 className="modal-title">
                  {activeCameraModal === 'vision' && 'Camera Object Detection & 6-DOF Pose Estimation'}
                  {activeCameraModal === 'magnification' && 'Eulerian Video Magnification for Micro-Vibrations'}
                  {activeCameraModal === 'thermal' && 'FLIR Thermal Camera Thermographic Inspection'}
                </h3>
              </div>

              <div className="modal-content">
                {activeCameraModal === 'vision' && (
                  <div>
                    <p>
                      When hardware sensor encoders or fieldbus wiring cannot be tapped, Tenure deploys monocular RGB cameras to track the robot's links using YOLO / Keypoint Estimation.
                    </p>
                    <ul className="modal-list">
                      <li>Calculates Joint 1-6 angles via Perspective-n-Point (PnP) geometry.</li>
                      <li>Recreates the 3D Digital Twin at 30 FPS without opening the control cabinet.</li>
                      <li>Zero physical intrusion or machine downtime during deployment.</li>
                    </ul>
                  </div>
                )}

                {activeCameraModal === 'magnification' && (
                  <div>
                    <p>
                      Eulerian Video Magnification amplifies invisible sub-pixel motions at harmonic gear frequencies (10–80 Hz) to detect mechanical wear before catastrophic failure.
                    </p>
                    <ul className="modal-list">
                      <li>Reveals gear tooth spalling, bearing looseness, and harmonic reducer backlash.</li>
                      <li>Detects micro-vibrations as small as 0.05 mm invisible to the human eye.</li>
                      <li>Feeds real-time frequency spectra directly into the zero-shot anomaly detector.</li>
                    </ul>
                  </div>
                )}

                {activeCameraModal === 'thermal' && (
                  <div>
                    <p>
                      Infrared thermographic cameras continuously map surface temperatures across motor housings and harmonic drive bearings.
                    </p>
                    <ul className="modal-list">
                      <li>Detects friction heat build-up caused by degraded grease (Klüberplex BEM 34-132).</li>
                      <li>Identifies motor winding overheating (&gt;55°C) before insulation breakdown.</li>
                      <li>Correlates thermal signatures with torque spikes for definitive root-cause diagnosis.</li>
                    </ul>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveCameraModal(null)}
              >
                Close Showcase
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
