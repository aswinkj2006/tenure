import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle, Sparkles } from 'lucide-react';
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
    <div className={`chatbot glass-strong ${readOnly ? 'chatbot--readonly' : ''}`}>
      {/* Header */}
      <div className="chatbot__header">
        <div className="chatbot__header-left">
          <span className="chatbot__title">{title}</span>
        </div>
        <Sparkles size={14} className="text-terracotta" />
      </div>

      {/* Messages */}
      <div className="chatbot__messages">
        {messages.length === 0 && !readOnly ? (
          <div className="chatbot__empty">
            <MessageCircle className="chatbot__empty-icon" strokeWidth={1.2} />
            <span className="chatbot__empty-text">
              Ask Tenure anything about telemetry anomalies, operating envelopes, or UR5e maintenance procedures.
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => {
              const showFeedback = !readOnly
                && msg.role === 'assistant'
                && msg.citations?.length > 0
                && i === messages.length - 1;

              return (
                <motion.div
                  key={msg.id || i}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  <MessageBubble
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
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Loading wave indicator */}
        {isLoading && (
          <div className="chatbot__loading">
            <div className="chatbot__loading-dot" />
            <div className="chatbot__loading-dot" />
            <div className="chatbot__loading-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input bar pinned */}
      {!readOnly && (
        <form className="chatbot__input glass-subtle" onSubmit={handleSubmit}>
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
            <Send size={16} strokeWidth={1.5} />
          </button>
        </form>
      )}
    </div>
  );
}
