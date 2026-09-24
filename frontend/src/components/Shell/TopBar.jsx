import { Bell, Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
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

  return (
    <header className="topbar">
      <div className="topbar__greeting">
        <span className="topbar__greeting-text">{greeting}, Technician</span>
        <span className="topbar__greeting-date">{dateStr}</span>
      </div>

      <div className="topbar__actions">
        {!connected && (
          <div className="topbar__reconnecting">
            <WifiOff size={12} strokeWidth={1.5} />
            Telemetry offline
          </div>
        )}

        <button className="topbar__icon-btn" aria-label="Notifications">
          <Bell size={18} strokeWidth={1.5} />
          {anomalyActive && (
            <span className="topbar__badge-count">1</span>
          )}
        </button>
      </div>
    </header>
  );
}
