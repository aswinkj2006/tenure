import { useState } from 'react';
import { Check, X } from 'lucide-react';

export default function FeedbackControls({ diagnosisId, onSubmit }) {
  const [state, setState] = useState('pending'); // pending | correcting | done
  const [correction, setCorrection] = useState('');

  if (state === 'done') {
    return (
      <div className="feedback-controls">
        <button className="feedback-btn feedback-btn--done">
          <Check size={14} strokeWidth={1.5} />
          Feedback submitted
        </button>
      </div>
    );
  }

  if (state === 'correcting') {
    return (
      <div>
        <div className="feedback-controls">
          <span className="feedback-controls__label">What actually happened?</span>
        </div>
        <div className="feedback-input">
          <input
            type="text"
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="Describe the actual cause..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && correction.trim()) {
                onSubmit?.(diagnosisId, 'corrected', correction.trim());
                setState('done');
              }
            }}
          />
          <button
            onClick={() => {
              if (correction.trim()) {
                onSubmit?.(diagnosisId, 'corrected', correction.trim());
                setState('done');
              }
            }}
          >
            Submit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="feedback-controls">
      <span className="feedback-controls__label">Was this diagnosis correct?</span>
      <button
        className="feedback-btn feedback-btn--confirm"
        onClick={() => {
          onSubmit?.(diagnosisId, 'confirmed');
          setState('done');
        }}
      >
        <Check size={14} strokeWidth={1.5} />
        Confirm
      </button>
      <button
        className="feedback-btn feedback-btn--correct"
        onClick={() => setState('correcting')}
      >
        <X size={14} strokeWidth={1.5} />
        Correct
      </button>
    </div>
  );
}
