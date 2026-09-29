import './kitControls.css';

export default function KitProgress({ value, max = 100, label, className = '', style, children }) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return <div className={`kit-progress ${className}`} style={style} role="progressbar"
    aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.max(0, Math.min(max, value))}>
    <div className="kit-progress-track">
      <div className="kit-progress-clip" style={{ width: `${fraction * 100}%` }}>
        <div className="kit-progress-fill" />
      </div>
    </div>
    {children && <span className="kit-progress-label">{children}</span>}
  </div>;
}
