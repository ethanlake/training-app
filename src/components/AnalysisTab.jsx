import { useMemo, useState } from 'react'
import {
  WINDOWS,
  boulderGradeTrend,
  boulderHistogram,
  bodyweightSeries,
  exercises as exercisesIn,
  liftSeries,
  maxBoulderSeries,
  prsByReps,
  repOptions,
  sessionsPerWeek,
  sportHistogram,
  summary,
  tagFrequency,
  windowSessions,
} from '../lib/stats.js'
import { formatBoulder } from '../lib/grades.js'
import { formatWeight } from '../lib/exercises.js'
import { listChoices } from '../lib/choices.js'
import { formatDay } from './SessionLog.jsx'
import BarChart, { Empty } from './charts/BarChart.jsx'
import LineChart from './charts/LineChart.jsx'
import TimeChart, { SeriesSwatch } from './charts/TimeChart.jsx'
import { Section } from './ui.jsx'

export default function AnalysisTab({ data }) {
  const [windowKey, setWindowKey] = useState('month')
  const sessions = useMemo(() => windowSessions(data.sessions, windowKey), [data.sessions, windowKey])

  const stats = useMemo(() => summary(sessions), [sessions])
  const liftNames = useMemo(() => exercisesIn(sessions), [sessions])
  const [exercise, setExercise] = useState(null)
  const activeExercise = liftNames.includes(exercise) ? exercise : liftNames[0]

  const gradeTrend = useMemo(() => boulderGradeTrend(sessions), [sessions])

  return (
    <div>
      <div className="mb-6 grid grid-cols-4 gap-1">
        {WINDOWS.map((w) => (
          <button
            key={w.key}
            onClick={() => setWindowKey(w.key)}
            className={`min-h-11 rounded-lg text-sm transition-colors ${
              w.key === windowKey
                ? 'bg-zinc-900 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'border border-zinc-200 text-zinc-500 dark:border-zinc-800'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      <Section>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          <Stat label="Boulders" value={stats.boulders} />
          <Stat label="Hardest" value={stats.hardestBoulder ?? '—'} />
          <Stat label="Sessions" value={stats.sessions} />
          <Stat label="Week streak" value={stats.streak} />
          <Stat label="Routes" value={stats.routes} />
          <Stat label="Hardest route" value={stats.hardestRoute ?? '—'} />
          <Stat label="Sets" value={stats.sets} />
          <Stat label="Volume (lb)" value={stats.volume.toLocaleString()} />
        </dl>
      </Section>

      <Section title="Boulder grades">
        {stats.boulders > 0 ? <BarChart data={boulderHistogram(sessions)} /> : <Empty />}
      </Section>

      <Section title="Sport grades">
        <BarChart data={sportHistogram(sessions)} />
      </Section>

      <Section title="Sessions per week">
        <BarChart data={sessionsPerWeek(sessions)} />
      </Section>

      <Section title="Boulder grade by month">
        {gradeTrend.length > 1 ? (
          <LineChart
            data={gradeTrend}
            series={[
              { key: 'max', label: 'max' },
              { key: 'median', label: 'median' },
            ]}
            format={(v) => formatBoulder(v)}
          />
        ) : (
          <Empty>Needs two months of climbing</Empty>
        )}
      </Section>

      <Section
        title="PRs"
        action={
          liftNames.length > 0 && (
            <select
              value={activeExercise}
              onChange={(e) => setExercise(e.target.value)}
              aria-label="PR exercise"
              className="min-h-9 rounded-lg border border-zinc-200 bg-transparent px-2 text-sm dark:border-zinc-800"
            >
              {liftNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )
        }
      >
        {activeExercise ? <Prs sessions={sessions} exercise={activeExercise} /> : <Empty />}
      </Section>

      <Section title="Tags">
        <TagBars data={tagFrequency(sessions)} />
      </Section>

      <Trends data={data} sessions={sessions} />
    </div>
  )
}

let nextTrendId = 1

// Everything plottable against time. Exercises come from the configured list
// rather than from the data, so the menu does not change shape as the window
// moves.
function trendOptions(data) {
  return [
    { value: 'bodyweight', label: 'bodyweight' },
    { value: 'maxV', label: 'max V grade' },
    ...listChoices(data, 'exercise').map((n) => ({ value: `lift:${n}`, label: n })),
  ]
}

const exerciseOf = (metric) => (metric.startsWith('lift:') ? metric.slice(5) : null)

function Trends({ data, sessions }) {
  const options = trendOptions(data)
  const [rows, setRows] = useState(() => [{ id: nextTrendId++, metric: 'bodyweight', reps: null }])

  const repsFor = (exercise) => repOptions(data.sessions, exercise)

  const patch = (id, next) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...next } : r)))

  const changeMetric = (id, metric) => {
    const exercise = exerciseOf(metric)
    // Landing on a lift needs a rep count; take the one most often logged.
    patch(id, { metric, reps: exercise ? (repsFor(exercise)[0] ?? null) : null })
  }

  const add = () =>
    setRows((rs) => [...rs, { id: nextTrendId++, metric: rs.length ? 'maxV' : 'bodyweight', reps: null }])

  const series = rows.map((r, i) => {
    const exercise = exerciseOf(r.metric)
    if (exercise) {
      return {
        key: String(r.id),
        label: `${exercise} · ${r.reps ?? '—'} reps`,
        unit: 'lb',
        points: r.reps == null ? [] : liftSeries(sessions, exercise, r.reps),
      }
    }
    if (r.metric === 'maxV') {
      return {
        key: String(r.id),
        label: 'max V grade',
        unit: 'V',
        points: maxBoulderSeries(sessions),
        format: formatBoulder,
      }
    }
    return { key: String(r.id), label: 'bodyweight', unit: 'lb', points: bodyweightSeries(sessions) }
  })

  const shared = new Set(series.map((s) => s.unit)).size === 1
  const axisFormat = shared && series[0]?.unit === 'V' ? (v) => formatBoulder(Math.round(v)) : Math.round

  return (
    <Section title="Trends">
      <div className="mb-4 flex flex-col gap-2">
        {rows.map((r, i) => {
          const exercise = exerciseOf(r.metric)
          const reps = exercise ? repsFor(exercise) : []
          return (
            <div key={r.id} className="flex items-center gap-2">
              <SeriesSwatch index={i} />

              <select
                value={r.metric}
                onChange={(e) => changeMetric(r.id, e.target.value)}
                aria-label={`Trend ${i + 1}`}
                className="min-h-11 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-transparent px-2 text-sm dark:border-zinc-800"
              >
                {options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>

              {exercise &&
                (reps.length ? (
                  <select
                    value={r.reps ?? ''}
                    onChange={(e) => patch(r.id, { reps: Number(e.target.value) })}
                    aria-label={`Trend ${i + 1} reps`}
                    className="min-h-11 shrink-0 rounded-lg border border-zinc-200 bg-transparent px-2 text-sm dark:border-zinc-800"
                  >
                    {reps.map((n) => (
                      <option key={n} value={n}>
                        {n} reps
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="shrink-0 text-xs text-zinc-400">never logged</span>
                ))}

              {rows.length > 1 && (
                <button
                  onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                  aria-label={`Remove trend ${i + 1}`}
                  className="min-h-11 shrink-0 px-2 text-zinc-400"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}

        <button onClick={add} className="btn-quiet self-start" aria-label="Add trend">
          + Add
        </button>
      </div>

      <TimeChart series={series} format={axisFormat} />
    </Section>
  )
}

// The heaviest set at each rep count logged in the window, with the day it was
// set. Barbell weights read per-side with the total alongside, as everywhere else.
function Prs({ sessions, exercise }) {
  const prs = prsByReps(sessions, exercise)
  if (!prs.length) return <Empty>Nothing logged in this window</Empty>
  return (
    <ul className="flex flex-col">
      {prs.map((p) => (
        <li
          key={p.reps}
          className="flex items-baseline gap-3 border-b border-zinc-100 py-2.5 last:border-0 dark:border-zinc-900"
        >
          <span className="w-16 shrink-0 text-sm text-zinc-500 tabular-nums">
            {p.reps} {p.reps === 1 ? 'rep' : 'reps'}
          </span>
          <span className="flex-1 font-medium tabular-nums">
            {formatWeight(exercise, p.weight)}
          </span>
          <span className="shrink-0 text-sm text-zinc-500 tabular-nums">{formatDay(p.date)}</span>
        </li>
      ))}
    </ul>
  )
}

// A horizontal ranked list reads better than bars for a long tail of tags.
function TagBars({ data }) {
  if (!data.length) return <Empty />
  const max = data[0].value
  return (
    <ul className="flex flex-col gap-2">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-sm text-zinc-600 dark:text-zinc-400">
            {d.label}
          </span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
            <span
              className="block h-full rounded-full bg-(--color-accent)"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </span>
          <span className="w-6 shrink-0 text-right text-sm tabular-nums text-zinc-500">
            {d.value}
          </span>
        </li>
      ))}
    </ul>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  )
}
