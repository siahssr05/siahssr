// Dependency-free SVG charts for the admin Analytics tab — vanilla-JS port of
// components/charts/MiniCharts.jsx. Each function returns an HTML string;
// the caller sets it via container.innerHTML = renderXChart(...).

const CHART_NAVY = "#0B2545";
const CHART_GOLD = "#C99B3D";
const CHART_EMERALD = "#0E5C4A";
const CHART_PALETTE = [CHART_NAVY, CHART_GOLD, CHART_EMERALD, "#a33a3a", "#6c757d"];

function renderBarChart(data, labelKey, valueKey, { height = 180, color = CHART_NAVY } = {}) {
  if (!data || data.length === 0) return `<p class="small text-muted">No data yet.</p>`;
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  const barWidth = 100 / data.length;

  const bars = data
    .map((d, i) => {
      const value = Number(d[valueKey]) || 0;
      const barHeight = (value / max) * (height - 20);
      return `<rect x="${i * barWidth + barWidth * 0.15}" y="${height - 20 - barHeight}" width="${barWidth * 0.7}" height="${barHeight}" fill="${color}" rx="1"><title>${esc(d[labelKey])}: ${value}</title></rect>`;
    })
    .join("");

  const labels = data
    .map((d) => `<div style="width:${barWidth}%;text-align:center;">${esc(d[labelKey])}</div>`)
    .join("");

  return `
    <svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" style="width:100%;height:${height}px;">${bars}</svg>
    <div class="d-flex small text-muted mt-1" style="font-size:0.65rem;">${labels}</div>`;
}

function renderLineChart(data, labelKey, valueKey, { height = 180, color = CHART_GOLD } = {}) {
  if (!data || data.length === 0) return `<p class="small text-muted">No data yet.</p>`;
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  const step = data.length > 1 ? 100 / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * step : 50;
    const y = height - 20 - (Number(d[valueKey]) / max) * (height - 20);
    return [x, y];
  });

  const polyline = points.map((p) => p.join(",")).join(" ");
  const circles = points
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="1.5" fill="${color}"><title>${esc(data[i][labelKey])}: ${data[i][valueKey]}</title></circle>`)
    .join("");
  const labels = data
    .map((d) => `<div style="width:${100 / data.length}%;text-align:center;">${esc(d[labelKey])}</div>`)
    .join("");

  return `
    <svg viewBox="0 0 100 ${height}" preserveAspectRatio="none" style="width:100%;height:${height}px;">
      <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke" />
      ${circles}
    </svg>
    <div class="d-flex small text-muted mt-1" style="font-size:0.65rem;">${labels}</div>`;
}

function renderDonutChart(data, labelKey, valueKey, { size = 160 } = {}) {
  if (!data || data.length === 0) return `<p class="small text-muted">No data yet.</p>`;
  const total = data.reduce((sum, d) => sum + (Number(d[valueKey]) || 0), 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const arcs = data
    .map((d, i) => {
      const value = Number(d[valueKey]) || 0;
      const fraction = value / total;
      const dash = fraction * circumference;
      const arc = `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${CHART_PALETTE[i % CHART_PALETTE.length]}" stroke-width="14" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}"><title>${esc(d[labelKey])}: ${value}</title></circle>`;
      offset += dash;
      return arc;
    })
    .join("");

  const legend = data
    .map(
      (d, i) =>
        `<div class="d-flex align-items-center gap-2 mb-1"><span style="width:10px;height:10px;background:${CHART_PALETTE[i % CHART_PALETTE.length]};display:inline-block;border-radius:2px;"></span><span>${esc(d[labelKey])}: ${esc(d[valueKey])}</span></div>`
    )
    .join("");

  return `
    <div class="d-flex align-items-center gap-3 flex-wrap">
      <svg viewBox="0 0 100 100" style="width:${size}px;height:${size}px;">
        <g transform="rotate(-90 50 50)">${arcs}</g>
      </svg>
      <div class="small">${legend}</div>
    </div>`;
}
