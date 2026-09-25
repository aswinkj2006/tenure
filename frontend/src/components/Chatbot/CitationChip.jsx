import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function CitationChip({ citation }) {
  const [expanded, setExpanded] = useState(false);

  if (!citation) return null;

  return (
    <div>
      <button
        className="citation-chip"
        onClick={() => setExpanded(!expanded)}
        aria-label={`Citation from ${citation.source_ref}`}
      >
        <FileText className="citation-chip__icon" strokeWidth={1.5} />
        <span>{citation.source_ref?.replace('.pdf', '') || 'Source'}</span>
        {citation.page && <span className="citation-chip__page">p.{citation.page}</span>}
        {expanded
          ? <ChevronUp size={10} strokeWidth={1.5} />
          : <ChevronDown size={10} strokeWidth={1.5} />
        }
      </button>

      {expanded && (
        <div className="citation-expanded">
          <div className="citation-expanded__source">
            {citation.source_ref} {citation.page ? `· Page ${citation.page}` : ''}
            {citation.relevance_score ? ` · ${Math.round(citation.relevance_score * 100)}% match` : ''}
          </div>
          {citation.chunk_text}
        </div>
      )}
    </div>
  );
}
