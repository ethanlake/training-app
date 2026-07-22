// Hand-rolled SVG line chart. The viewBox is stretched to the container
// (preserveAspectRatio="none"), so strokes use non-scaling-stroke to stay even.

import { Empty } from './BarChart.jsx'

const W = 100
const H = 40

export default function LineChart({ data, series, height = 140, format = (v) => v }) {
  const points = data ?? []
  if (points.length === 0) return <Empty />

  const values = series.flatMap((s) => points.map((p) => p[s.key]).filter((v) => v != null))
  if (!values.length) return <Empty />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pad = span * 0.15

  const x = (i) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W)
  const y = (v) => H - ((v - min + pad) / (span + 2 * pad)) * H

  return (
    <div>
      <div className="flex" style={{ height }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full min-w-0 flex-1 overflow-visible"
        >
          {series.map((s, si) => {
            const pts = points
              .map((p, i) => (p[s.key] == null ? null : [x(i), y(p[s.key])]))
              .filter(Boolean)
            if (!pts.length) return null
            return (
              <g key={s.key}>
                <polyline
                  points={pts.map(([px, py]) => `${px},${py}`).join(' ')}
                  fill="none"
                  stroke={si === 0 ? 'var(--color-accent)' : 'currentColor'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  className={si === 0 ? '' : 'text-zinc-400 dark:text-zinc-600'}
                  strokeDasharray={si === 0 ? undefined : '3 3'}
                />
                {pts.map(([px, py], i) => (
                  <circle
                    key={i}
                    cx={px}
                    cy={py}
                    r="2"
                    fill={si === 0 ? 'var(--color-accent)' : 'currentColor'}
                    vectorEffect="non-scaling-stroke"
                    className={si === 0 ? '' : 'text-zinc-400 dark:text-zinc-600'}
                  />
                ))}
              </g>
            )
          })}
        </svg>
        {/* own gutter rather than an overlay, so labels never sit on the data */}
        <div className="ml-2 flex w-9 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-zinc-400">
          <span>{format(max)}</span>
          <span>{format(min)}</span>
        </div>
      </div>

      <div className="mt-1.5 flex border-t border-zinc-200 pt-1.5 pr-11 dark:border-zinc-800">
        {points.map((p, i) => (
          <div
            key={i}
            className="flex-1 overflow-hidden text-center text-[10px] whitespace-nowrap text-zinc-500"
          >
            {i === 0 || i === points.length - 1 || points.length <= 6 ? p.label : ''}
          </div>
        ))}
      </div>

      {series.length > 1 && (
        <div className="mt-2 flex gap-4 text-[11px] text-zinc-500">
          {series.map((s, si) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span
                className={`h-0.5 w-4 ${si === 0 ? 'bg-(--color-accent)' : 'bg-zinc-400 dark:bg-zinc-600'}`}
              />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
