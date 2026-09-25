import { Box } from 'lucide-react';
import StatusDot from '../common/StatusDot';
import { healthToStatus, friendlyStatus } from '../../utils/format';
import './TwinEmbed.css';

export default function TwinEmbed({ machineName, status = 'online', healthScore = 100, iframeUrl }) {
  const dotStatus = healthToStatus(healthScore);
  const statusText = friendlyStatus(status);

  return (
    <div className="twin-embed">
      <div className="twin-embed__header">
        <div className="twin-embed__info">
          <StatusDot status={dotStatus} size="lg" pulse={status === 'online'} />
          <span className="twin-embed__name">{machineName || 'Digital Twin'}</span>
        </div>
        <div className="twin-embed__status">{statusText}</div>
      </div>

      <div className="twin-embed__frame">
        {iframeUrl ? (
          <iframe
            className="twin-embed__iframe"
            src={iframeUrl}
            title="ProtoTwin 3D View"
            allow="autoplay"
          />
        ) : (
          <div className="twin-embed__placeholder">
            <Box className="twin-embed__placeholder-icon" strokeWidth={1} />
            <span className="twin-embed__placeholder-text">
              3D twin will appear when ProtoTwin connects
            </span>
          </div>
        )}

        {/* Subtle gear watermark */}
        <svg
          className="twin-embed__watermark"
          viewBox="0 0 48 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        >
          <circle cx="24" cy="24" r="8" />
          <circle cx="24" cy="24" r="3" fill="currentColor" opacity="0.3" />
          <path d="M24 6v5M24 37v5M6 24h5M37 24h5M10.8 10.8l3.5 3.5M33.7 33.7l3.5 3.5M10.8 37.2l3.5-3.5M33.7 14.3l3.5-3.5" />
        </svg>
      </div>
    </div>
  );
}
