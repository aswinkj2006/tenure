import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  RotateCcw,
  Cpu,
  UserX,
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Ban,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Flame,
  FileSearch,
} from 'lucide-react';
import { toast } from 'sonner';
import './RecurrencePanel.css';

const API = 'http://localhost:8000';

const ATTRIBUTION_META = {
  machine_fault: {
    label: 'Hardware Fault',
    Icon: Cpu,
    color: '#c2410c',
    bg: 'rgba(194, 65, 12, 0.08)',
    border: 'rgba(194, 65, 12, 0.25)',
    ringColor: '#ea580c',
    desc: 'Component wear or internal mechanical failure requires physical replacement',
  },
  technician_skill_gap: {
    label: 'Technician Skill Gap',
    Icon: UserX,
    color: '#b45309',
    bg: 'rgba(180, 83, 9, 0.08)',
    border: 'rgba(180, 83, 9, 0.25)',
    ringColor: '#d97706',
    desc: 'Fault profile exceeds previous assignee certification or domain experience',
  },
  ambiguous: {
    label: 'Inconclusive Analysis',
    Icon: HelpCircle,
    color: '#0369a1',
    bg: 'rgba(3, 105, 161, 0.08)',
    border: 'rgba(3, 105, 161, 0.25)',
    ringColor: '#0284c7',
    desc: 'Insufficient telemetry — parallel investigation across hardware and procedures recommended',
  },
  systemic: {
    label: 'Systemic Operational Issue',
    Icon: Layers,
    color: '#6d28d9',
    bg: 'rgba(109, 40, 217, 0.08)',
    border: 'rgba(109, 40, 217, 0.25)',
    ringColor: '#7c3aed',
    desc: 'Fleet-wide batch anomaly, power fluctuation, or systemic supply-chain variance',
  },
};

const STEP_LABELS = {
  machine_fault: 'Hardware Fault',
  technician_skill_gap: 'Skill Gap',
  systemic: 'Systemic',
  neutral: 'Neutral',
  ambiguous: 'Ambiguous',
};

function ConfidenceRing({ confidence, color }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const filled = circ * confidence;
  const gap = circ - filled;

  return (
    <div className="xai-confidence__ring">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(184, 114, 59, 0.12)" strokeWidth="7" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeDasharray={`${filled} ${gap}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="xai-confidence__val">
        <div className="xai-confidence__pct">{Math.round(confidence * 100)}%</div>
        <div className="xai-confidence__label-text">Confidence</div>
      </div>
    </div>
  );
}

function ReasoningStep({ step, index }) {
  const [expanded, setExpanded] = useState(false);
  const contrib = step.verdict_contribution || 'neutral';

  return (
    <motion.div
      className="xai-step"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <div className={`xai-step__num xai-step__num--${contrib}`}>
        {step.step}
      </div>
      <div className="xai-step__body" onClick={() => setExpanded(e => !e)}>
        <div className="xai-step__head">
          <span className="xai-step__name">{step.label}</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {contrib !== 'neutral' && (
              <span className={`xai-step__verdict-pill pill--${contrib}`}>
                {STEP_LABELS[contrib] || contrib}
              </span>
            )}
            {step.confidence_delta > 0 && (
              <span className="xai-step__delta">
                +{(step.confidence_delta * 100).toFixed(0)}%
              </span>
            )}
            <span className="xai-step__chevron">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </div>
        </div>
        <div className="xai-step__finding">{step.finding}</div>

        <AnimatePresence>
          {expanded && step.evidence && Object.keys(step.evidence).length > 0 && (
            <motion.div
              className="xai-step__evidence"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="xai-step__evidence-title">
                <FileSearch size={12} /> Causal Telemetry Evidence
              </div>
              {Object.entries(step.evidence).map(([k, v]) => (
                <div key={k} className="xai-evidence-row">
                  <span className="xai-evidence-key">{k.replace(/_/g, ' ')}:</span>
                  <span className="xai-evidence-val">{JSON.stringify(v)}</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function RecurrencePanel({ machineId = 'ur5e-001', flaggedSensors = [], anomalyId }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [smartDispatching, setSmartDispatching] = useState(false);

  const runAnalysis = useCallback(async () => {
    if (!flaggedSensors.length) {
      toast.error('Select at least one flagged sensor to analyze');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/api/recurrence/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machineId,
          anomaly_id: anomalyId || `anm-xai-${Date.now()}`,
          flagged_sensors: flaggedSensors,
          severity: 'high',
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
      toast.success(`xAI Attribution: ${data.attribution_label} (${Math.round(data.confidence * 100)}% confidence)`);
    } catch (e) {
      toast.error('Analysis failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [machineId, flaggedSensors, anomalyId]);

  const runSmartDispatch = useCallback(async () => {
    if (!result) return;
    setSmartDispatching(true);
    try {
      const res = await fetch(`${API}/api/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomaly_id: anomalyId || `anm-xai-${Date.now()}`,
          machine_id: machineId,
          flagged_sensors: flaggedSensors,
          notes: `[xAI Smart Re-Dispatch] Attribution: ${result.attribution}. Excluded: ${result.excluded_technicians.join(', ')}. ${result.smart_dispatch_notes}`,
        }),
      });
      const data = await res.json();
      toast.success(`Smart re-dispatch assigned to ${data.technician?.name} (${data.technician?.certification_level})`);
    } catch (e) {
      toast.error('Smart dispatch failed: ' + e.message);
    } finally {
      setSmartDispatching(false);
    }
  }, [result, machineId, flaggedSensors, anomalyId]);

  const meta = result ? (ATTRIBUTION_META[result.attribution] || ATTRIBUTION_META.ambiguous) : null;
  const VerdictIcon = meta?.Icon || Cpu;

  return (
    <div className="xai-container">
      {/* Trigger Banner — shown when sensors are selected */}
      {flaggedSensors.length > 0 && !result && !loading && (
        <motion.div
          className="xai-trigger-banner glass-strong"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="xai-trigger-banner__content">
            <div className="xai-trigger-banner__icon">
              <RotateCcw size={20} />
            </div>
            <div>
              <div className="xai-trigger-banner__title">Recurrence Intelligence Available</div>
              <div className="xai-trigger-banner__sub">
                Evaluate historical repair telemetry, repeat anomaly signatures, and engineer assignments via 8-step explainable causal AI.
              </div>
            </div>
          </div>
          <button className="xai-analyze-btn" onClick={runAnalysis}>
            <Brain size={16} /> Run xAI Attribution
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      <AnimatePresence>
        {loading && (
          <motion.div
            className="xai-panel glass-strong"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
          >
            <div className="xai-panel__header">
              <div className="xai-panel__header-left">
                <div className="xai-panel__logo">
                  <Brain size={20} />
                </div>
                <div>
                  <div className="xai-panel__title">Causal Attribution Engine</div>
                  <div className="xai-panel__subtitle">Executing 8-step causal verification protocol…</div>
                </div>
              </div>
              <div className="xai-loading-indicator">
                <Loader2 size={18} className="spin-icon" />
              </div>
            </div>
            <div className="xai-loading">
              <div className="xai-loading__track">
                <motion.div
                  className="xai-loading__bar"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
              <div className="xai-loading__text">
                Correlating repeat harmonic telemetry, component wear history, and technician qualifications…
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result Display */}
      {result && meta && (
        <motion.div
          className="xai-panel glass-strong"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="xai-panel__header">
            <div className="xai-panel__header-left">
              <div className="xai-panel__logo">
                <Brain size={20} />
              </div>
              <div>
                <div className="xai-panel__title">xAI Causal Attribution Report</div>
                <div className="xai-panel__subtitle">
                  {result.reasoning_chain.length} structured reasoning steps · Target: [{result.fault_signature?.join(', ')}]
                </div>
              </div>
            </div>
            <div className="xai-panel__badge-row">
              <span className="xai-prior-badge">
                <RotateCcw size={12} /> {result.recurrence_count} prior attempt(s)
              </span>
              <button className="xai-reset-btn" onClick={() => setResult(null)}>
                Clear Analysis
              </button>
            </div>
          </div>

          {/* Verdict Card */}
          <div className="xai-verdict" style={{ background: meta.bg }}>
            <div className="xai-verdict__info">
              <div className="xai-verdict__label">Identified Causal Root</div>
              <div className="xai-verdict__value" style={{ color: meta.color }}>
                <VerdictIcon size={24} />
                <span>{meta.label}</span>
              </div>
              <div className="xai-verdict__desc">{meta.desc}</div>
              <div className="xai-verdict__action">
                <strong>Recommended Directive:</strong> {result.recommended_action}
              </div>
            </div>
            <div className="xai-confidence">
              <ConfidenceRing confidence={result.confidence} color={meta.ringColor} />
              <div className="xai-confidence__desc">
                {result.confidence >= 0.80 ? 'High Statistical Certainty' :
                 result.confidence >= 0.60 ? 'Moderate Certainty' : 'Provisional Causal Weight'}
              </div>
            </div>
          </div>

          {/* Telemetry Evidence Strip */}
          <div className="xai-evidence-strip">
            <div className="xai-evidence-cell">
              <div className="xai-evidence-cell__label">Recorded Recurrences</div>
              <div className="xai-evidence-cell__val text-critical">{result.recurrence_count}</div>
              <div className="xai-evidence-cell__sub">Same sensor signature</div>
            </div>
            <div className="xai-evidence-cell">
              <div className="xai-evidence-cell__label">Unique Engineers Failed</div>
              <div className="xai-evidence-cell__val">{result.evidence?.distinct_failed_technicians ?? '—'}</div>
              <div className="xai-evidence-cell__sub">Prior attempted repairs</div>
            </div>
            <div className="xai-evidence-cell">
              <div className="xai-evidence-cell__label">Fleet Co-occurrence</div>
              <div className="xai-evidence-cell__val">{result.evidence?.other_machines_affected ?? 0}</div>
              <div className="xai-evidence-cell__sub">Correlated units</div>
            </div>
            <div className="xai-evidence-cell">
              <div className="xai-evidence-cell__label">Excluded from Next Run</div>
              <div className="xai-evidence-cell__val text-warn">{result.excluded_technicians?.length ?? 0}</div>
              <div className="xai-evidence-cell__sub">Prevent repeat failure</div>
            </div>
          </div>

          {/* Reasoning Chain */}
          <div className="xai-chain">
            <div className="xai-chain__title">
              <span>Auditable Decision Trace</span>
              <span className="xai-chain__hint">
                Select any step to inspect sensor values and threshold logic
              </span>
            </div>
            <div className="xai-steps">
              {result.reasoning_chain.map((step, i) => (
                <ReasoningStep key={step.step} step={step} index={i} />
              ))}
            </div>
          </div>

          {/* Excluded Technicians */}
          {result.excluded_technicians?.length > 0 && (
            <div className="xai-excluded">
              <div className="xai-excluded__title">
                <Ban size={14} /> Engineers Excluded from Immediate Re-Dispatch
              </div>
              <div className="xai-excluded-list">
                {result.excluded_technicians.map(tid => {
                  const techInfo = result.evidence?.failed_technician_profiles?.find(p => p.id === tid);
                  return (
                    <div key={tid} className="xai-excluded-chip">
                      <UserX size={12} />
                      <span className="xai-excluded-name">{techInfo?.name || tid}</span>
                      {techInfo?.cert && <span className="xai-excluded-cert">({techInfo.cert})</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Smart Re-Dispatch Action Bar */}
          <div className="xai-redispatch">
            <div className="xai-redispatch__banner glass">
              <div>
                <div className="xai-redispatch__text">
                  <Sparkles size={16} /> Autonomous Re-Dispatch Recommendation
                </div>
                <div className="xai-redispatch__sub">
                  {result.smart_dispatch_notes}
                </div>
              </div>
              <button
                className="xai-smart-dispatch-btn"
                onClick={runSmartDispatch}
                disabled={smartDispatching}
              >
                {smartDispatching ? (
                  <>
                    <Loader2 size={15} className="spin-icon" /> Assigning…
                  </>
                ) : (
                  <>
                    <Send size={15} /> Execute Smart Dispatch
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
