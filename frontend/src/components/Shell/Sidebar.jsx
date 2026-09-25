import { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Cpu, FileText, Command, PlusCircle, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import StatusDot from '../common/StatusDot';
import useSensorStore from '../../stores/sensorStore';
import { SPRING_INTERACTIVE } from '../../utils/motion';
import { toast } from 'sonner';
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
  { to: '/machine/ur5e-001', label: 'Machine Twin', icon: Cpu },
  { to: '/onboard', label: 'Onboard Asset', icon: PlusCircle },
  { to: '/logs', label: 'Audit Logs', icon: FileText },
];

export default function Sidebar() {
  const connected = useSensorStore((s) => s.connected);
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('tenure_user');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      } else {
        setCurrentUser({
          name: 'Dave Miller',
          role: 'Lead Mechatronics Tech',
          id: 'tech',
        });
      }
    } catch {
      // ignore
    }
  }, [location.pathname]);

  const handleOpenCmd = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
  };

  const handleLogout = () => {
    localStorage.removeItem('tenure_user');
    toast('Session signed out', { description: 'Redirecting to login portal.' });
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'DM';
    const parts = name.split(' ');
    return parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2).toUpperCase();
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

      {/* Footer with Command Shortcut, Telemetry Status & User info */}
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
          <span>{connected ? 'ProtoTwin 20Hz Live' : 'Telemetry Standby'}</span>
        </div>

        {currentUser && (
          <div className="sidebar__user-box">
            <div className="sidebar__user-info">
              <div className="sidebar__user-avatar">
                {getInitials(currentUser.name)}
              </div>
              <div className="sidebar__user-details">
                <span className="sidebar__user-name">{currentUser.name}</span>
                <span className="sidebar__user-role">{currentUser.role}</span>
              </div>
            </div>
            <button
              type="button"
              className="sidebar__logout-btn"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
