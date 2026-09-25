import { useState, useCallback } from 'react';
import { sendChat, sendFeedback } from '../api/client';

/**
 * Chat state management hook.
 * Handles messages, loading, citations, and feedback flow.
 *
 * Returns: { messages, isLoading, send, submitFeedback }
 */
export default function useChat(machineId, { anomalyId = null } = {}) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const send = useCallback(async (text) => {
    // Add user message
    const userMsg = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      ts: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await sendChat({
        machine_id: machineId,
        message: text,
        anomaly_id: anomalyId,
      });

      const assistantMsg = {
        id: `msg-${Date.now()}-resp`,
        role: 'assistant',
        content: response.response,
        citations: response.citations || [],
        chart_data: response.chart_data || null,
        anomaly_id: response.anomaly_id,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: 'I couldn\'t process that right now. Please try again.',
        isError: true,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [machineId, anomalyId]);

  const submitFeedback = useCallback(async (diagnosisId, outcome, confirmedCause) => {
    try {
      await sendFeedback({
        diagnosis_id: diagnosisId,
        outcome,
        confirmed_cause: confirmedCause,
      });

      // Add feedback acknowledgment message
      const feedbackMsg = {
        id: `msg-${Date.now()}-fb`,
        role: 'system',
        content: outcome === 'confirmed'
          ? 'Thanks! Diagnosis confirmed. This will help improve future predictions.'
          : `Got it — the actual cause was: "${confirmedCause}". I\'ll learn from this.`,
        ts: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, feedbackMsg]);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Load initial system message for anomaly context
  const loadAnomalyContext = useCallback((alertData) => {
    if (!alertData) return;
    const systemMsg = {
      id: `msg-system-${Date.now()}`,
      role: 'system',
      content: `Anomaly detected: ${alertData.message || 'Unusual sensor activity detected'}`,
      ts: alertData.ts || new Date().toISOString(),
    };
    setMessages((prev) => {
      if (prev.some((m) => m.role === 'system' && m.content.includes('Anomaly detected'))) return prev;
      return [systemMsg, ...prev];
    });
  }, []);

  return {
    messages,
    isLoading,
    send,
    submitFeedback,
    loadAnomalyContext,
  };
}
