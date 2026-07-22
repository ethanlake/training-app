import { useMemo, useState } from 'react'
import {
  WINDOWS,
  boulderGradeTrend,
  boulderHistogram,
  exercises as exercisesIn,
  oneRmTrend,
  sessionsPerWeek,
  sportHistogram,
  summary,
  tagFrequency,
  windowSessions,
} from '../lib/stats.js'
import { formatBoulder } from '../lib/grades.js'
import { isBarbell } from '../lib/exercises.js'
import BarChart, { Empty } from './charts/BarChart.jsx'
import LineChart from './charts/LineChart.jsx'
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
        title="Estimated 1RM"
        action={
          liftNames.length > 1 && (
            <select
              value={activeExercise}
              onChange={(e) => setExercise(e.target.value)}
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
        {activeExercise ? (
          <>
            {/* 1RM is a derived total, never per-side — say so, or a barbell
                number here reads as plates on one end. */}
            <p className="mb-2 text-sm text-zinc-500">
              {activeExercise}
              {isBarbell(activeExercise) && ' · total on the bar'}
            </p>
            <OneRm sessions={sessions} exercise={activeExercise} />
          </>
        ) : (
          <Empty />
        )}
      </Section>

      <Section title="Tags">
        <TagBars data={tagFrequency(sessions)} />
      </Section>
    </div>
  )
}

function OneRm({ sessions, exercise }) {
  const trend = oneRmTrend(sessions, exercise)
  if (trend.length < 2) return <Empty>Needs two weeks of data</Empty>
  return <LineChart data={trend} series={[{ key: 'value', label: 'est. 1RM' }]} format={(v) => `${v}`} />
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
