export function BarChart({
  values,
  labels = ['8 AM', '10 AM', '12 PM', '2 PM', '4 PM', '6 PM', '8 PM'],
}) {
  const max = Math.max(...values, 1)
  return (
    <div
      className="bar-chart"
      role="img"
      aria-label={`Illustrative hourly sales: ${values.join(', ')}`}
    >
      <div className="chart-y">
        <span>{max}</span>
        <span>{Math.round(max * 0.75)}</span>
        <span>{Math.round(max * 0.5)}</span>
        <span>{Math.round(max * 0.25)}</span>
        <span>0</span>
      </div>
      <div className="chart-plot">
        <div className="chart-grid-lines">
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="bars">
          {values.map((value, i) => (
            <div
              key={i}
              style={{
                height: `${(value / max) * 94}%`,
                opacity: i > values.length - 4 ? 0.4 : 1,
              }}
              title={`${value} sales`}
            />
          ))}
        </div>
        <div className="chart-x">
          {labels.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
export function LineChart({
  values,
  labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
}) {
  const max = Math.max(...values, 1)
  const points = values.map(
    (value, i) =>
      `${10 + (i * 280) / (values.length - 1)},${145 - (value / max) * 120}`,
  )
  return (
    <div className="line-chart">
      <svg
        viewBox="0 0 300 170"
        role="img"
        aria-label={`Illustrative weekly revenue: ${values.join(', ')}`}
      >
        <defs>
          <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#12b76a" stopOpacity=".25" />
            <stop offset="100%" stopColor="#12b76a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[25, 65, 105, 145].map((y) => (
          <line
            key={y}
            x1="0"
            x2="300"
            y1={y}
            y2={y}
            stroke="#edf1f4"
            strokeDasharray="3 4"
          />
        ))}
        <path
          d={`M 10,155 L ${points.join(' L ')} L 290,155 Z`}
          fill="url(#revenue-fill)"
        />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="#079b52"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {points.map((point, i) => {
          const [cx, cy] = point.split(',')
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="3.5"
              fill="#fff"
              stroke="#079b52"
              strokeWidth="2"
            />
          )
        })}
      </svg>
      <div className="chart-x">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}
export function DonutChart({ segments, value, label }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1
  let cursor = 0
  const gradient = segments
    .map((segment) => {
      const start = cursor
      cursor += (segment.value / total) * 100
      return `${segment.color} ${start}% ${cursor}%`
    })
    .join(', ')
  return (
    <div className="donut-layout">
      <div
        className="donut"
        style={{ background: `conic-gradient(${gradient})` }}
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(', ')}
      >
        <div>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      </div>
      <div className="chart-legend">
        {segments.map((segment) => (
          <div key={segment.label}>
            <i style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <strong>{Math.round((segment.value / total) * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  )
}
