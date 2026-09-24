import StatusDot from '../common/StatusDot';
import Badge from '../common/Badge';
import { relativeTime, severityToStatus } from '../../utils/format';
import './IssueRow.css';

export default function IssueRow({ issue, onClick }) {
  const dotStatus = severityToStatus(issue.severity);

  return (
    <div className="issue-row" onClick={onClick} role="button" tabIndex={0}>
      <StatusDot className="issue-row__severity-dot" status={dotStatus} size="lg" />

      <div className="issue-row__content">
        <div className="issue-row__title">{issue.diagnosis_summary}</div>
        <div className="issue-row__meta">
          <span>{issue.machine_name}</span>
          <span className="issue-row__meta-separator">·</span>
          <span>{issue.flagged_sensors?.map(s => s.replace(/_/g, ' ')).join(', ')}</span>
        </div>
      </div>

      <div className="issue-row__badges">
        <Badge variant={issue.severity}>{issue.severity}</Badge>
        <Badge variant={issue.status}>{issue.status}</Badge>
        {issue.outcome && <Badge variant={issue.outcome}>{issue.outcome}</Badge>}
      </div>

      <div className="issue-row__time">{relativeTime(issue.timestamp)}</div>
    </div>
  );
}
