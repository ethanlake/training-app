// Pure aggregations over sessions. Every entry point takes an already-windowed
// session list except windowSessions() itself.

import {
  BOULDER_GRADES,
  SPORT_GRADES,
  formatBoulder,
  formatSport,
  medianBy,
  sportOrdinal,
} from './grades.js'

export const WINDOWS = [
  { key: 'week', label: 'Week', days: 7 },
  { key: 'month', label: 'Month', days: 30 },
  { key: 'year', label: 'Year', days: 365 },
  { key: 'all', label: 'All', days: null },
]

// 'YYYY-MM-DD' -> local Date at midnight (never UTC, which shifts the day back).
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function windowSessions(sessions, windowKey, now = new Date()) {
  const spec = WINDOWS.find((w) => w.key === windowKey)
  if (!spec || spec.days == null) return [...sessions].sort(byDate)
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  cutoff.setDate(cutoff.getDate() - (spec.days - 1))
  return sessions.filter((s) => parseDate(s.date) >= cutoff).sort(byDate)
}

const byDate = (a, b) => a.date.localeCompare(b.date)

// --- flatteners ------------------------------------------------------------

export const allBoulders = (sessions) =>
  sessions.filter((s) => s.type === 'climb').flatMap((s) => (s.boulders ?? []).map((b) => ({ ...b, date: s.date })))

export const allRoutes = (sessions) =>
  sessions.filter((s) => s.type === 'climb').flatMap((s) => (s.routes ?? []).map((r) => ({ ...r, date: s.date })))

export const allSets = (sessions) =>
  sessions.filter((s) => s.type === 'lift').flatMap((s) => (s.sets ?? []).map((x) => ({ ...x, date: s.date })))

// --- histograms ------------------------------------------------------------

export function boulderHistogram(sessions) {
  const boulders = allBoulders(sessions)
  const counts = new Map(BOULDER_GRADES.map((g) => [g, 0]))
  for (const b of boulders) if (counts.has(b.grade)) counts.set(b.grade, counts.get(b.grade) + 1)
  return BOULDER_GRADES.map((g) => ({ label: formatBoulder(g), value: counts.get(g) }))
}

export function sportHistogram(sessions) {
  const routes = allRoutes(sessions)
  const counts = new Map(SPORT_GRADES.map((g) => [g, 0]))
  for (const r of routes) if (counts.has(r.grade)) counts.set(r.grade, counts.get(r.grade) + 1)
  // Trim leading/trailing empty grades so the axis shows only the range climbed.
  const used = SPORT_GRADES.map((g) => counts.get(g))
  const first = used.findIndex((v) => v > 0)
  if (first === -1) return []
  const last = used.length - 1 - [...used].reverse().findIndex((v) => v > 0)
  return SPORT_GRADES.slice(first, last + 1).map((g) => ({
    label: formatSport(g),
    value: counts.get(g),
  }))
}

export function tagFrequency(sessions) {
  const counts = new Map()
  for (const b of allBoulders(sessions)) {
    for (const t of b.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))
}

// --- time series -----------------------------------------------------------

// Monday-anchored week key, so the label is stable regardless of when it runs.
export function weekStart(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const shift = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - shift)
  return d
}

const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const shortDate = (d) => `${d.getMonth() + 1}/${d.getDate()}`

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

const monthLabel = (key) => {
  const [y, m] = key.split('-')
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m - 1]} ${y.slice(2)}`
}

// Sessions per week, with empty weeks filled in so gaps read as gaps.
export function sessionsPerWeek(sessions, now = new Date()) {
  if (!sessions.length) return []
  const counts = new Map()
  for (const s of sessions) {
    const k = isoDay(weekStart(parseDate(s.date)))
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const start = weekStart(parseDate(sessions[0].date))
  const end = weekStart(now)
  const out = []
  for (let d = start; d <= end; d.setDate(d.getDate() + 7)) {
    out.push({ label: shortDate(d), value: counts.get(isoDay(d)) ?? 0 })
  }
  return out
}

// Max and median boulder grade per month. Months with no boulders are omitted.
export function boulderGradeTrend(sessions) {
  const byMonth = new Map()
  for (const b of allBoulders(sessions)) {
    const k = monthKey(parseDate(b.date))
    if (!byMonth.has(k)) byMonth.set(k, [])
    byMonth.get(k).push(b.grade)
  }
  return [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, grades]) => ({
      label: monthLabel(k),
      max: Math.max(...grades),
      median: medianBy(grades),
    }))
}

export function exercises(sessions) {
  return [...new Set(allSets(sessions).map((s) => s.exercise))].sort()
}

// Heaviest set at each rep count actually logged for this exercise in the
// window — no fixed rep brackets, since which ones get trained is the user's
// business. Ties go to the earliest date: a PR is set the first time it is
// hit, not the last time it is repeated.
export function prsByReps(sessions, exercise) {
  const best = new Map()
  for (const s of allSets(sessions)) {
    if (s.exercise !== exercise) continue
    const cur = best.get(s.reps)
    if (!cur || s.weight > cur.weight || (s.weight === cur.weight && s.date < cur.date)) {
      best.set(s.reps, { weight: s.weight, date: s.date })
    }
  }
  return [...best.entries()]
    .map(([reps, v]) => ({ reps, ...v }))
    .sort((a, b) => a.reps - b.reps)
}

// --- summary ---------------------------------------------------------------

// Consecutive weeks, counting back from this one, with at least one session.
// A training streak is a weekly rhythm; a daily one would break on rest days.
export function weekStreak(sessions, now = new Date()) {
  const weeks = new Set(sessions.map((s) => isoDay(weekStart(parseDate(s.date)))))
  if (!weeks.size) return 0
  const cursor = weekStart(now)
  // Allow the current week to be empty without breaking last week's streak.
  if (!weeks.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 7)
  let n = 0
  while (weeks.has(isoDay(cursor))) {
    n += 1
    cursor.setDate(cursor.getDate() - 7)
  }
  return n
}

export function summary(sessions, now = new Date()) {
  const boulders = allBoulders(sessions)
  const routes = allRoutes(sessions)
  const sets = allSets(sessions)
  const hardestBoulder = boulders.length ? Math.max(...boulders.map((b) => b.grade)) : null
  const routeOrdinals = routes.map((r) => sportOrdinal(r.grade)).filter((o) => o >= 0)
  return {
    sessions: sessions.length,
    climbDays: sessions.filter((s) => s.type === 'climb').length,
    liftDays: sessions.filter((s) => s.type === 'lift').length,
    boulders: boulders.length,
    routes: routes.length,
    sets: sets.length,
    volume: sets.reduce((acc, s) => acc + s.weight * s.reps, 0),
    hardestBoulder: hardestBoulder == null ? null : formatBoulder(hardestBoulder),
    hardestRoute: routeOrdinals.length ? formatSport(SPORT_GRADES[Math.max(...routeOrdinals)]) : null,
    streak: weekStreak(sessions, now),
  }
}
