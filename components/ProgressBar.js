export default function ProgressBar({ value = 0, max = 0 }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const full = max > 0 && value >= max;
  return (
    <div className="progress-track" aria-hidden>
      <div
        className={`progress-fill ${full ? "progress-fill-full" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
