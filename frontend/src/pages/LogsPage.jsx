import { useState, useEffect } from 'react';
import FilterBar from '../components/FilterBar/FilterBar';
import IssueRow from '../components/IssueRow/IssueRow';
import IssueDetail from '../components/IssueDetail/IssueDetail';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { getLogs } from '../api/client';
import './LogsPage.css';

export default function LogsPage() {
  const [filters, setFilters] = useState({});
  const [issues, setIssues] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getLogs(filters);
      setIssues(data.issues);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const openCount = issues.filter((i) => i.status === 'open').length;

  return (
    <div className="logs-page">
      {/* Hero */}
      <div className="logs-hero">
        <div className="logs-hero__text">
          {openCount > 0
            ? `${openCount} issue${openCount > 1 ? 's' : ''} still open.`
            : 'All clear — no open issues right now.'}
        </div>
        <div className="logs-hero__sub">
          {total} total issue{total !== 1 ? 's' : ''} on record. Use the filters below to find what you need.
        </div>
        <svg className="logs-hero__watermark" viewBox="0 0 96 96" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round">
          <circle cx="48" cy="48" r="18" />
          <circle cx="48" cy="48" r="6" fill="currentColor" opacity="0.2" />
          <path d="M48 12v10M48 74v10M12 48h10M74 48h10M20 20l7 7M69 69l7 7M20 76l7-7M69 27l7-7" />
        </svg>
      </div>

      {/* Filters */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Issue count */}
      {!loading && !error && (
        <div className="logs-count">
          Showing {issues.length} of {total} issues
        </div>
      )}

      {/* Issue list */}
      <div className="logs-list">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="card" height={80} />
          ))
        ) : error ? (
          <ErrorState title="Couldn't load issues" message={error} onRetry={fetchLogs} />
        ) : issues.length === 0 ? (
          <EmptyState
            title="No issues found"
            message="Try adjusting your filters, or check back later."
          />
        ) : (
          issues.map((issue) => (
            <IssueRow
              key={issue.anomaly_id}
              issue={issue}
              onClick={() => setSelectedId(issue.anomaly_id)}
            />
          ))
        )}
      </div>

      {/* Detail drawer */}
      {selectedId && (
        <IssueDetail
          anomalyId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
