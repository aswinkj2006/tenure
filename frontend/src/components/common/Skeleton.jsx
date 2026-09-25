import './Skeleton.css';

export default function Skeleton({ 
  variant = 'text', 
  width, 
  height, 
  className = '',
  count = 1 
}) {
  const style = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  if (count > 1) {
    return (
      <div className={className}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`skeleton skeleton--${variant}`} style={style} />
        ))}
      </div>
    );
  }

  return <div className={`skeleton skeleton--${variant} ${className}`} style={style} />;
}
