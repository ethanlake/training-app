// Hand-rolled SVG bars. Fixed viewBox scaled to the container width; labels are
// real DOM text below the SVG so they stay legible at any size.

export default function BarChart({ data, height = 120, showValues = true }) {
  if (!data?.length) return <Empty />
  const max = Math.max(...data.map((d) => d.value), 1)
  const n = data.length
  const gap = n > 24 ? 1 : 2
  // Cap the width so a two-bar chart doesn't turn into two giant slabs.
  const col = { flex: '1 1 0', maxWidth: 64, padding: `0 ${gap}px` }

  return (
    <div>
      <div className="flex items-end justify-center" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex h-full flex-col justify-end" style={col}>
            {showValues && d.value > 0 && (
              <div className="mb-1 text-center text-[10px] tabular-nums text-zinc-400">{d.value}</div>
            )}
            <div
              className="w-full rounded-t-sm bg-(--color-accent)"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-center border-t border-zinc-200 pt-1.5 dark:border-zinc-800">
        {data.map((d, i) => (
          <div
            key={i}
            className="overflow-hidden text-center text-[10px] whitespace-nowrap text-zinc-500"
            style={col}
          >
            {labelFor(d.label, i, n)}
          </div>
        ))}
      </div>
    </div>
  )
}

// Thin out labels when bars get dense, keeping the first and last.
function labelFor(label, i, n) {
  const stride = n <= 12 ? 1 : Math.ceil(n / 8)
  if (i === 0 || i === n - 1 || i % stride === 0) return label
  return ''
}

export function Empty({ children = 'No data yet' }) {
  return (
    <div className="flex h-24 items-center justify-center text-sm text-zinc-400 dark:text-zinc-600">
      {children}
    </div>
  )
}
