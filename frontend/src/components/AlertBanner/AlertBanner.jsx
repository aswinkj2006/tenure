import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import Badge from '../common/Badge';
import { relativeTime } from '../../utils/format';
import './AlertBanner.css';

export default function AlertBanner({ alert, onDismiss }) {
  const [exiting, setExiting] = useState(false);

  if (!alert) return null;

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => {
      onDismiss?.();
      setExiting(false);
    }, 200);
  };

  const severity = alert.severity || 'critical';

  return (
    <div className="alert-banner-wrapper">
      <div className={`alert-banner ${severity === 'medium' ? 'alert-banner--warn' : ''} ${exiting ? 'alert-banner--exiting' : ''}`}>
        <div className="alert-banner__top">
          <div className="alert-banner__content">
            <div className="alert-banner__severity">
              <AlertTriangle size={16} strokeWidth={1.5} />
              <Badge variant={severity}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</Badge>
            </div>

            <div className="alert-banner__lines">
              <div className="alert-banner__line alert-banner__line--what">
                <span className="alert-banner__line-prefix">What</span>
                {alert.what || alert.message || 'Unusual sensor activity detected'}
              </div>
              <div className="alert-banner__line alert-banner__line--why">
                <span className="alert-banner__line-prefix">Why</span>
                {alert.why || 'The AI is analyzing possible causes.'}
              </div>
              <div className="alert-banner__line alert-banner__line--todo">
                <span className="alert-banner__line-prefix">Do</span>
                {alert.todo || 'Review the diagnosis below for recommended next steps.'}
              </div>
            </div>

            <div className="alert-banner__time">{relativeTime(alert.ts)}</div>
          </div>

          <button
            className="alert-banner__dismiss"
            onClick={handleDismiss}
            aria-label="Dismiss alert"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
