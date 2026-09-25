import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Users,
  Package,
  Zap,
  BarChart2,
  Send,
  CheckCircle2,
  XCircle,
  ClipboardList,
  RefreshCw,
  AlertCircle,
  ArrowDown,
  Check,
  Building2,
  Mail,
  Phone,
  MessageSquare,
  Clock,
  Star,
  Inbox,
  Bot,
  Sliders,
  ShieldCheck,
  Loader2,
  ShoppingCart,
  UserCheck,
  Calendar,
  RotateCcw,
  Sparkles,
  DollarSign,
  TrendingUp,
  Cpu,
  UserX,
  AlertOctagon,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import RecurrencePanel from '../components/RecurrencePanel/RecurrencePanel';
import './OperationsPage.css';

const API = 'http://localhost:8000';

const DEMO_WORKCELLS = [
  {
    id: 'ur5e-001',
    name: 'Universal Robots UR5e',
    cell: 'Cell A — Precision Assembly',
    scenarioId: 'recurrence',
    scenarioTitle: 'Scenario 1: xAI Recurrence Intelligence',
    badge: 'Hardware Fault vs Skill Gap',
    defaultSensors: ['joint_3_torque'],
    icon: RotateCcw,
    color: '#b8723b',
  },
  {
    id: 'kuka-kr10',
    name: 'KUKA KR 10 Cybertech',
    cell: 'Bay 2 — Heavy Arc Welding',
    scenarioId: 'availability',
    scenarioTitle: 'Scenario 2: Technician Availability Fallback',
    badge: 'Autonomous Skill Cascade',
    defaultSensors: ['joint_2_torque', 'temperature'],
    icon: Users,
    color: '#d97706',
  },
  {
    id: 'fanuc-crx10',
    name: 'FANUC CRX-10iA',
    cell: 'Line 1 — End-of-Line Packaging',
    scenarioId: 'procurement',
    scenarioTitle: 'Scenario 3: Multi-Vendor Procurement & xAI Gate',
    badge: 'Multi-Vendor Cascade & xAI Gate',
    defaultSensors: ['joint_4_torque', 'tcp_vibration'],
    icon: Package,
    color: '#2563eb',
  },
  {
    id: 'abb-irb1200',
    name: 'ABB IRB 1200-5/0.9',
    cell: 'Cell C — Machining & Pick-and-Place',
    scenarioId: 'telemetry',
    scenarioTitle: 'Scenario 4: Live Telemetry & Economic Yield',
    badge: 'Real-time Profit & Risk Model',
    defaultSensors: ['temperature', 'current'],
    icon: DollarSign,
    color: '#16a34a',
  },
];

const FAULT_SENSORS = [
  'joint_3_torque', 'joint_1_torque', 'joint_2_torque',
  'joint_4_torque', 'joint_5_torque', 'joint_6_torque',
  'tcp_force', 'tcp_vibration', 'temperature', 'current', 'pressure',
];

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function AvailabilityBadge({ status }) {
  const labels = {
    available: 'Available',
    busy: 'On Assignment',
    'off-shift': 'Off Shift',
    'on-leave': 'On Leave',
  };
  return (
    <span className={`tech-availability avail--${status}`}>
      <span className="avail-dot" />
      {labels[status] || status}
    </span>
  );
}

function ScoreBar({ score }) {
  return (
    <div className="score-bar-wrap">
      <div className="score-bar">
        <div className="score-bar__fill" style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

function TechCard({ tech, rank, onSelect, isSelected }) {
  const rankClass = rank <= 3 ? ` tech-card--ranked-${rank}` : '';
  return (
    <motion.div
      className={`tech-card${rankClass}${isSelected ? ' tech-card--selected' : ''}`}
      onClick={() => onSelect(tech)}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: rank * 0.03 }}
    >
      <div className="tech-avatar">{getInitials(tech.name)}</div>
      <div className="tech-info">
        <div className="tech-info__name">{tech.name}</div>
        <div className="tech-info__meta">
          {tech.certification_level} · {tech.experience_years}yr exp · {tech.location}
        </div>
        <div className="tech-info__skills">
          {(Array.isArray(tech.specializations)
            ? tech.specializations
            : JSON.parse(tech.specializations || '[]')
          ).slice(0, 3).map(s => (
            <span
              key={s}
              className={`tech-skill-tag${(tech.matched_skills || []).includes(s) ? ' tech-skill-tag--match' : ''}`}
            >
              {s.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
        {tech.rank_score !== undefined && <ScoreBar score={tech.rank_score} />}
      </div>
      <div className="tech-right-col">
        <div className="tech-score">
          {tech.rank_score !== undefined && (
            <>
              <div className="tech-score__val">{tech.rank_score.toFixed(0)}</div>
              <div className="tech-score__label">Fit Index</div>
            </>
          )}
        </div>
        <div style={{ marginTop: 6 }}><AvailabilityBadge status={tech.availability} /></div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Multi-Vendor Cascade & xAI Validation Modal
// ─────────────────────────────────────────
function MultiVendorValidationModal({ order, onClose, onAuthorize }) {
  if (!order) return null;
  const { part, vendor, quantity, cascade_history, xai_validation } = order;
  const steps = xai_validation?.steps || [];

  return (
    <div className="slack-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="slack-modal"
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 16 }}
        transition={{ duration: 0.25 }}
      >
        <div className="slack-modal__topbar">
          <div className="slack-modal__topbar-brand">
            <ShieldCheck size={16} />
            <span className="slack-modal__workspace">Autonomous Procurement — xAI Governance Gate</span>
          </div>
          <span className="slack-modal__channel">PO Review</span>
        </div>

        <div className="slack-modal__body">
          {/* Step-by-Step Reason Chain */}
          <div className="vendor-xai-card">
            <div className="vendor-xai-header">
              <Sparkles size={16} className="text-terracotta" />
              <strong>Autonomous Multi-Vendor Cascade Trace</strong>
            </div>

            <div className="vendor-cascade-strip">
              {cascade_history?.map((c, i) => (
                <div key={i} className={`cascade-chip cascade-chip--${c.status}`}>
                  <span className="cascade-chip-name">{c.vendor_name}</span>
                  <span className="cascade-chip-lead">{c.lead_time_days}d Lead Time</span>
                  <span className="cascade-chip-badge">{c.status.toUpperCase()}</span>
                </div>
              ))}
            </div>

            <div className="xai-procure-steps">
              {steps.map((st, i) => (
                <div key={i} className="xai-procure-step">
                  <div className="xai-procure-step-num">{st.step}</div>
                  <div className="xai-procure-step-body">
                    <div className="xai-procure-step-title">{st.label}</div>
                    <div className="xai-procure-step-detail">{st.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="vendor-po-summary">
              <div className="po-field">
                <span className="po-field-label">Target Part</span>
                <span className="po-field-val">{part?.name} (Qty: {quantity})</span>
              </div>
              <div className="po-field">
                <span className="po-field-label">Selected Supplier</span>
                <span className="po-field-val">{vendor?.name}</span>
              </div>
              <div className="po-field">
                <span className="po-field-label">Total Amount</span>
                <span className="po-field-val text-terracotta font-mono">${(part?.unit_cost_usd * quantity).toLocaleString()} USD</span>
              </div>
            </div>

            <div className="vendor-validation-actions">
              <button
                className="btn-auth-order"
                onClick={() => {
                  toast.success(`Purchase Order Authorized for ${vendor?.name}!`, {
                    description: `Simulated Slack dispatch sent to ${vendor?.slack_channel}. Next-Day Delivery initiated.`,
                  });
                  onAuthorize && onAuthorize();
                  onClose();
                }}
              >
                <CheckCircle2 size={15} /> Authorize Vendor Purchase Order
              </button>
              <button className="btn-cancel-order" onClick={onClose}>
                Hold for Engineering Review
              </button>
            </div>
          </div>
        </div>

        <div className="slack-modal__footer">
          <span className="slack-footer-note">
            <ShieldCheck size={13} /> xAI Governance Layer · Expenditure requires supervisor sign-off
          </span>
          <button className="slack-close-btn" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────
// Dispatch Tab with Availability Fallback
// ─────────────────────────────────────────
function DispatchTab({ machineId = 'ur5e-001', selectedSensors = [], setSelectedSensors, activeWorkcell }) {
  const [technicians, setTechnicians] = useState([]);
  const [ranking, setRanking] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);
  const [loadingRank, setLoadingRank] = useState(false);
  const [history, setHistory] = useState([]);
  const [sarahBusy, setSarahBusy] = useState(true);

  const fetchTechs = useCallback(() => {
    fetch(`${API}/api/technicians`)
      .then(r => r.json())
      .then(d => setTechnicians(d.technicians || []))
      .catch(() => {});

    fetch(`${API}/api/dispatch/history?limit=5`)
      .then(r => r.json())
      .then(d => setHistory(d.assignments || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTechs();
  }, [fetchTechs]);

  const toggleSensor = (s) => {
    setSelectedSensors(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
    setRanking(null);
    setDispatchResult(null);
  };

  const runRanking = useCallback(async () => {
    setLoadingRank(true);
    setRanking(null);
    try {
      const res = await fetch(`${API}/api/technicians/rank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagged_sensors: selectedSensors,
          severity: 'high',
          machine_id: machineId,
        }),
      });
      const data = await res.json();
      setRanking(data);
      if (data.availability_fallback) {
        toast.info('Technician Availability Fallback Engaged', {
          description: data.availability_fallback.xai_explanation,
        });
      }
    } catch {
      toast.error('Could not rank technicians');
    } finally {
      setLoadingRank(false);
    }
  }, [selectedSensors, machineId]);

  const toggleSarahAvailability = async () => {
    const newStatus = sarahBusy ? 'available' : 'busy';
    setSarahBusy(!sarahBusy);
    try {
      // Update Sarah in state
      setTechnicians(prev => prev.map(t => {
        if (t.name.includes('Sarah')) {
          return { ...t, availability: newStatus };
        }
        return t;
      }));
      toast.success(`Sarah Chen status toggled to: ${newStatus.toUpperCase()}`);
      // Re-run ranking
      setTimeout(() => {
        runRanking();
      }, 200);
    } catch (e) {
      toast.error('Could not toggle status');
    }
  };

  const dispatchBest = useCallback(async () => {
    setDispatching(true);
    try {
      const demoAnomalyId = `anm-${machineId}-${Date.now()}`;
      const res = await fetch(`${API}/api/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          anomaly_id: demoAnomalyId,
          machine_id: machineId,
          flagged_sensors: selectedSensors,
          notes: `Autonomous Dispatch for ${activeWorkcell.name} (${activeWorkcell.cell})`,
        }),
      });
      if (!res.ok) throw new Error('Dispatch failed');
      const data = await res.json();
      setDispatchResult(data);
      toast.success(`Dispatched ${data.technician?.name} — ETA ${data.estimated_hours?.toFixed(1)}h`);
      fetchTechs();
    } catch (e) {
      toast.error('Dispatch failed: ' + e.message);
    } finally {
      setDispatching(false);
    }
  }, [selectedSensors, machineId, activeWorkcell, fetchTechs]);

  const displayList = ranking?.ranked_technicians || technicians;
  const fallback = ranking?.availability_fallback;

  const available = technicians.filter(t => t.availability === 'available').length;
  const busy = technicians.filter(t => t.availability === 'busy').length;
  const offShift = technicians.filter(t => t.availability === 'off-shift').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      {/* Availability Fallback Banner (Scenario 2 Focus) */}
      <AnimatePresence>
        {fallback && (
          <motion.div
            className="availability-fallback-card glass-strong"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="fallback-header">
              <Users size={18} className="text-terracotta" />
              <div>
                <div className="fallback-title">Technician Availability Fallback Activated</div>
                <div className="fallback-sub">{fallback.xai_explanation}</div>
              </div>
              <button
                className="btn-toggle-availability"
                onClick={toggleSarahAvailability}
                title="Toggle Sarah between Busy & Available to show dynamic re-ranking"
              >
                <RefreshCw size={13} />
                <span>Simulate Sarah {sarahBusy ? 'Available' : 'Busy'}</span>
              </button>
            </div>

            <div className="fallback-comparison-row">
              <div className="fallback-candidate fallback-candidate--unavailable">
                <span className="candidate-badge badge--amber">Rank #1 (Unavailable)</span>
                <div className="candidate-name">{fallback.top_specialist.name} ({fallback.top_specialist.certification})</div>
                <div className="candidate-stat">Fit Score: <strong>{fallback.top_specialist.rank_score} / 100</strong> · Status: <span className="status-busy">BUSY</span></div>
                <div className="candidate-detail">{fallback.top_specialist.reason}</div>
              </div>

              <div className="fallback-arrow">
                <ArrowRight size={20} />
                <span className="fallback-arrow-label">Autonomous Cascade</span>
              </div>

              <div className="fallback-candidate fallback-candidate--assigned">
                <span className="candidate-badge badge--green">Auto-Dispatched Candidate</span>
                <div className="candidate-name">{fallback.fallback_technician.name} ({fallback.fallback_technician.certification})</div>
                <div className="candidate-stat">Fit Score: <strong>{fallback.fallback_technician.rank_score} / 100</strong> · Status: <span className="status-available">AVAILABLE</span></div>
                <div className="candidate-detail">{fallback.fallback_technician.reason}</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="ops-kpi-strip">
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Field Workforce</span>
            <Users size={16} className="ops-kpi__icon" />
          </div>
          <div className="ops-kpi__value">{technicians.length}</div>
          <div className="ops-kpi__sub">Certified field personnel</div>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Available Immediately</span>
            <UserCheck size={16} className="ops-kpi__icon text-ok" />
          </div>
          <div className="ops-kpi__value text-ok">{available}</div>
          <span className="ops-kpi__badge ops-kpi__badge--green">Ready to Deploy</span>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Currently Assigned</span>
            <Activity size={16} className="ops-kpi__icon text-warn" />
          </div>
          <div className="ops-kpi__value text-warn">{busy}</div>
          <span className="ops-kpi__badge ops-kpi__badge--amber">Active Tickets</span>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Off-Shift / Leave</span>
            <Calendar size={16} className="ops-kpi__icon text-muted" />
          </div>
          <div className="ops-kpi__value text-muted">{offShift + technicians.filter(t => t.availability === 'on-leave').length}</div>
          <span className="ops-kpi__badge ops-kpi__badge--gray">Standby</span>
        </div>
      </div>

      <div className="ops-grid">
        {/* Left: Dispatch Control */}
        <div>
          <div className="fault-input-panel glass">
            <div className="fault-input-panel__title">
              <Zap size={16} /> Fault Profile — Active Sensor Flags ({activeWorkcell.name})
            </div>
            <div className="fault-select-row">
              {FAULT_SENSORS.map(s => (
                <button
                  key={s}
                  className={`fault-chip${selectedSensors.includes(s) ? ' fault-chip--active' : ''}`}
                  onClick={() => toggleSensor(s)}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <div className="fault-actions">
              <button
                className="dispatch-btn dispatch-btn--secondary"
                onClick={runRanking}
                disabled={loadingRank || !selectedSensors.length}
              >
                {loadingRank ? (
                  <>
                    <Loader2 size={14} className="spin-icon" /> Computing Skill Rank…
                  </>
                ) : (
                  <>
                    <BarChart2 size={14} /> Match Technicians
                  </>
                )}
              </button>
              <button
                className="dispatch-btn"
                onClick={dispatchBest}
                disabled={dispatching || !selectedSensors.length}
              >
                {dispatching ? (
                  <>
                    <Loader2 size={14} className="spin-icon" /> Dispatching…
                  </>
                ) : (
                  <>
                    <Send size={14} /> Autonomous Dispatch Best
                  </>
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {dispatchResult && (
              <motion.div
                className="dispatch-result glass"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <div className="dispatch-result__header">
                  <CheckCircle2 size={18} />
                  <span>Dispatch Confirmed — Ticket #{dispatchResult.assignment_id}</span>
                </div>
                <div className="dispatch-result__detail">
                  <strong>{dispatchResult.technician?.name}</strong> ({dispatchResult.technician?.certification_level}) assigned to workcell {machineId}.<br />
                  Algorithm composite match: <strong>{dispatchResult.rank_score?.toFixed(1)} / 100</strong> ·
                  Expected repair time: <strong>{dispatchResult.estimated_hours?.toFixed(1)} hrs</strong>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {history.length > 0 && (
            <div className="ops-panel glass" style={{ marginTop: 20 }}>
              <div className="ops-panel__head">
                <span className="ops-panel__title">
                  <ClipboardList size={16} /> Recent Dispatch Audit Log
                </span>
              </div>
              <div className="ops-panel__body" style={{ maxHeight: 220 }}>
                {history.map(a => (
                  <div key={a.id} className="order-row">
                    <span className="order-row__id">{a.id?.slice(0, 10)}</span>
                    <span className="order-row__part">{a.technician_name}</span>
                    <span className="order-row__vendor">{a.certification_level}</span>
                    <span className={`ops-panel__badge badge--${a.status === 'completed' ? 'green' : a.status === 'dispatched' ? 'amber' : 'gray'}`}>
                      {a.status}
                    </span>
                    <span className="order-row__eta">{a.estimated_hours?.toFixed(1)}h</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Ranked List */}
        <div className="ops-panel glass">
          <div className="ops-panel__head">
            <span className="ops-panel__title">
              <Users size={16} /> Technician Roster
              {ranking && <span className="ops-panel__subtitle">· Ranked by Machine Kinematics</span>}
            </span>
            <span className="ops-panel__badge badge--blue">{displayList.length} Personnel</span>
          </div>
          <div className="ops-panel__body">
            {displayList.length === 0 ? (
              <div className="ops-loading">
                <Loader2 size={20} className="spin-icon" /> Synchronizing roster…
              </div>
            ) : (
              displayList.map((tech, i) => (
                <TechCard
                  key={tech.id}
                  tech={tech}
                  rank={i + 1}
                  onSelect={() => {}}
                  isSelected={false}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* xAI Recurrence Panel — embedded below for UR5e scenario */}
      {machineId === 'ur5e-001' && (
        <RecurrencePanel
          machineId="ur5e-001"
          flaggedSensors={selectedSensors}
          anomalyId={dispatchResult?.assignment_id ? `anm-demo-${Date.now()}` : undefined}
        />
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Inventory Tab with Multi-Vendor Cascade & xAI Gate
// ─────────────────────────────────────────
function InventoryTab({ machineId = 'fanuc-crx10', activeWorkcell }) {
  const [parts, setParts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [procuring, setProcuring] = useState(null);
  const [activeValidationOrder, setActiveValidationOrder] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/inventory?machine_id=${machineId}`).then(r => r.json()),
      fetch(`${API}/api/vendors`).then(r => r.json()),
      fetch(`${API}/api/procurement/orders`).then(r => r.json()),
    ]).then(([inv, vend, ord]) => {
      setParts(inv.parts || []);
      setVendors(vend.vendors || []);
      setOrders(ord.orders || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [machineId]);

  useEffect(() => { load(); }, [load]);

  const initiateProcurement = useCallback(async (partId) => {
    setProcuring(partId);
    try {
      const res = await fetch(`${API}/api/procurement/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ part_id: partId, quantity: 2, requested_by: 'tenure-agent' }),
      });
      const data = await res.json();
      if (data.action === 'use_stock') {
        toast.success(data.message);
      } else if (data.action === 'order_placed') {
        setActiveValidationOrder(data);
        if (data.cascade_history?.length > 0) {
          toast.warning('Multi-Vendor Cascade Executed — Backlog Bypassed', {
            description: `Apex Industrial bypassed (14d backlog). MotionPro Solutions selected (1d delivery). Awaiting validation.`,
          });
        } else {
          toast.success(`Autonomous procurement order prepared for ${data.vendor?.name}`);
        }
        load();
      } else {
        toast.error(data.message || 'No vendor available');
      }
    } catch (e) {
      toast.error('Procurement initiation failed: ' + e.message);
    } finally {
      setProcuring(null);
    }
  }, [load]);

  const oos = parts.filter(p => !p.in_stock).length;
  const low = parts.filter(p => p.low_stock).length;
  const totalValue = parts.reduce((s, p) => s + p.quantity_on_hand * p.unit_cost_usd, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
    >
      <AnimatePresence>
        {activeValidationOrder && (
          <MultiVendorValidationModal
            order={activeValidationOrder}
            onClose={() => setActiveValidationOrder(null)}
            onAuthorize={() => load()}
          />
        )}
      </AnimatePresence>

      <div className="ops-kpi-strip">
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Tracked Components</span>
            <Package size={16} className="ops-kpi__icon" />
          </div>
          <div className="ops-kpi__value">{parts.length}</div>
          <div className="ops-kpi__sub">Active SKUs for {activeWorkcell.name}</div>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Depleted (OOS)</span>
            <AlertCircle size={16} className={`ops-kpi__icon ${oos > 0 ? 'text-critical' : 'text-ok'}`} />
          </div>
          <div className={`ops-kpi__value ${oos > 0 ? 'text-critical' : 'text-ok'}`}>{oos}</div>
          <span className={`ops-kpi__badge ops-kpi__badge--${oos > 0 ? 'red' : 'green'}`}>
            {oos > 0 ? 'Action Triggered' : 'Stock Optimal'}
          </span>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Low Threshold</span>
            <ArrowDown size={16} className={`ops-kpi__icon ${low > 0 ? 'text-warn' : 'text-ok'}`} />
          </div>
          <div className={`ops-kpi__value ${low > 0 ? 'text-warn' : 'text-ok'}`}>{low}</div>
          <span className={`ops-kpi__badge ops-kpi__badge--${low > 0 ? 'amber' : 'green'}`}>
            {low > 0 ? 'Reorder Recommended' : 'Nominal'}
          </span>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Warehouse Valuation</span>
            <Building2 size={16} className="ops-kpi__icon" />
          </div>
          <div className="ops-kpi__value" style={{ fontSize: 24 }}>
            ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="ops-kpi__sub">Active on-hand inventory</div>
        </div>
      </div>

      <div className="ops-grid ops-grid--full">
        {/* Parts Table */}
        <div className="ops-panel glass">
          <div className="ops-panel__head">
            <span className="ops-panel__title">
              <Package size={16} /> Component Inventory — {activeWorkcell.cell}
            </span>
            <button className="ops-refresh-btn" onClick={load}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
          <div className="ops-panel__body" style={{ maxHeight: 340 }}>
            {loading ? (
              <div className="ops-loading">
                <Loader2 size={20} className="spin-icon" /> Synchronizing inventory…
              </div>
            ) : (
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Part #</th>
                    <th>Component Name</th>
                    <th>Subsystem</th>
                    <th>On-Hand</th>
                    <th>Unit Cost</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map(p => (
                    <tr key={p.id}>
                      <td><code className="part-code">{p.part_number}</code></td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className="part-category">{p.category.replace(/_/g, ' ')}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{p.quantity_on_hand}</td>
                      <td>${p.unit_cost_usd?.toLocaleString()}</td>
                      <td>
                        {!p.in_stock ? (
                          <span className="stock-badge stock-badge--oos">
                            <AlertCircle size={12} /> Out of Stock
                          </span>
                        ) : p.low_stock ? (
                          <span className="stock-badge stock-badge--low">
                            <ArrowDown size={12} /> Low Stock
                          </span>
                        ) : (
                          <span className="stock-badge stock-badge--ok">
                            <Check size={12} /> Optimal
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`order-btn${!p.in_stock ? ' order-btn--oos' : ''}`}
                          onClick={() => initiateProcurement(p.id)}
                          disabled={procuring === p.id}
                        >
                          {procuring === p.id ? (
                            <Loader2 size={12} className="spin-icon" />
                          ) : !p.in_stock ? (
                            <>
                              <ShoppingCart size={12} /> Order Now
                            </>
                          ) : (
                            <>
                              <RefreshCw size={11} /> Reorder
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Vendors + Recent Orders */}
        <div className="ops-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          <div className="ops-panel glass">
            <div className="ops-panel__head">
              <span className="ops-panel__title">
                <Building2 size={16} /> Approved Vendor Network
              </span>
              <span className="ops-panel__badge badge--blue">{vendors.length} Integrated Suppliers</span>
            </div>
            <div className="ops-panel__body" style={{ maxHeight: 280 }}>
              {vendors.map(v => (
                <div key={v.id} className="vendor-card">
                  <div className="vendor-card__name">
                    {v.name}
                    {v.lead_time_days >= 7 && (
                      <span className="vendor-backlog-badge">14d Backlogged</span>
                    )}
                  </div>
                  <div className="vendor-card__meta">
                    <span className="vendor-meta-item"><Mail size={12} /> {v.contact_email}</span>
                    <span className="vendor-meta-item"><Phone size={12} /> {v.contact_phone}</span>
                    <span className="vendor-meta-item"><MessageSquare size={12} /> <code className="slack-channel-code">{v.slack_channel}</code></span>
                    <span className="vendor-meta-item"><Clock size={12} /> {v.lead_time_days}d lead time</span>
                    <span className="vendor-rating">
                      {Array.from({ length: Math.round(v.rating) }).map((_, i) => (
                        <Star key={i} size={11} fill="#eab308" color="#eab308" />
                      ))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ops-panel glass">
            <div className="ops-panel__head">
              <span className="ops-panel__title">
                <Inbox size={16} /> Autonomous Procurement Orders
              </span>
              <span className="ops-panel__badge badge--amber">{orders.length} Dispatched</span>
            </div>
            <div className="ops-panel__body" style={{ maxHeight: 280 }}>
              {orders.length === 0 ? (
                <div className="ops-empty">
                  <Inbox size={32} className="ops-empty__icon" />
                  <div>No procurement cycles dispatched yet.</div>
                  <div className="ops-empty__sub">Trigger "Order Now" on depleted components to initiate automated multi-vendor RFQs.</div>
                </div>
              ) : (
                orders.map(o => (
                  <div key={o.id} className="order-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ flex: '0 0 100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--charcoal, #332415)' }}>{o.part_name}</span>
                      <span className={`ops-panel__badge badge--${o.status === 'slack_sent' ? 'amber' : o.status === 'delivered' ? 'green' : 'gray'}`}>
                        {o.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #7a6552)' }}>
                      Supplier: {o.vendor_name} · Channel: {o.vendor_slack} · ETA: {o.estimated_arrival?.slice(0, 10)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Real-Time Economic & Telemetry Analytics (Scenario 4)
// ─────────────────────────────────────────
function EconomicYieldTab() {
  const [runtimeHours, setRuntimeHours] = useState(18.4);
  const profitRatePerHour = 450.0;
  const currentGrossProfit = runtimeHours * profitRatePerHour;
  const projectedDailyProfit = 24 * profitRatePerHour;
  const downtimeSaved = 32400.0;
  const nextMaintenanceHours = 4820;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="economic-tab"
    >
      <div className="ops-kpi-strip">
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Live Production Yield</span>
            <DollarSign size={16} className="ops-kpi__icon text-ok" />
          </div>
          <div className="ops-kpi__value text-ok">${profitRatePerHour.toFixed(2)}/hr</div>
          <div className="ops-kpi__sub">$7.50 net production profit per minute</div>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Gross Profit Today</span>
            <TrendingUp size={16} className="ops-kpi__icon text-ok" />
          </div>
          <div className="ops-kpi__value text-ok">${currentGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div className="ops-kpi__sub">18.4 hours of continuous operational uptime</div>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Downtime Loss Avoided</span>
            <ShieldCheck size={16} className="ops-kpi__icon text-terracotta" />
          </div>
          <div className="ops-kpi__value text-terracotta">${downtimeSaved.toLocaleString()}</div>
          <span className="ops-kpi__badge ops-kpi__badge--green">Zero-Shot Prevention</span>
        </div>
        <div className="ops-kpi glass">
          <div className="ops-kpi__header">
            <span className="ops-kpi__label">Next Service Window</span>
            <Clock size={16} className="ops-kpi__icon text-muted" />
          </div>
          <div className="ops-kpi__value font-mono">{nextMaintenanceHours} hrs</div>
          <div className="ops-kpi__sub">Lubricant: Shell Omala S4 WE 320</div>
        </div>
      </div>

      <div className="ops-grid">
        <div className="ops-panel glass">
          <div className="ops-panel__head">
            <span className="ops-panel__title">
              <Activity size={16} /> ABB IRB 1200 — Continuous Sensor Telemetry Stream
            </span>
            <span className="ops-panel__badge badge--green">100% Nominal Baseline</span>
          </div>
          <div className="ops-panel__body">
            <div className="telemetry-stream-grid">
              <div className="telemetry-cell">
                <span className="telemetry-label">Joint 1 Velocity</span>
                <span className="telemetry-val font-mono">142.4 °/s</span>
                <span className="telemetry-status">Rated Limit: 288 °/s</span>
              </div>
              <div className="telemetry-cell">
                <span className="telemetry-label">Joint 2 Velocity</span>
                <span className="telemetry-val font-mono">118.2 °/s</span>
                <span className="telemetry-status">Rated Limit: 240 °/s</span>
              </div>
              <div className="telemetry-cell">
                <span className="telemetry-label">Joint 3 Torque</span>
                <span className="telemetry-val font-mono">64.5 Nm</span>
                <span className="telemetry-status">Rated Limit: 130 Nm</span>
              </div>
              <div className="telemetry-cell">
                <span className="telemetry-label">Drive Temperature</span>
                <span className="telemetry-val font-mono">38.2 °C</span>
                <span className="telemetry-status">Rated Limit: 65 °C</span>
              </div>
            </div>
          </div>
        </div>

        <div className="ops-panel glass">
          <div className="ops-panel__head">
            <span className="ops-panel__title">
              <DollarSign size={16} /> Economic Yield & Maintenance Horizon Forecast
            </span>
          </div>
          <div className="ops-panel__body">
            <div className="forecast-item">
              <div className="forecast-title">Projected 24-Hour Production Revenue</div>
              <div className="forecast-val">${projectedDailyProfit.toLocaleString()} USD</div>
              <p className="forecast-desc">
                Current operational efficiency is at 99.8%. No anomalous torque deviations or thermal spikes recorded on the 6-axis kinematics.
              </p>
            </div>
            <div className="forecast-item">
              <div className="forecast-title">Expected Maintenance Schedule</div>
              <div className="forecast-val font-mono">4,820 Operating Hours Remaining</div>
              <p className="forecast-desc">
                Autonomous zero-shot anomaly detector estimates zero unplanned downtime risks. Scheduled grease changeover planned for Q4.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Main Operations Command Page
// ─────────────────────────────────────────
export default function OperationsPage() {
  const [selectedMachineId, setSelectedMachineId] = useState('ur5e-001');
  const [activeTab, setActiveTab] = useState('dispatch');
  const [selectedSensors, setSelectedSensors] = useState(['joint_3_torque']);

  const activeWorkcell = DEMO_WORKCELLS.find(w => w.id === selectedMachineId) || DEMO_WORKCELLS[0];

  const handleSelectWorkcell = (workcell) => {
    setSelectedMachineId(workcell.id);
    setSelectedSensors(workcell.defaultSensors);
    if (workcell.scenarioId === 'procurement') {
      setActiveTab('inventory');
    } else if (workcell.scenarioId === 'telemetry') {
      setActiveTab('telemetry');
    } else {
      setActiveTab('dispatch');
    }
    toast.info(`Switched to ${workcell.name}`, {
      description: `${workcell.scenarioTitle} (${workcell.badge}) active.`,
    });
  };

  return (
    <div className="ops-page">
      <div className="ops-header">
        <div>
          <div className="ops-header__eyebrow">Autonomous Industrial Logistics</div>
          <h1 className="ops-header__title">
            <Sliders size={26} /> Operations Command
          </h1>
          <p className="ops-header__sub">
            Algorithmic technician assignment, automated parts procurement, and explainable failure root-cause analysis
          </p>
        </div>
      </div>

      {/* ── Workcell & Scenario Selector Bar ── */}
      <div className="workcell-selector-section glass-subtle">
        <div className="workcell-selector-label">
          <Cpu size={14} className="text-terracotta" />
          <span>Active Industrial Workcell</span>
        </div>
        <div className="workcell-cards-row">
          {DEMO_WORKCELLS.map((w) => {
            const Icon = w.icon;
            const isSelected = selectedMachineId === w.id;
            return (
              <div
                key={w.id}
                className={`workcell-card${isSelected ? ' workcell-card--selected' : ''}`}
                onClick={() => handleSelectWorkcell(w)}
              >
                <div className="workcell-card-top">
                  <Icon size={16} style={{ color: w.color }} />
                  <span className="workcell-card-name">{w.name}</span>
                </div>
                <div className="workcell-card-cell">{w.cell}</div>
                <div className="workcell-card-badge">{w.badge}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Feature Tabs ── */}
      <div className="ops-tabs glass-subtle">
        <button
          className={`ops-tab${activeTab === 'dispatch' ? ' ops-tab--active' : ''}`}
          onClick={() => setActiveTab('dispatch')}
        >
          <Users size={15} /> Field Dispatch Center
        </button>
        <button
          className={`ops-tab${activeTab === 'inventory' ? ' ops-tab--active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <Package size={15} /> Inventory & Procurement
        </button>
        <button
          className={`ops-tab${activeTab === 'telemetry' ? ' ops-tab--active' : ''}`}
          onClick={() => setActiveTab('telemetry')}
        >
          <DollarSign size={15} /> Live Telemetry & Yield
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'dispatch' && (
          <DispatchTab
            key={`dispatch-${selectedMachineId}`}
            machineId={selectedMachineId}
            selectedSensors={selectedSensors}
            setSelectedSensors={setSelectedSensors}
            activeWorkcell={activeWorkcell}
          />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab
            key={`inventory-${selectedMachineId}`}
            machineId={selectedMachineId}
            activeWorkcell={activeWorkcell}
          />
        )}
        {activeTab === 'telemetry' && (
          <EconomicYieldTab key="telemetry" />
        )}
      </AnimatePresence>
    </div>
  );
}
