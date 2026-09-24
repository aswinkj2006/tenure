import CitationChip from './CitationChip';
import { format } from 'date-fns';

export default function MessageBubble({ message, showFeedback, feedbackControls }) {
  const { role, content, citations, isError, ts } = message;

  const roleClass = role === 'user' ? 'message--user'
    : role === 'system' ? 'message--system'
    : 'message--assistant';

  const timeStr = ts ? format(new Date(ts), 'h:mm a') : '';

  return (
    <div className={`message ${roleClass} ${isError ? 'message--error' : ''}`}>
      <div className="message__bubble">
        {content}
      </div>

      {/* Citations */}
      {citations && citations.length > 0 && (
        <div className="message__citations">
          {citations.map((c, i) => (
            <CitationChip key={i} citation={c} />
          ))}
        </div>
      )}

      {/* Feedback controls after diagnosis */}
      {showFeedback && feedbackControls}

      {timeStr && <div className="message__time">{timeStr}</div>}
    </div>
  );
}
