import './StatusDot.css';

export default function StatusDot({ status = 'ok', size = 'default', pulse = false, className = '' }) {
  const classes = [
    'status-dot',
    `status-dot--${status}`,
    size === 'lg' && 'status-dot--lg',
    pulse && 'status-dot--pulse',
    className,
  ].filter(Boolean).join(' ');

  return <span className={classes} />;
}
