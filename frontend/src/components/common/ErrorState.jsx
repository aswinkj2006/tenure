import { AlertTriangle, RefreshCw } from 'lucide-react';
import './ErrorState.css';

export default function ErrorState({ 
  title = 'Something went wrong', 
  message = 'We couldn\'t load this data. Check your connection and try again.', 
  onRetry 
}) {
  return (
    <div className="error-state">
      <AlertTriangle className="error-state__icon" strokeWidth={1.5} />
      <div className="error-state__title">{title}</div>
      <p className="error-state__message">{message}</p>
      {onRetry && (
        <button className="error-state__retry" onClick={onRetry}>
          <RefreshCw size={14} strokeWidth={1.5} />
          Try again
        </button>
      )}
    </div>
  );
}
