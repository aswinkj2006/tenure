import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FilterBar from '../components/FilterBar/FilterBar';
import IssueRow from '../components/IssueRow/IssueRow';
import IssueDetail from '../components/IssueDetail/IssueDetail';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import { getLogs } from '../api/client';
import { staggerContainerVariants, itemFadeUpVariants } from '../utils/motion';
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
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="logs-page"
    >
      {/* Hero */}
      <motion.div variants={itemFadeUpVariants} className="logs-hero glass glass-sheen">
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
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemFadeUpVariants}>
        <FilterBar filters={filters} onChange={setFilters} />
      </motion.div>

      {/* Issue count */}
      {!loading && !error && (
        <motion.div variants={itemFadeUpVariants} className="logs-count font-mono">
          Showing {issues.length} of {total} issues
        </motion.div>
      )}

      {/* Issue list with AnimatePresence */}
      <motion.div variants={itemFadeUpVariants} className="logs-list">
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
          <AnimatePresence mode="popLayout">
            {issues.map((issue) => (
              <motion.div
                key={issue.anomaly_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <IssueRow
                  issue={issue}
                  onClick={() => setSelectedId(issue.anomaly_id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      {/* Detail drawer with AnimatePresence */}
      <AnimatePresence>
        {selectedId && (
          <IssueDetail
            anomalyId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
