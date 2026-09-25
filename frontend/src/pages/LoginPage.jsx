import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, Wrench, BarChart3, UserPlus, LogIn, Lock, Mail, User } from 'lucide-react';
import { toast } from 'sonner';
import './LoginPage.css';

const PRESET_PERSONAS = [
  {
    id: 'demo-fleet',
    name: 'Aswin (Plant Director)',
    role: 'Plant Reliability Overseer',
    email: 'plantops.demo@industrial.com',
    password: 'Tenure2026!',
    badge: '4-Machine Fleet Ready',
    icon: ShieldCheck,
    avatarClass: 'persona-avatar--overseer',
    initials: 'PD',
  },
  {
    id: 'tech',
    name: 'Dave Miller',
    role: 'Lead Mechatronics Technician',
    email: 'dave.miller@plantops.industrial',
    password: 'password123',
    badge: 'Hardware & Kinematics',
    icon: Wrench,
    avatarClass: 'persona-avatar--tech',
    initials: 'DM',
  },
  {
    id: 'overseer',
    name: 'Sarah Lin',
    role: 'Plant Reliability Overseer',
    email: 'sarah.lin@plantops.industrial',
    password: 'password123',
    badge: 'Fleet & Analytics',
    icon: BarChart3,
    avatarClass: 'persona-avatar--overseer',
    initials: 'SL',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('register'); // Default to register for new user showcase flow
  const [selectedPersona, setSelectedPersona] = useState(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('dave.miller@plantops.industrial');
  const [loginPassword, setLoginPassword] = useState('password123');

  // Register form state
  const [regFullName, setRegFullName] = useState('Alex Mercer');
  const [regEmail, setRegEmail] = useState('alex.mercer@plantops.industrial');
  const [regRole, setRegRole] = useState('Autonomous Robotics Specialist');
  const [regPassword, setRegPassword] = useState('securepass2026');
  const [regConfirmPassword, setRegConfirmPassword] = useState('securepass2026');
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPersona = (p) => {
    setSelectedPersona(p);
    setLoginEmail(p.email);
    setLoginPassword(p.password || 'password123');
  };

  const handleLoginSubmit = async (e) => {
    e?.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginEmail,
          password: loginPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Authentication failed. Please verify credentials.');
      }

      const data = await res.json();
      const user = data.user || {
        name: selectedPersona ? selectedPersona.name : loginEmail.split('@')[0],
        role: selectedPersona ? selectedPersona.role : 'Field Engineer',
        email: loginEmail,
      };

      localStorage.setItem('tenure_user', JSON.stringify(user));
      toast.success(`Welcome back, ${user.full_name || user.name}!`, {
        description: `Authenticated with PBKDF2 hash verification. Role: ${user.role}.`,
      });
      navigate('/');
    } catch (err) {
      toast.error('Login Failed', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e?.preventDefault();
    if (regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regEmail,
          password: regPassword,
          full_name: regFullName,
          role: regRole,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Registration failed. User may already exist.');
      }

      const data = await res.json();
      const user = data.user;
      localStorage.setItem('tenure_user', JSON.stringify(user));

      toast.success(`Account Registered & Hash Stored!`, {
        description: `Salted PBKDF2-HMAC-SHA256 password hash written to local SQLite database. Directing to Machine Setup...`,
      });

      // New users go straight to machine adding page as requested
      navigate('/onboard');
    } catch (err) {
      toast.error('Registration Error', { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <motion.div
        className="login-card glass-strong"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="login-header">
          <div className="login-logo-badge">
            <ShieldCheck size={28} strokeWidth={1.5} />
          </div>
          <h1 className="login-title">Tenure</h1>
          <p className="login-subtitle">
            Autonomous industrial digital twin & continuously learning RAG technician.
          </p>
        </div>

        {/* Tab Switcher: Register (New User) vs Sign In */}
        <div className="auth-tab-switch">
          <button
            type="button"
            className={`auth-tab-btn ${activeTab === 'register' ? 'auth-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('register')}
          >
            <UserPlus size={15} />
            <span>Register Operator (Local DB)</span>
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${activeTab === 'login' ? 'auth-tab-btn--active' : ''}`}
            onClick={() => setActiveTab('login')}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>
        </div>

        {activeTab === 'register' ? (
          <form className="login-form" onSubmit={handleRegisterSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">
                <User size={13} />
                <span>Full Name</span>
              </label>
              <input
                id="reg-name"
                type="text"
                className="form-input"
                value={regFullName}
                onChange={(e) => setRegFullName(e.target.value)}
                placeholder="e.g. Alex Mercer"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                <Mail size={13} />
                <span>Operator Email / Identifier</span>
              </label>
              <input
                id="reg-email"
                type="email"
                className="form-input"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="operator@plantops.industrial"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-role">
                <Wrench size={13} />
                <span>Operational Role</span>
              </label>
              <select
                id="reg-role"
                className="form-input form-select"
                value={regRole}
                onChange={(e) => setRegRole(e.target.value)}
              >
                <option value="Autonomous Robotics Specialist">Autonomous Robotics Specialist</option>
                <option value="Lead Mechatronics Technician">Lead Mechatronics Technician</option>
                <option value="Plant Reliability Overseer">Plant Reliability Overseer</option>
                <option value="Field Automation Engineer">Field Automation Engineer</option>
              </select>
            </div>

            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="reg-pass">
                  <Lock size={13} />
                  <span>Password</span>
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  className="form-input"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reg-confirm">
                  <Lock size={13} />
                  <span>Confirm</span>
                </label>
                <input
                  id="reg-confirm"
                  type="password"
                  className="form-input"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
              </div>
            </div>

            <div className="security-notice">
              <Lock size={12} />
              <span>Passwords securely hashed with salted 100,000-iteration PBKDF2-HMAC-SHA256 in local SQLite DB.</span>
            </div>

            <button type="submit" className="login-submit-btn" disabled={isLoading}>
              <span>{isLoading ? 'Creating Local Credentials...' : 'Register & Enter Asset Setup'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div>
            <div className="persona-selector">
              <span className="persona-label">Quick Access Operator Personas</span>
              {PRESET_PERSONAS.map((p) => {
                const isSelected = selectedPersona?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`persona-card ${isSelected ? 'persona-card--active' : ''}`}
                    onClick={() => handleSelectPersona(p)}
                  >
                    <div className={`persona-avatar ${p.avatarClass}`}>
                      {p.initials}
                    </div>
                    <div className="persona-info">
                      <div className="persona-name">{p.name}</div>
                      <div className="persona-role">{p.role}</div>
                    </div>
                    <span className="persona-tag">{p.badge}</span>
                  </button>
                );
              })}
            </div>

            <div className="login-divider">
              <span>Or Direct Sign In</span>
            </div>

            <form className="login-form" onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Station Operator Email</label>
                <input
                  id="login-email"
                  type="email"
                  className="form-input"
                  value={loginEmail}
                  onChange={(e) => {
                    setLoginEmail(e.target.value);
                    setSelectedPersona(null);
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Access Passcode / Security Key</label>
                <input
                  id="login-password"
                  type="password"
                  className="form-input"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="login-submit-btn" disabled={isLoading}>
                <span>{isLoading ? 'Authenticating Hash...' : 'Enter Fleet Console'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>
        )}

        <div className="login-footer">
          Universal Robots UR5e · ISO 10218-1 Safety Compliant · Zero-Data Leak Isolation
        </div>
      </motion.div>
    </div>
  );
}
