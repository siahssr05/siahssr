// Dependency-free SVG charts for the admin analytics tab. No charting
// library needed — small enough to hand-roll, and avoids requiring an
// `npm install` the site owner would have to run before these render.

const NAVY = "#0B2545";
const GOLD = "#C99B3D";
const EMERALD = "#0E5C4A";
const PALETTE = [NAVY, GOLD, EMERALD, "#a33a3a", "#6c757d"];

export function BarChart({ data, labelKey, valueKey, height = 180, color = NAVY }) {
  if (!data || data.length === 0) return <p className="small text-muted">No data yet.</p>;
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  const barWidth = 100 / data.length;

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
        {data.map((d, i) => {
          const value = Number(d[valueKey]) || 0;
          const barHeight = (value / max) * (height - 20);
          return (
            <g key={i}>
              <rect
                x={i * barWidth + barWidth * 0.15}
                y={height - 20 - barHeight}
                width={barWidth * 0.7}
                height={barHeight}
                fill={color}
                rx="1"
              >
                <title>{`${d[labelKey]}: ${value}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="d-flex small text-muted mt-1" style={{ fontSize: "0.65rem" }}>
        {data.map((d, i) => (
          <div key={i} style={{ width: `${barWidth}%`, textAlign: "center" }}>
            {d[labelKey]}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data, labelKey, valueKey, height = 180, color = GOLD }) {
  if (!data || data.length === 0) return <p className="small text-muted">No data yet.</p>;
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  const step = data.length > 1 ? 100 / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * step : 50;
    const y = height - 20 - (Number(d[valueKey]) / max) * (height - 20);
    return `${x},${y}`;
  });

  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: "100%", height }}>
        <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          const [x, y] = points[i].split(",");
          return (
            <circle key={i} cx={x} cy={y} r="1.5" fill={color}>
              <title>{`${d[labelKey]}: ${d[valueKey]}`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="d-flex small text-muted mt-1" style={{ fontSize: "0.65rem" }}>
        {data.map((d, i) => (
          <div key={i} style={{ width: `${100 / data.length}%`, textAlign: "center" }}>
            {d[labelKey]}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data, labelKey, valueKey, size = 160 }) {
  if (!data || data.length === 0) return <p className="small text-muted">No data yet.</p>;
  const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="d-flex align-items-center gap-3 flex-wrap">
      <svg viewBox="0 0 100 100" style={{ width: size, height: size }}>
        <g transform="rotate(-90 50 50)">
          {data.map((d, i) => {
            const value = Number(d[valueKey]) || 0;
            const fraction = value / total;
            const dash = fraction * circumference;
            const circle = (
              <circle
                key={i}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth="14"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${d[labelKey]}: ${value}`}</title>
              </circle>
            );
            offset += dash;
            return circle;
          })}
        </g>
      </svg>
      <div className="small">
        {data.map((d, i) => (
          <div key={i} className="d-flex align-items-center gap-2 mb-1">
            <span style={{ width: 10, height: 10, background: PALETTE[i % PALETTE.length], display: "inline-block", borderRadius: 2 }} />
            <span>{d[labelKey]}: {d[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
