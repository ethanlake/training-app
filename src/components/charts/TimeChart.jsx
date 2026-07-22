// Time series with points placed by actual date, so gaps in training read as
// gaps. Several series can be overlaid.
//
// Drawn in measured pixel coordinates rather than a stretched viewBox: markers
// have to stay round and a constant size whatever the container width, which a
// preserveAspectRatio="none" viewBox cannot do.
//
// Scaling: when every series shares a unit the chart uses one shared axis and
// the numbers can be read off directly. Mixing units (pounds against V grades)
// has no honest shared axis, so each series is then scaled to its own range and
// the legend carries the numbers — the shapes stay comparable, and the axis is
// dropped rather than invented.

import { useEffect, useRef, useState } from 'react'
import { Empty } from './BarChart.jsx'

const MX = 5 // room for a marker at either end
const MY = 7

// Four combinations that stay inside the app's one-accent palette.
const STYLES = [
  { className: 'text-(--color-accent)', dash: undefined },
  { className: 'text-zinc-400 dark:text-zinc-500', dash: undefined },
  { className: 'text-(--color-accent)', dash: '5 4' },
  { className: 'text-zinc-400 dark:text-zinc-500', dash: '5 4' },
]

export const seriesStyle = (i) => STYLES[i % STYLES.length]

// A fixed-size swatch, so the dash pattern reads the same here as on the chart.
export function SeriesSwatch({ index }) {
  const { className, dash } = seriesStyle(index)
  return (
    <svg width="20" height="2" className={`shrink-0 ${className}`} aria-hidden="true">
      <line x1="0" y1="1" x2="20" y2="1" stroke="currentColor" strokeWidth="2" strokeDasharray={dash} />
    </svg>
  )
}

const toTime = (date) => new Date(`${date}T00:00:00`).getTime()

const fmtDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

function domainOf(points) {
  const values = points.map((p) => p.value)
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return { lo, hi, span: hi - lo || 1 }
}

export default function TimeChart({ series, height = 170, format = (v) => String(v) }) {
  const box = useRef(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const el = box.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const drawn = series.filter((s) => s.points.length > 0)
  if (!drawn.length) return <Empty>Nothing logged in this window</Empty>

  const all = drawn.flatMap((s) => s.points)
  const times = all.map((p) => toTime(p.date))
  const t0 = Math.min(...times)
  const t1 = Math.max(...times)
  const tSpan = t1 - t0

  const shared = new Set(drawn.map((s) => s.unit)).size === 1
  const sharedDomain = shared ? domainOf(all) : null

  const innerW = Math.max(0, width - 2 * MX)
  const innerH = height - 2 * MY
  // A single day has no span to spread across; centre it.
  const x = (date) => (tSpan === 0 ? width / 2 : MX + ((toTime(date) - t0) / tSpan) * innerW)
  const y = (value, d) => MY + innerH - ((value - d.lo) / d.span) * innerH

  return (
    <div>
      <div className="flex">
        <div ref={box} className="min-w-0 flex-1" style={{ height }}>
          {width > 0 && (
            <svg width={width} height={height} className="block">
              {drawn.map((s, i) => {
                const d = sharedDomain ?? domainOf(s.points)
                const style = seriesStyle(i)
                const pts = s.points.map((p) => [x(p.date), y(p.value, d)])
                return (
                  <g key={s.key} className={style.className}>
                    {pts.length > 1 && (
                      <polyline
                        points={pts.map(([px, py]) => `${px},${py}`).join(' ')}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={style.dash}
                      />
                    )}
                    {pts.map(([px, py], j) => (
                      <circle key={j} cx={px} cy={py} r="2.5" fill="currentColor" />
                    ))}
                  </g>
                )
              })}
            </svg>
          )}
        </div>

        {/* only meaningful when one scale governs the whole plot */}
        {sharedDomain && (
          <div
            className="ml-2 flex w-11 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-zinc-400"
            style={{ paddingTop: MY - 6, paddingBottom: MY - 6 }}
          >
            <span>{format(sharedDomain.hi)}</span>
            <span>{format(sharedDomain.lo)}</span>
          </div>
        )}
      </div>

      <div
        className={`mt-1.5 flex justify-between border-t border-zinc-200 pt-1.5 text-[10px] text-zinc-500 dark:border-zinc-800 ${
          sharedDomain ? 'pr-13' : ''
        }`}
      >
        <span>{fmtDate(all.reduce((a, b) => (toTime(a.date) < toTime(b.date) ? a : b)).date)}</span>
        <span>{fmtDate(all.reduce((a, b) => (toTime(a.date) > toTime(b.date) ? a : b)).date)}</span>
      </div>

      {/* without this the missing axis looks like an omission rather than a refusal */}
      {!sharedDomain && (
        <p className="mt-2 text-[11px] text-zinc-400">
          Mixed units — each line is scaled to its own range.
        </p>
      )}

      <ul className="mt-3 flex flex-col gap-1.5">
        {drawn.map((s, i) => {
          const d = domainOf(s.points)
          const fmt = s.format ?? ((v) => String(v))
          return (
            <li key={s.key} className="flex items-center gap-2 text-[11px] text-zinc-500">
              <SeriesSwatch index={i} />
              <span className="truncate">{s.label}</span>
              <span className="ml-auto shrink-0 tabular-nums">
                {fmt(d.lo)} → {fmt(d.hi)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
