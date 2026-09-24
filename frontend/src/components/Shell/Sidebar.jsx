import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Cpu, FileText } from 'lucide-react';
import StatusDot from '../common/StatusDot';
import useSensorStore from '../../stores/sensorStore';
import './Sidebar.css';

/* Inline SVG gear logo mark */
function LogoMark() {
  return (
    <svg
      className="sidebar__logo-icon"
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="14" cy="14" r="5" />
      <circle cx="14" cy="14" r="2" fill="currentColor" opacity="0.3" />
      <path d="M14 3v3M14 22v3M3 14h3M22 14h3M6.1 6.1l2.1 2.1M19.8 19.8l2.1 2.1M6.1 21.9l2.1-2.1M19.8 8.2l2.1-2.1" />
    </svg>
  );
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/machine/ur5e-001', label: 'Machine', icon: Cpu },
  { to: '/logs', label: 'Logs', icon: FileText },
];

export default function Sidebar() {
  const connected = useSensorStore((s) => s.connected);

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar__logo">
        <LogoMark />
        <span className="sidebar__logo-text">Tenure</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
          >
            <Icon className="sidebar__link-icon" strokeWidth={1.5} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Sim connection status */}
      <div className="sidebar__footer">
        <div className="sidebar__status">
          <StatusDot status={connected ? 'ok' : 'offline'} pulse={connected} />
          {connected ? 'Sim live' : 'Sim standby'}
        </div>
      </div>
    </aside>
  );
}
