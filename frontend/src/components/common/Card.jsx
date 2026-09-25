import './Card.css';

export default function Card({ 
  children, 
  className = '', 
  hoverable = false, 
  clickable = false,
  compact = false,
  flush = false,
  onClick,
  ...props 
}) {
  const classes = [
    'card',
    hoverable && 'card--hoverable',
    clickable && 'card--clickable',
    compact && 'card--compact',
    flush && 'card--flush',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, title, subtitle, action }) {
  return (
    <div className="card__header">
      <div>
        {title && <div className="card__title">{title}</div>}
        {subtitle && <div className="card__subtitle">{subtitle}</div>}
        {children}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
