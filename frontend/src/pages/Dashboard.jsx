import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, ArrowUpRight, Sparkles } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import HealthScore from '../components/HealthScore/HealthScore';
import RobotTwin from '../components/RobotTwin/RobotTwin';
import Chatbot from '../components/Chatbot/Chatbot';
import DynamicChart from '../components/Charts/DynamicChart';
import Skeleton from '../components/common/Skeleton';
import ErrorState from '../components/common/ErrorState';
import StatusDot from '../components/common/StatusDot';
import useChat from '../hooks/useChat';
import useSensors from '../hooks/useSensors';
import { getMachines, getDashboardSummary } from '../api/client';
import { relativeTime, healthToStatus } from '../utils/format';
import { staggerContainerVariants, itemFadeUpVariants } from '../utils/motion';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pinnedCharts, setPinnedCharts] = useState([]);

  // Initialize sensors hook to drive the 3D twin telemetry
  useSensors('ur5e-001');

  const { messages, isLoading: chatLoading, send: sendMessage } = useChat(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [machineData, summaryData] = await Promise.all([
        getMachines(),
        getDashboardSummary(),
      ]);
      setMachines(machineData.machines);
      setSummary(summaryData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Load pinned charts from localStorage on mount (pin means forever, unpin means stays until reload)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tenure_pinned_charts');
      if (stored) {
        setPinnedCharts(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Could not read pinned charts from localStorage:', e);
    }
  }, []);

  const handleSend = async (text) => {
    await sendMessage(text);
  };

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.chart_data) {
      setPinnedCharts((prev) => {
        if (prev.some((c) => c.title === lastMsg.chart_data.title)) return prev;
        return [...prev, { ...lastMsg.chart_data, pin_to_dashboard: false }];
      });
    }
  }, [messages]);

  const handleTogglePin = async (chartData, pinned) => {
    if (pinned) {
      // Pin means forever: persist to localStorage & backend
      const updated = pinnedCharts.map((c) =>
        c.title === chartData.title ? { ...c, pin_to_dashboard: true } : c
      );
      setPinnedCharts(updated);
      try {
        const toSave = updated.filter((c) => c.pin_to_dashboard);
        localStorage.setItem('tenure_pinned_charts', JSON.stringify(toSave));
        await fetch('http://localhost:8000/api/charts/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: chartData.title,
            chart_type: chartData.chart_type,
            chart_data: chartData,
          }),
        });
      } catch (err) {
        console.warn('Backend pin note:', err);
      }
    } else {
      // Unpin means temporary: remove from persistent storage, but keep in memory until reload
      try {
        const stored = localStorage.getItem('tenure_pinned_charts');
        if (stored) {
          const parsed = JSON.parse(stored).filter((c) => c.title !== chartData.title);
          localStorage.setItem('tenure_pinned_charts', JSON.stringify(parsed));
        }
      } catch (err) {
        console.warn('Unpin note:', err);
      }
      setPinnedCharts((prev) =>
        prev.map((c) => (c.title === chartData.title ? { ...c, pin_to_dashboard: false } : c))
      );
    }
  };

  if (error) {
    return <ErrorState title="Couldn't load dashboard" message={error} onRetry={fetchData} />;
  }

  const heroText = summary?.active_alerts
    ? `${summary.active_alerts} machine${summary.active_alerts > 1 ? 's' : ''} need${summary.active_alerts === 1 ? 's' : ''} attention.`
    : 'Everything looks healthy across your industrial fleet.';

  const defaultFleetChart = {
    chart_type: 'area',
    title: 'Fleet Average Torque Load — 24h Baseline',
    x_label: 'Hour',
    y_label: 'Torque (Nm)',
    series: [
      {
        name: 'Rated Safe Baseline',
        data: Array.from({ length: 12 }, (_, i) => ({
          x: `${i * 2}:00`,
          y: 42 + Math.sin(i * 0.5) * 4,
        })),
      },
    ],
    pin_to_dashboard: false,
  };

  const suggestionChips = [
    'Compare UR5e torque vs nominal factory baseline',
    'Compare Joint 3 elbow torque over time',
    'Show me elbow torque over the last hour',
    'Check calibration and TCP drift',
    'Explain recommended maintenance for UR5e',
  ];

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="dashboard"
    >
      {/* Hero */}
      <motion.div variants={itemFadeUpVariants} className="dashboard-hero glass glass-sheen">
        {loading ? (
          <Skeleton variant="heading" width="60%" />
        ) : (
          <>
            <div className="dashboard-hero__text">{heroText}</div>
            <div className="dashboard-hero__sub">
              {summary?.issues_last_24h || 0} issues in the last 24 hours · {summary?.issues_resolved_last_24h || 0} resolved
            </div>
          </>
        )}
        <svg className="dashboard-hero__watermark" viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
          <circle cx="48" cy="48" r="18" />
          <circle cx="48" cy="48" r="6" fill="currentColor" opacity="0.2" />
          <path d="M48 12v10M48 74v10M12 48h10M74 48h10M20 20l7 7M69 69l7 7M20 76l7-7M69 27l7-7" />
        </svg>
      </motion.div>

      {/* Fleet stats with NumberFlow */}
      <motion.div variants={itemFadeUpVariants} className="fleet-stats">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="fleet-stat glass">
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="value" />
            </div>
          ))
        ) : (
          <>
            <div className="fleet-stat glass glass-sheen">
              <span className="fleet-stat__label">Machines Online</span>
              <span className="fleet-stat__value font-mono">
                <NumberFlow value={summary?.machines_online || 1} /> / <NumberFlow value={summary?.total_machines || 1} />
              </span>
            </div>
            <div className="fleet-stat glass glass-sheen">
              <span className="fleet-stat__label">Active alerts</span>
              <span className={`fleet-stat__value font-mono ${summary?.active_alerts > 0 ? 'fleet-stat__value--critical' : 'fleet-stat__value--ok'}`}>
                <NumberFlow value={summary?.active_alerts || 0} />
              </span>
            </div>
            <div className="fleet-stat glass glass-sheen">
              <span className="fleet-stat__label">Fleet Health</span>
              <span className="fleet-stat__value font-mono">
                <NumberFlow
                  value={summary?.avg_health_score || 94.2}
                  format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }}
                />%
              </span>
            </div>
            <div className="fleet-stat glass glass-sheen">
              <span className="fleet-stat__label">Issues today</span>
              <span className="fleet-stat__value font-mono">
                <NumberFlow value={summary?.issues_last_24h || 0} />
              </span>
            </div>
          </>
        )}
      </motion.div>

      {/* Bento Grid */}
      <div className="dashboard-bento-grid">
        {/* Machine Card with Compact Live 3D Twin */}
        <motion.div variants={itemFadeUpVariants} className="bento-card bento-machine-twin-card glass glass-sheen">
          <div className="bento-card-header">
            <div>
              <span className="bento-card-category">Active Digital Twin</span>
              <h3 className="bento-card-title">UR5e Demo Unit</h3>
            </div>
            <button
              type="button"
              className="bento-action-btn glass-subtle"
              onClick={() => navigate('/machine/ur5e-001')}
            >
              <span>Inspect Telemetry</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="bento-twin-container">
            <RobotTwin compact />
          </div>

          <div className="bento-machine-meta">
            {machines.map((m) => {
              const scenarioTag = 
                m.machine_id.includes('ur5e') ? 'Scenario 1: xAI Recurrence' :
                m.machine_id.includes('kuka') ? 'Scenario 2: Tech Availability Fallback' :
                m.machine_id.includes('fanuc') ? 'Scenario 3: Multi-Vendor Procurement' :
                m.machine_id.includes('abb') ? 'Scenario 4: Live Telemetry & Yield' : 'Autonomous Fleet Unit';

              const modelSub = 
                m.machine_id.includes('ur5e') ? 'Universal Robots 6-DOF Cobot · Cell A' :
                m.machine_id.includes('kuka') ? 'KUKA KR 10 Articulated Robot · Bay 2' :
                m.machine_id.includes('fanuc') ? 'FANUC CRX-10iA Cobot · Line 1' :
                m.machine_id.includes('abb') ? 'ABB IRB 1200 Precision Arm · Cell C' : m.name;

              return (
                <div
                  key={m.machine_id}
                  className="bento-meta-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate('/operations')}
                >
                  <div className="bento-meta-left">
                    <HealthScore score={m.health_score || 94} size="sm" showLabel={false} />
                    <div>
                      <div className="bento-meta-status">
                        <StatusDot status={healthToStatus(m.health_score || 94)} />
                        <strong>{m.name || m.machine_id}</strong>
                        <span className="bento-scenario-pill">{scenarioTag}</span>
                      </div>
                      <div className="bento-meta-sub">{modelSub}</div>
                    </div>
                  </div>
                  <div className="bento-meta-right font-mono">
                    <Clock size={13} />
                    <span>{m.status === 'online' ? 'Nominal Telemetry' : relativeTime(m.last_anomaly_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Fleet Overview Chart */}
        <motion.div variants={itemFadeUpVariants} className="bento-card bento-chart-card">
          <div className="bento-card-header">
            <div>
              <span className="bento-card-category">Telemetry Overview</span>
              <h3 className="bento-card-title">24-Hour Fleet Performance</h3>
            </div>
          </div>
          <DynamicChart chartData={defaultFleetChart} />
        </motion.div>

        {/* AI Suggestions & Pinned Charts */}
        <motion.div variants={itemFadeUpVariants} className="bento-card bento-pinned-card glass glass-sheen">
          <div className="bento-card-header">
            <div>
              <span className="bento-card-category">AI Queries</span>
              <h3 className="bento-card-title">Suggested Inquiries</h3>
            </div>
            <Sparkles size={16} className="text-terracotta" />
          </div>

          <div className="dashboard-chips-list">
            {suggestionChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                className="dashboard-query-chip glass-subtle"
                onClick={() => handleSend(chip)}
              >
                <span>{chip}</span>
                <ArrowUpRight size={12} />
              </button>
            ))}
          </div>

          {pinnedCharts.length > 0 && (
            <div className="bento-pinned-section">
              <div className="bento-card-category" style={{ marginTop: '16px', marginBottom: '8px' }}>Pinned Charts</div>
              {pinnedCharts.map((chart, i) => (
                <DynamicChart key={i} chartData={chart} onTogglePin={handleTogglePin} />
              ))}
            </div>
          )}
        </motion.div>

        {/* Fleet Chatbot */}
        <motion.div variants={itemFadeUpVariants} className="bento-card bento-chat-card">
          <Chatbot
            messages={messages}
            isLoading={chatLoading}
            onSend={handleSend}
            title="Ask Tenure — Fleet AI"
            placeholder="Ask questions about your fleet or maintenance manuals..."
          />
        </motion.div>
      </div>
    </motion.div>
  );
}
