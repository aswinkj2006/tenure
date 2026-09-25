import { Search, Download } from 'lucide-react';
import { getExportCsvUrl } from '../../api/client';
import './FilterBar.css';

export default function FilterBar({ filters, onChange }) {
  const handleChange = (key, value) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  return (
    <div className="filter-bar">
      <div className="filter-bar__group">
        <select
          className="filter-bar__select"
          value={filters.machine_id || ''}
          onChange={(e) => handleChange('machine_id', e.target.value)}
          aria-label="Filter by machine"
        >
          <option value="">All machines</option>
          <option value="ur5e-001">UR5e Demo Unit</option>
        </select>

        <select
          className="filter-bar__select"
          value={filters.severity || ''}
          onChange={(e) => handleChange('severity', e.target.value)}
          aria-label="Filter by severity"
        >
          <option value="">Any severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          className="filter-bar__select"
          value={filters.status || ''}
          onChange={(e) => handleChange('status', e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          className="filter-bar__select"
          value={filters.outcome || ''}
          onChange={(e) => handleChange('outcome', e.target.value)}
          aria-label="Filter by outcome"
        >
          <option value="">Any outcome</option>
          <option value="confirmed">Confirmed</option>
          <option value="corrected">Corrected</option>
        </select>
      </div>

      <div className="filter-bar__search-wrapper">
        <Search className="filter-bar__search-icon" strokeWidth={1.5} />
        <input
          className="filter-bar__search"
          type="text"
          placeholder="Search issues..."
          value={filters.q || ''}
          onChange={(e) => handleChange('q', e.target.value)}
          aria-label="Search issues"
        />
      </div>

      <div className="filter-bar__actions">
        <a
          className="filter-bar__export"
          href={getExportCsvUrl(filters)}
          download
          aria-label="Export filtered issues as CSV"
        >
          <Download size={14} strokeWidth={1.5} />
          Export CSV
        </a>
      </div>
    </div>
  );
}
