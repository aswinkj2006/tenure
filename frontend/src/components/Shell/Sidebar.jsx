import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Cpu, FileText, Command } from 'lucide-react';
import { motion } from 'framer-motion';
import StatusDot from '../common/StatusDot';
import useSensorStore from '../../stores/sensorStore';
import { SPRING_INTERACTIVE } from '../../utils/motion';
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
  const location = useLocation();

  const handleOpenCmd = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  };

  return (
    <aside className="sidebar glass-strong">
      {/* Logo */}
      <div className="sidebar__logo">
        <LogoMark />
        <span className="sidebar__logo-text">Tenure</span>
      </div>

      {/* Navigation with shared layout pill */}
      <nav className="sidebar__nav">
        {navItems.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={`sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebarActivePill"
                  className="sidebar__active-pill"
                  transition={SPRING_INTERACTIVE}
                />
              )}
              <Icon className="sidebar__link-icon" strokeWidth={1.5} />
              <span className="sidebar__link-label">{label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer with Command Shortcut & Connection Indicator */}
      <div className="sidebar__footer">
        <button
          type="button"
          className="sidebar__cmd-btn glass-subtle"
          onClick={handleOpenCmd}
          title="Open Command Palette (Cmd+K)"
        >
          <div className="sidebar__cmd-content">
            <Command size={13} />
            <span>Search menu</span>
          </div>
          <kbd className="sidebar__cmd-kbd font-mono">⌘K</kbd>
        </button>

        <div className="sidebar__status">
          <StatusDot status={connected ? 'ok' : 'offline'} pulse={connected} />
          <span>{connected ? 'Telemetry live' : 'Telemetry standby'}</span>
        </div>
      </div>
    </aside>
  );
}
