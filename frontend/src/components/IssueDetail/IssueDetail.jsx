import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Download } from 'lucide-react';
import Badge from '../common/Badge';
import Skeleton from '../common/Skeleton';
import ErrorState from '../common/ErrorState';
import Chatbot from '../Chatbot/Chatbot';
import CitationChip from '../Chatbot/CitationChip';
import { getLogDetail, getExportPdfUrl } from '../../api/client';
import { friendlyJointName, formatValue, formatTimestamp } from '../../utils/format';
import { SPRING_GENTLE } from '../../utils/motion';
import './IssueDetail.css';

export default function IssueDetail({ anomalyId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLogDetail(anomalyId);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (anomalyId) fetchDetail();
  }, [anomalyId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!anomalyId) return null;

  const chatMessages = (detail?.conversation || []).map((msg, i) => ({
    id: `conv-${i}`,
    role: msg.role,
    content: msg.content,
    citations: msg.citations || [],
    ts: msg.ts,
  }));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="issue-detail-overlay"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={SPRING_GENTLE}
        className="issue-detail glass-strong"
      >
        {/* Header */}
        <div className="issue-detail__header">
          <div className="issue-detail__header-left">
            <span className="issue-detail__title">Issue Detail</span>
            {detail && <Badge variant={detail.severity}>{detail.severity}</Badge>}
          </div>
          <div className="issue-detail__actions">
            <a
              className="issue-detail__export glass-subtle"
              href={getExportPdfUrl(anomalyId)}
              download
              aria-label="Export as PDF"
            >
              <Download size={14} strokeWidth={1.5} />
              Export PDF
            </a>
            <button className="issue-detail__close glass-subtle" onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="issue-detail__body">
          {loading ? (
            <>
              <Skeleton variant="heading" />
              <Skeleton variant="text" count={4} />
              <Skeleton variant="card" height={120} />
            </>
          ) : error ? (
            <ErrorState title="Couldn't load issue" message={error} onRetry={fetchDetail} />
          ) : detail && (
            <>
              {/* What was flagged */}
              <div className="issue-detail__section glass-subtle">
                <div className="issue-detail__section-title">What was flagged</div>
                <div className="issue-detail__flagged">
                  {detail.anomaly_data?.flagged_sensors?.map((sensor) => (
                    <div key={sensor} className="issue-detail__flagged-item">
                      <div>
                        <div className="issue-detail__flagged-name">{friendlyJointName(sensor)}</div>
                        <div className="issue-detail__flagged-value font-mono">
                          {formatValue(detail.anomaly_data.sensor_values_at_flag?.[sensor])} Nm
                        </div>
                      </div>
                      <div className="issue-detail__flagged-deviation font-mono">
                        {formatValue(detail.anomaly_data.deviation_magnitude?.[sensor])}σ above normal
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnosis */}
              <div className="issue-detail__section glass-subtle">
                <div className="issue-detail__section-title">Diagnosis & Root Cause</div>
                <div className="issue-detail__diagnosis-text">{detail.diagnosis?.text}</div>
                {detail.diagnosis?.confidence && (
                  <div className="issue-detail__confidence font-mono">
                    Confidence: {Math.round(detail.diagnosis.confidence * 100)}%
                  </div>
                )}
                {detail.diagnosis?.citations?.length > 0 && (
                  <div className="issue-detail__citations">
                    {detail.diagnosis.citations.map((c, i) => (
                      <CitationChip key={i} citation={c} />
                    ))}
                  </div>
                )}
              </div>

              {/* Conversation */}
              <div className="issue-detail__section">
                <div className="issue-detail__section-title">Technician Conversation</div>
                <div className="issue-detail__conversation">
                  <Chatbot messages={chatMessages} readOnly title="Conversation transcript" />
                </div>
              </div>

              {/* Outcome */}
              {detail.feedback && (
                <div className="issue-detail__section glass-subtle">
                  <div className="issue-detail__section-title">Verified Outcome</div>
                  <div className={`issue-detail__outcome ${detail.feedback.outcome === 'corrected' ? 'issue-detail__outcome--corrected' : ''}`}>
                    <div className="issue-detail__outcome-label">
                      {detail.feedback.outcome === 'confirmed' ? 'Diagnosis confirmed' : 'Diagnosis corrected'}
                    </div>
                    {detail.feedback.confirmed_cause && (
                      <div className="issue-detail__outcome-cause">{detail.feedback.confirmed_cause}</div>
                    )}
                    <div className="issue-detail__outcome-time font-mono">{formatTimestamp(detail.feedback.ts)}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}
