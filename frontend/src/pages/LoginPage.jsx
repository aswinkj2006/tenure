import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowRight, Wrench, BarChart3, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import './LoginPage.css';

const PRESET_PERSONAS = [
  {
    id: 'tech',
    name: 'Dave Miller',
    role: 'Lead Mechatronics Technician',
    email: 'dave.miller@plantops.industrial',
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
    badge: 'Fleet & Analytics',
    icon: BarChart3,
    avatarClass: 'persona-avatar--overseer',
    initials: 'SL',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [selectedPersona, setSelectedPersona] = useState(PRESET_PERSONAS[0]);
  const [email, setEmail] = useState(PRESET_PERSONAS[0].email);
  const [password, setPassword] = useState('••••••••••••');

  const handleSelectPersona = (p) => {
    setSelectedPersona(p);
    setEmail(p.email);
    setPassword('••••••••••••');
  };

  const handleLogin = (e) => {
    e?.preventDefault();
    const user = {
      name: selectedPersona ? selectedPersona.name : email.split('@')[0],
      role: selectedPersona ? selectedPersona.role : 'Field Engineer',
      email: email,
      id: selectedPersona ? selectedPersona.id : 'custom',
    };
    localStorage.setItem('tenure_user', JSON.stringify(user));
    toast.success(`Welcome back, ${user.name}!`, {
      description: `Authenticated as ${user.role}. System operational.`,
    });
    navigate('/');
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

        <div className="persona-selector">
          <span className="persona-label">Quick Access Operator Personas</span>
          {PRESET_PERSONAS.map((p) => {
            const isSelected = selectedPersona?.id === p.id;
            const Icon = p.icon;
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
          <span>Or Sign In</span>
        </div>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Station Operator Email</label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="login-submit-btn">
            <span>Enter Plant Console</span>
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="login-footer">
          Universal Robots UR5e · ISO 10218-1 Safety Compliant · Zero-Data Leak Isolation
        </div>
      </motion.div>
    </div>
  );
}
