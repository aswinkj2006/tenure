import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Sparkles,
  ShoppingBag,
  UserCheck,
  Zap,
  ArrowRight,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { itemFadeUpVariants, staggerContainerVariants } from '../utils/motion';
import './ActionCenterPage.css';

const INITIAL_ACTIONS = [
  {
    id: 'act-001',
    type: 'estop',
    machineId: 'ur5e-001',
    machineName: 'Universal Robots UR5e — Cell A',
    title: 'Autonomous Kinetic Emergency Stop Engaged',
    severity: 'critical',
    status: 'pending_approval',
    statusLabel: 'Safety Interlock Engaged',
    timestamp: '2 mins ago',
    summary: 'Joint 3 torque residual surged to 185.4 Nm (envelope limit: 150 Nm, rate dτ/dt = +42 Nm/s). Agent triggered immediate kinetic interlock.',
    xaiSteps: [
      { step: 1, label: 'Kinetic Residual Spike', text: 'Real-time 6-DOF telemetry detected torque jump on Joint 3 flexspline during pick-and-place step #412.' },
      { step: 2, label: 'Zero-Shot Residual Scoring', text: 'Statistical residual scored p < 0.001 against healthy kinetic envelope. Excluded sensor drift.' },
      { step: 3, label: 'Autonomous Interlock Execution', text: 'Hard safety circuit tripped in 14ms. Arm frozen in fault pose to protect $18,500 end-effector tooling.' },
      { step: 4, label: 'Supervisor Oversight Gate', text: 'Machine cannot be restarted automatically. Human reliability supervisor must inspect workcell and authorize resume.' },
    ],
    financialImpact: '₹15,40,000 tooling preserved',
    primaryActionLabel: 'Acknowledge & Resume Machine',
    secondaryActionLabel: 'Lockout / Tagout (Dispatch Tech)',
  },
  {
    id: 'act-002',
    type: 'procurement',
    machineId: 'fanuc-crx10',
    machineName: 'FANUC CRX-10iA — Line 1',
    title: 'Out-of-Stock Multi-Vendor PO Withheld for Authorization',
    severity: 'high',
    status: 'pending_approval',
    statusLabel: 'Withheld by xAI Governance Gate',
    timestamp: '8 mins ago',
    summary: 'Axis 4 AC Servo Motor failure diagnosed. Central warehouse stock is 0 units. Primary vendor backlogged 14 days. Agent cascaded to MotionPro (24h lead time).',
    xaiSteps: [
      { step: 1, label: 'Physical Stator Wear Confirmed', text: 'Torque and thermal telemetry confirmed stator winding insulation breakdown on Joint 4.' },
      { step: 2, label: 'Internal Inventory Query', text: 'Central Warehouse bin query returned 0 units of Part #FANUC-A06B-0115.' },
      { step: 3, label: 'Supply Chain Cascade', text: 'Apex Industrial lead time was 14 days (₹32,00,000 downtime cost). Agent cascaded to MotionPro Solutions (1-day lead time).' },
      { step: 4, label: 'Financial Audit', text: 'Total PO commitment: ₹1,18,000. Net projected downtime avoidance savings: ₹30,80,000.' },
      { step: 5, label: 'Supervisor Release Gate', text: 'Autonomous PO formatted for Slack #procure-motionpro-priority. Withheld until supervisor approves commitment.' },
    ],
    financialImpact: '₹30,80,000 downtime saved · ₹1,18,000 PO commitment',
    primaryActionLabel: 'Authorize Purchase Order (₹1,18,000)',
    secondaryActionLabel: 'Decline & Re-route Order',
  },
  {
    id: 'act-003',
    type: 'dispatch',
    machineId: 'kuka-kr10',
    machineName: 'KUKA KR 10 Cybertech — Bay 2',
    title: 'Technician Availability Fallback: Rerouted to Marcus Vance',
    severity: 'high',
    status: 'pending_approval',
    statusLabel: 'Dispatch Optimization Proposed',
    timestamp: '14 mins ago',
    summary: 'Critical Joint 5 cycloidal drive backlash detected. Top specialist Sarah Chen is BUSY on active UR5e incident. Autonomously cascaded to Marcus Vance.',
    xaiSteps: [
      { step: 1, label: 'Fault Qualification Matrix', text: 'Required skill competencies: robotics, kuka_krc4, thermal_diagnostics.' },
      { step: 2, label: 'Specialist Occupancy Check', text: 'Sarah Chen (L3, 98% success) scored highest (97.8/100) but is BUSY on high-priority incident #anm-active-ur5e.' },
      { step: 3, label: 'Reliability Queue Prohibition', text: 'Under plant policy, queueing emergency stoppage is disallowed (incurs ₹1,00,000/hr idle line cost).' },
      { step: 4, label: 'Cascaded Dispatch Candidate', text: 'Marcus Vance (L2, 91% success, AVAILABLE on floor) selected with 95.5/100 composite ranking.' },
    ],
    financialImpact: 'Prevents 3.2h idle line queue (₹3,20,000 loss)',
    primaryActionLabel: 'Confirm Marcus Vance Dispatch',
    secondaryActionLabel: 'Interrupt Sarah Chen (Override)',
  },
  {
    id: 'act-004',
    type: 'recurrence',
    machineId: 'ur5e-001',
    machineName: 'Universal Robots UR5e — Cell A',
    title: 'xAI Recurrence Attribution: Unresolved Machine Defect (92% Confidence)',
    severity: 'medium',
    status: 'executed',
    statusLabel: 'Attribution Trace Complete',
    timestamp: '28 mins ago',
    summary: '3rd recurring Joint 3 torque anomaly in 45 days. Causal trace rejected technician error hypothesis and attributed fault to flexspline mechanical fatigue.',
    xaiSteps: [
      { step: 1, label: 'Historical Service Audit', text: 'Audited 3 past work orders performed by Technician Dave Miller (Kluberplex grease, bolt torquing).' },
      { step: 2, label: 'Workmanship Verification', text: 'Dave Miller correctly torqued housing bolts to 12.5 Nm per OEM Service Manual Section 4.2.' },
      { step: 3, label: 'Symptom Return Analysis', text: 'Torque hysteresis and thermal drift returned in <14 operating hours despite correct service procedures.' },
      { step: 4, label: 'Root Cause Determination', text: '92% confidence attribution to internal gear flexspline micro-fatigue. Recommended whole harmonic drive assembly replacement.' },
    ],
    financialImpact: 'Eliminates repetitive ₹2,00,000 monthly band-aid repairs',
    primaryActionLabel: 'Approve Whole-Unit Drive Replacement',
    secondaryActionLabel: 'Schedule Secondary Teardown',
  },
  {
    id: 'act-005',
    type: 'throttle',
    machineId: 'abb-irb1200',
    machineName: 'ABB IRB 1200-5/0.9 — Cell C',
    title: 'Autonomous Thermal Safe Mode: 85% Feedrate Throttling Active',
    severity: 'low',
    status: 'executed',
    statusLabel: 'Operating in Protected Mode',
    timestamp: '42 mins ago',
    summary: 'Wrist thermal gradient rose at 1.8°C/hr. Agent throttled traverse velocity to 85%, arresting temperature at 62°C while sustaining ₹1,15,000/hr production yield.',
    xaiSteps: [
      { step: 1, label: 'Thermal Gradient Monitoring', text: 'Continuous temperature sensor reached 62.4°C approaching 65°C shutdown threshold.' },
      { step: 2, label: 'Autonomous Rate Throttling', text: 'Agent lowered Cartesian feedrate by 15%, reducing heat generation rate by 28%.' },
      { step: 3, label: 'Yield Preservation', text: 'Preserves continuous production (₹1,15,000/hr gross) rather than incurring zero-yield thermal lockout.' },
    ],
    financialImpact: '₹1,15,000/hr yield maintained vs ₹0 shutdown',
    primaryActionLabel: 'Maintain 85% Safe Mode',
    secondaryActionLabel: 'Restore 100% Full Speed',
  },
];

export default function ActionCenterPage() {
  const [actions, setActions] = useState(INITIAL_ACTIONS);
  const [filterMachine, setFilterMachine] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState('act-001');

  const handleAction = (id, actionType) => {
    setActions((prev) =>
      prev.map((act) => {
        if (act.id !== id) return act;
        if (actionType === 'primary') {
          if (act.type === 'estop') {
            toast.success('Machine Resumed Safely', {
              description: `Emergency interlock on ${act.machineName} cleared. Kinetic drive restored to nominal velocity.`,
            });
            return { ...act, status: 'cleared', statusLabel: 'Cleared & Resumed by Supervisor' };
          }
          if (act.type === 'procurement') {
            toast.success('Purchase Order Authorized & Dispatched', {
              description: 'PO #PO-94182 approved. Slack priority notification dispatched to #procure-motionpro-priority.',
            });
            return { ...act, status: 'cleared', statusLabel: 'Authorized & Dispatched to Slack' };
          }
          if (act.type === 'dispatch') {
            toast.success('Technician Dispatch Confirmed', {
              description: 'Marcus Vance notified via mobile pager and workcell terminal. Work order #WO-7801 issued.',
            });
            return { ...act, status: 'cleared', statusLabel: 'Dispatched to Marcus Vance' };
          }
          if (act.type === 'recurrence') {
            toast.success('Whole-Unit Replacement Approved', {
              description: 'Component #UR-HD-J3-2026 allocated from central stock. Scheduled for tonight maintenance window.',
            });
            return { ...act, status: 'cleared', statusLabel: 'CMMS Overhaul Work Order Issued' };
          }
          if (act.type === 'throttle') {
            toast.success('Thermal Protection Mode Confirmed', {
              description: 'ABB IRB 1200 operating at 85% feedrate. Thermal stability achieved at 61.8°C.',
            });
            return { ...act, status: 'cleared', statusLabel: 'Thermal Throttle Locked' };
          }
        } else {
          toast.info('Secondary Directive Logged', {
            description: `Supervisor logged secondary instruction for ${act.machineName}. Action updated in plant audit trail.`,
          });
          return { ...act, status: 'cleared', statusLabel: 'Overridden by Supervisor' };
        }
        return act;
      })
    );
  };

  const filtered = actions.filter((act) => {
    if (filterMachine !== 'all' && act.machineId !== filterMachine) return false;
    if (filterStatus === 'pending' && act.status !== 'pending_approval') return false;
    if (filterStatus === 'cleared' && act.status !== 'cleared') return false;
    return true;
  });

  const pendingCount = actions.filter((a) => a.status === 'pending_approval').length;
  const clearedCount = actions.filter((a) => a.status === 'cleared').length;

  return (
    <motion.div
      className="action-center-container"
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemFadeUpVariants} className="action-center-header">
        <div className="action-center-header-left">
          <div className="action-center-badge">
            <Radio size={12} className="live-pulse-dot" />
            <span>Autonomous Operations & Oversight Control Room</span>
          </div>
          <h1 className="action-center-title">Supervisor Action Center</h1>
          <p className="action-center-sub">
            Real-time auditable stream of agentic decisions, safety E-stops, multi-vendor procurement cascades, and xAI recurrence interventions requiring human supervisor authorization.
          </p>
        </div>

        {/* Live Counters */}
        <div className="action-center-kpis">
          <div className="action-kpi-card glass glass-sheen">
            <span className="action-kpi-label">Pending Approval</span>
            <div className="action-kpi-value text-terracotta">{pendingCount}</div>
            <span className="action-kpi-sub">Withheld by xAI Gate</span>
          </div>
          <div className="action-kpi-card glass glass-sheen">
            <span className="action-kpi-label">Active Interventions</span>
            <div className="action-kpi-value text-charcoal">{actions.length}</div>
            <span className="action-kpi-sub">Across 4 Robot Cells</span>
          </div>
          <div className="action-kpi-card glass glass-sheen">
            <span className="action-kpi-label">Mean Confidence</span>
            <div className="action-kpi-value text-sage">93.4%</div>
            <span className="action-kpi-sub">Audited Causal Reasoning</span>
          </div>
        </div>
      </motion.div>

      {/* Filter Toolbar */}
      <motion.div variants={itemFadeUpVariants} className="action-center-toolbar glass glass-sheen">
        <div className="toolbar-group">
          <Filter size={14} className="text-muted" />
          <span className="toolbar-label">Workcell:</span>
          {['all', 'ur5e-001', 'kuka-kr10', 'fanuc-crx10', 'abb-irb1200'].map((m) => (
            <button
              key={m}
              type="button"
              className={`filter-pill ${filterMachine === m ? 'filter-pill--active' : ''}`}
              onClick={() => setFilterMachine(m)}
            >
              {m === 'all' ? 'All Workcells' : m === 'ur5e-001' ? 'UR5e' : m === 'kuka-kr10' ? 'KUKA KR 10' : m === 'fanuc-crx10' ? 'FANUC CRX' : 'ABB IRB'}
            </button>
          ))}
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Status:</span>
          <button
            type="button"
            className={`filter-pill ${filterStatus === 'all' ? 'filter-pill--active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All ({actions.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${filterStatus === 'pending' ? 'filter-pill--active' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            Action Required ({pendingCount})
          </button>
          <button
            type="button"
            className={`filter-pill ${filterStatus === 'cleared' ? 'filter-pill--active' : ''}`}
            onClick={() => setFilterStatus('cleared')}
          >
            Cleared ({clearedCount})
          </button>
        </div>
      </motion.div>

      {/* Action Stream */}
      <div className="action-stream-list">
        <AnimatePresence>
          {filtered.map((act) => {
            const isExpanded = expandedId === act.id;
            const isPending = act.status === 'pending_approval';

            return (
              <motion.div
                key={act.id}
                variants={itemFadeUpVariants}
                layout
                className={`action-card glass glass-sheen ${isPending ? 'action-card--pending' : 'action-card--cleared'}`}
              >
                <div className="action-card-main">
                  {/* Left Column: Icon & Type */}
                  <div className="action-card-type-icon">
                    {act.type === 'estop' && <ShieldAlert size={20} className="text-terracotta" />}
                    {act.type === 'procurement' && <ShoppingBag size={20} className="text-terracotta" />}
                    {act.type === 'dispatch' && <UserCheck size={20} className="text-sage" />}
                    {act.type === 'recurrence' && <FileCheck2 size={20} className="text-charcoal" />}
                    {act.type === 'throttle' && <Zap size={20} className="text-sage" />}
                  </div>

                  {/* Center Column: Details */}
                  <div className="action-card-content">
                    <div className="action-card-top-meta">
                      <span className="action-machine-tag">{act.machineName}</span>
                      <span className={`action-status-pill action-status-pill--${isPending ? 'pending' : 'cleared'}`}>
                        {isPending ? <Clock size={11} /> : <CheckCircle2 size={11} />}
                        <span>{act.statusLabel}</span>
                      </span>
                      <span className="action-time-ago">{act.timestamp}</span>
                    </div>

                    <h3 className="action-item-title">{act.title}</h3>
                    <p className="action-item-summary">{act.summary}</p>

                    <div className="action-card-bottom-meta">
                      <div className="financial-impact-badge">
                        <Sparkles size={12} className="text-terracotta" />
                        <span>{act.financialImpact}</span>
                      </div>

                      <button
                        type="button"
                        className="toggle-xai-btn"
                        onClick={() => setExpandedId(isExpanded ? null : act.id)}
                      >
                        <span>{isExpanded ? 'Hide xAI Causal Evidence' : 'View xAI Causal Evidence (4 Steps)'}</span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Supervisor Actions */}
                  <div className="action-card-controls">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          className="action-btn action-btn--primary"
                          onClick={() => handleAction(act.id, 'primary')}
                        >
                          <Check size={14} />
                          <span>{act.primaryActionLabel}</span>
                        </button>
                        <button
                          type="button"
                          className="action-btn action-btn--secondary"
                          onClick={() => handleAction(act.id, 'secondary')}
                        >
                          <span>{act.secondaryActionLabel}</span>
                        </button>
                      </>
                    ) : (
                      <div className="action-completed-tag">
                        <CheckCircle2 size={15} className="text-sage" />
                        <span>Intervention Resolved</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expandable xAI Causal Audit Drawer */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="xai-evidence-drawer"
                    >
                      <div className="xai-evidence-header">
                        <ShieldAlert size={14} className="text-terracotta" />
                        <strong>Autonomous Agent Causal Chain & Regulatory Audit Trail</strong>
                      </div>
                      <div className="xai-steps-grid">
                        {act.xaiSteps.map((step, idx) => (
                          <div key={idx} className="xai-step-box glass-subtle">
                            <div className="xai-step-num">Step {step.step}</div>
                            <div className="xai-step-label">{step.label}</div>
                            <p className="xai-step-text">{step.text}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
