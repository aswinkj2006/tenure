import './EmptyState.css';

/* Inline SVG gear illustration — fine line art in terracotta */
function GearIllustration() {
  return (
    <svg
      className="empty-state__illustration"
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer gear */}
      <path d="M48 16 L50 8 L54 8 L56 16 A32 32 0 0 1 64 19 L70 13 L74 16 L70 24 A32 32 0 0 1 76 32 L84 30 L86 34 L78 38 A32 32 0 0 1 80 48 L88 48 L88 52 L80 52 A32 32 0 0 1 78 58 L86 62 L84 66 L76 64 A32 32 0 0 1 70 72 L74 80 L70 83 L64 77 A32 32 0 0 1 56 80 L54 88 L50 88 L48 80" />
      <path d="M48 80 L46 88 L42 88 L40 80 A32 32 0 0 1 32 77 L26 83 L22 80 L26 72 A32 32 0 0 1 20 64 L12 66 L10 62 L18 58 A32 32 0 0 1 16 52 L8 52 L8 48 L16 48 A32 32 0 0 1 18 38 L10 34 L12 30 L20 32 A32 32 0 0 1 26 24 L22 16 L26 13 L32 19 A32 32 0 0 1 40 16 L42 8 L46 8 L48 16" />
      {/* Inner circle */}
      <circle cx="48" cy="48" r="14" />
      {/* Center dot */}
      <circle cx="48" cy="48" r="4" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

export default function EmptyState({ title, message, children }) {
  return (
    <div className="empty-state">
      <GearIllustration />
      {title && <div className="empty-state__title">{title}</div>}
      {message && <p className="empty-state__message">{message}</p>}
      {children}
    </div>
  );
}
