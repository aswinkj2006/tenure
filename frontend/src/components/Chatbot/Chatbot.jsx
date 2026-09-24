import { useState, useRef, useEffect } from 'react';
import { Send, MessageCircle, ChevronDown } from 'lucide-react';
import MessageBubble from './MessageBubble';
import FeedbackControls from './FeedbackControls';
import './Chatbot.css';

export default function Chatbot({
  messages = [],
  isLoading = false,
  onSend,
  onFeedback,
  readOnly = false,
  title = 'Ask Tenure',
  placeholder = 'Ask about this machine...',
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend?.(input.trim());
    setInput('');
  };

  return (
    <div className={`chatbot ${readOnly ? 'chatbot--readonly' : ''}`}>
      {/* Header */}
      <div className="chatbot__header">
        <span className="chatbot__title">{title}</span>
      </div>

      {/* Messages */}
      <div className="chatbot__messages">
        {messages.length === 0 && !readOnly ? (
          <div className="chatbot__empty">
            <MessageCircle className="chatbot__empty-icon" strokeWidth={1} />
            <span className="chatbot__empty-text">
              Ask me anything about this machine — sensor readings, diagnostics, maintenance tips.
            </span>
          </div>
        ) : (
          messages.map((msg, i) => {
            // Show feedback after the last assistant message that has citations
            const showFeedback = !readOnly
              && msg.role === 'assistant'
              && msg.citations?.length > 0
              && i === messages.length - 1;

            return (
              <MessageBubble
                key={msg.id || i}
                message={msg}
                showFeedback={showFeedback}
                feedbackControls={
                  showFeedback ? (
                    <FeedbackControls
                      diagnosisId={msg.anomaly_id || 'diag-mock-001'}
                      onSubmit={onFeedback}
                    />
                  ) : null
                }
              />
            );
          })
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="chatbot__loading">
            <div className="chatbot__loading-dot" />
            <div className="chatbot__loading-dot" />
            <div className="chatbot__loading-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {!readOnly && (
        <form className="chatbot__input" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            disabled={isLoading}
          />
          <button
            className="chatbot__send"
            type="submit"
            disabled={!input.trim() || isLoading}
            aria-label="Send message"
          >
            <Send size={18} strokeWidth={1.5} />
          </button>
        </form>
      )}
    </div>
  );
}
