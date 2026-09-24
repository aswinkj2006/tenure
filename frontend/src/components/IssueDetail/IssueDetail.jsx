import { useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import Badge from '../common/Badge';
import Skeleton from '../common/Skeleton';
import ErrorState from '../common/ErrorState';
import Chatbot from '../Chatbot/Chatbot';
import CitationChip from '../Chatbot/CitationChip';
import { getLogDetail, getExportPdfUrl } from '../../api/client';
import { friendlyJointName, formatValue, formatTimestamp, relativeTime } from '../../utils/format';
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

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!anomalyId) return null;

  // Convert conversation to chatbot message format
  const chatMessages = (detail?.conversation || []).map((msg, i) => ({
    id: `conv-${i}`,
    role: msg.role,
    content: msg.content,
    citations: msg.citations || [],
    ts: msg.ts,
  }));

  return (
    <>
      <div className="issue-detail-overlay" onClick={onClose} />
      <div className="issue-detail">
        {/* Header */}
        <div className="issue-detail__header">
          <div className="issue-detail__header-left">
            <span className="issue-detail__title">Issue Detail</span>
            {detail && <Badge variant={detail.severity}>{detail.severity}</Badge>}
          </div>
          <div className="issue-detail__actions">
            <a
              className="issue-detail__export"
              href={getExportPdfUrl(anomalyId)}
              download
              aria-label="Export as PDF"
            >
              <Download size={14} strokeWidth={1.5} />
              Export PDF
            </a>
            <button className="issue-detail__close" onClick={onClose} aria-label="Close">
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="issue-detail__body">
          {loading ? (
            <>
              <Skeleton variant="heading" />
              <Skeleton variant="text" count={4} />
              <Skeleton variant="chart" />
            </>
          ) : error ? (
            <ErrorState title="Couldn't load issue" message={error} onRetry={fetchDetail} />
          ) : detail && (
            <>
              {/* What was flagged */}
              <div className="issue-detail__section">
                <div className="issue-detail__section-title">What was flagged</div>
                <div className="issue-detail__flagged">
                  {detail.anomaly_data?.flagged_sensors?.map((sensor) => (
                    <div key={sensor} className="issue-detail__flagged-item">
                      <div>
                        <div className="issue-detail__flagged-name">{friendlyJointName(sensor)}</div>
                        <div className="issue-detail__flagged-value">
                          {formatValue(detail.anomaly_data.sensor_values_at_flag?.[sensor])} Nm
                        </div>
                      </div>
                      <div className="issue-detail__flagged-deviation">
                        {formatValue(detail.anomaly_data.deviation_magnitude?.[sensor])}σ above normal
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diagnosis */}
              <div className="issue-detail__section">
                <div className="issue-detail__section-title">Diagnosis</div>
                <div className="issue-detail__diagnosis-text">{detail.diagnosis?.text}</div>
                {detail.diagnosis?.confidence && (
                  <div className="issue-detail__confidence">
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
                <div className="issue-detail__section-title">Conversation</div>
                <div className="issue-detail__conversation">
                  <Chatbot messages={chatMessages} readOnly title="Conversation transcript" />
                </div>
              </div>

              {/* Outcome */}
              {detail.feedback && (
                <div className="issue-detail__section">
                  <div className="issue-detail__section-title">Outcome</div>
                  <div className={`issue-detail__outcome ${detail.feedback.outcome === 'corrected' ? 'issue-detail__outcome--corrected' : ''}`}>
                    <div className="issue-detail__outcome-label">
                      {detail.feedback.outcome === 'confirmed' ? 'Diagnosis confirmed' : 'Diagnosis corrected'}
                    </div>
                    {detail.feedback.confirmed_cause && (
                      <div className="issue-detail__outcome-cause">{detail.feedback.confirmed_cause}</div>
                    )}
                    <div className="issue-detail__outcome-time">{formatTimestamp(detail.feedback.ts)}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
