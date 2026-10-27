import { useEffect, useId, useRef, useState } from 'react'
import { money } from '../utils/format'
import { DonutChart } from './Charts'

const labelFor = (label, hourly) =>
  hourly ? `${label.padStart(2, '0')}:00` : label.slice(5)
export function RevenueChart({ points, hourly = false, line = false }) {
  const id = useId()
  const container = useRef(null)
  const [availableWidth, setAvailableWidth] = useState(320)
  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(([entry]) =>
      setAvailableWidth(entry.contentRect.width),
    )
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [points])
  if (!points?.some((p) => p.orders > 0))
    return (
      <p className="p-8 text-center text-muted">No sales in this period.</p>
    )
  const max = Math.max(...points.map((p) => Number(p.revenue)), 1)
  const width = Math.max(
    280,
    availableWidth,
    points.length > 31 ? points.length * 20 : 0,
  )
  const coordinates = points.map((p, i) => [
    40 + (i * (width - 60)) / Math.max(points.length - 1, 1),
    170 - (Number(p.revenue) / max) * 140,
  ])
  const labelSlots = Math.max(2, Math.min(8, Math.floor((width - 60) / 50)))
  const step = Math.max(1, Math.ceil((points.length - 1) / (labelSlots - 1)))
  return (
    <div
      ref={container}
      className="mx-4 overflow-x-auto"
      tabIndex={0}
      aria-label="Revenue chart, scroll for more dates"
    >
      <svg
        style={{ minWidth: width, width: '100%', height: 220 }}
        viewBox={`0 0 ${width} 220`}
        role="img"
        aria-label={`${hourly ? 'Hourly' : 'Daily'} sales revenue`}
      >
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#12b76a" stopOpacity=".25" />
            <stop offset="100%" stopColor="#12b76a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((ratio) => (
          <g key={ratio}>
            <line
              x1="35"
              x2={width}
              y1={170 - ratio * 140}
              y2={170 - ratio * 140}
              stroke="#edf1f4"
              strokeDasharray="3 4"
            />
            <text x="0" y={173 - ratio * 140} fill="#667085" fontSize="9">
              {new Intl.NumberFormat('en', {
                notation: 'compact',
                maximumFractionDigits: 1,
              }).format(max * ratio)}
            </text>
          </g>
        ))}
        {line && (
          <>
            <path
              d={`M ${coordinates[0][0]},170 L ${coordinates.map((p) => p.join(',')).join(' L ')} L ${coordinates.at(-1)[0]},170 Z`}
              fill={`url(#${id})`}
            />
            <polyline
              points={coordinates.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke="#079b52"
              strokeWidth="2.5"
            />
          </>
        )}
        {points.map((point, i) => {
          const [x, y] = coordinates[i]
          const title = `${labelFor(point.label, hourly)}: ${money(point.revenue)} · ${point.orders} transactions`
          return (
            <g key={point.label}>
              {line ? (
                <circle
                  cx={x}
                  cy={y}
                  r="3.5"
                  fill="white"
                  stroke="#079b52"
                  strokeWidth="2"
                >
                  <title>{title}</title>
                </circle>
              ) : (
                <rect
                  x={x - Math.min(18, (width - 60) / points.length / 2) / 2}
                  y={y}
                  width={Math.min(18, (width - 60) / points.length / 2)}
                  height={Math.max(170 - y, 0)}
                  rx="3"
                  fill="#12b76a"
                >
                  <title>{title}</title>
                </rect>
              )}
              {((i % step === 0 &&
                (i === 0 || points.length - 1 - i >= step)) ||
                i === points.length - 1) && (
                <text
                  x={x}
                  y="198"
                  textAnchor="middle"
                  fill="#667085"
                  fontSize="10"
                >
                  {labelFor(point.label, hourly)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <details className="text-xs text-muted">
        <summary>View chart data</summary>
        <table className="w-full">
          <caption>Revenue and transactions</caption>
          <thead>
            <tr>
              <th>Period</th>
              <th>Revenue</th>
              <th>Transactions</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label}>
                <td>{labelFor(p.label, hourly)}</td>
                <td>{money(p.revenue)}</td>
                <td>{p.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
export function PaymentChart({ payments, orders }) {
  if (!orders)
    return (
      <p className="p-8 text-center text-muted">No payments in this period.</p>
    )
  return (
    <>
      {payments.some((p) => Number(p.revenue) > 0) ? (
        <DonutChart
          segments={payments.map((p, i) => ({
            label: p.method === 'CASH' ? 'Cash' : 'Card',
            value: Number(p.revenue),
            color: ['#12b76a', '#34a7fa'][i],
          }))}
          value={orders}
          label="Transactions"
        />
      ) : (
        <p className="p-8 text-center text-muted">
          No revenue collected from these transactions.
        </p>
      )}
      <div className="mx-4 flex flex-wrap justify-between gap-3 text-xs text-muted">
        {payments.map((p) => (
          <span key={p.method}>
            {p.method === 'CASH' ? 'Cash' : 'Card'}: {money(p.revenue)} ·{' '}
            {p.orders} transactions
          </span>
        ))}
      </div>
    </>
  )
}
