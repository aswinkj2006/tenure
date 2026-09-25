import { Bell, Wifi, WifiOff, Sparkles, SlidersHorizontal, Presentation } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import useSensorStore from '../../stores/sensorStore';
import './TopBar.css';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function TopBar() {
  const now = new Date();
  const greeting = getGreeting();
  const dateStr = format(now, 'EEEE, MMMM d, yyyy');

  const connected = useSensorStore((s) => s.connected);
  const anomalyActive = useSensorStore((s) => s.anomalyActive);
  const reduceEffects = useSensorStore((s) => s.reduceEffects);
  const toggleReduceEffects = useSensorStore((s) => s.toggleReduceEffects);

  const handleToggleEffects = () => {
    toggleReduceEffects();
    if (!reduceEffects) {
      toast('Switched to Performance Mode', {
        description: 'Backdrop blur & heavy particle layers disabled.',
      });
    } else {
      toast('Atmosphere & Glass Enabled', {
        description: 'Full visual depth, ambient mesh, and motion active.',
      });
    }
  };

  const handleNotificationClick = () => {
    if (anomalyActive) {
      toast.error('Active Alert: Joint 3 (Elbow) Torque Spike at 185.2 Nm', {
        description: 'Automated diagnostic recommendation available on the Machine page.',
      });
    } else {
      toast.success('All Systems Operational', {
        description: '6 joints operating within normal nominal parameters.',
      });
    }
  };

  let userName = 'Technician';
  try {
    const stored = localStorage.getItem('tenure_user');
    if (stored) {
      const u = JSON.parse(stored);
      userName = u.name ? u.name.split(' ')[0] : 'Technician';
    }
  } catch {}

  return (
    <header className="topbar glass-strong">
      <div className="topbar__greeting">
        <span className="topbar__greeting-text">{greeting}, {userName}</span>
        <span className="topbar__greeting-date font-mono">{dateStr}</span>
      </div>

      <div className="topbar__actions">
        {/* Pitch Deck presentation link */}
        <a
          href="/deck.html"
          target="_blank"
          rel="noopener noreferrer"
          className="topbar__pill-btn glass-subtle"
          style={{ textDecoration: 'none', color: 'var(--terracotta)', fontWeight: 600 }}
          title="Open Tenure Interactive Pitch Deck"
        >
          <Presentation size={13} />
          <span>Pitch Deck</span>
        </a>

        {/* Reduce effects toggle */}

        <button
          type="button"
          className={`topbar__pill-btn glass-subtle ${reduceEffects ? 'active' : ''}`}
          onClick={handleToggleEffects}
          title="Toggle performance/effects mode"
        >
          <Sparkles size={13} className={reduceEffects ? 'text-tertiary' : 'text-terracotta'} />
          <span>{reduceEffects ? 'Effects: Reduced' : 'Atmosphere: Rich'}</span>
        </button>

        {!connected && (
          <div className="topbar__reconnecting">
            <WifiOff size={12} strokeWidth={1.5} />
            Telemetry offline
          </div>
        )}

        <button
          className="topbar__icon-btn glass-subtle"
          aria-label="Notifications"
          onClick={handleNotificationClick}
        >
          <Bell size={17} strokeWidth={1.5} />
          {anomalyActive && (
            <span className="topbar__badge-count">1</span>
          )}
        </button>
      </div>
    </header>
  );
}
