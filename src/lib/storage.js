// Single versioned blob in localStorage. The dataset is small (years of use is
// tens of KB), so every write serializes the whole thing through save().

export const STORAGE_KEY = 'training-app/v1'
export const VERSION = 1

export const emptyData = () => ({
  version: VERSION,
  sessions: [],
  customBoulderTags: [],
  customExercises: [],
})

export const uid = () => Math.random().toString(36).slice(2, 10)

// Local calendar date, not UTC — a 9pm session should not land on tomorrow.
export function todayStr(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function migrate(raw) {
  if (!raw || typeof raw !== 'object') return emptyData()
  if (raw.version !== VERSION) {
    // No older schemas exist yet; anything unrecognized is passed through with
    // its shape normalized rather than discarded.
    console.warn(`Unknown data version ${raw.version}; loading defensively.`)
  }
  return {
    version: VERSION,
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    customBoulderTags: Array.isArray(raw.customBoulderTags) ? raw.customBoulderTags : [],
    customExercises: Array.isArray(raw.customExercises) ? raw.customExercises : [],
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    return migrate(JSON.parse(raw))
  } catch (err) {
    console.error('Failed to load saved data; starting empty.', err)
    return emptyData()
  }
}

export function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(data))
    return true
  } catch (err) {
    console.error('Failed to save.', err)
    return false
  }
}

export const serialize = (data) => JSON.stringify(data, null, 2)

export function storageBytes() {
  try {
    return new Blob([localStorage.getItem(STORAGE_KEY) ?? '']).size
  } catch {
    return 0
  }
}

const blankSession = (type, date) =>
  type === 'climb'
    ? { id: uid(), type, date, boulders: [], routes: [], notes: '' }
    : { id: uid(), type, date, sets: [], notes: '' }

export const findSession = (data, type, date) =>
  data.sessions.find((s) => s.type === type && s.date === date)

// Returns [data, session] where data may be a new object carrying a freshly
// created session. At most one session per (type, date).
export function getOrCreateToday(data, type, date = todayStr()) {
  const existing = findSession(data, type, date)
  if (existing) return [data, existing]
  const session = blankSession(type, date)
  return [{ ...data, sessions: [...data.sessions, session] }, session]
}

// fn receives a shallow copy of today's session and returns the replacement.
export function updateToday(data, type, fn, date = todayStr()) {
  const [withSession, session] = getOrCreateToday(data, type, date)
  const next = fn({ ...session })
  return {
    ...withSession,
    sessions: withSession.sessions.map((s) => (s.id === session.id ? next : s)),
  }
}

export function updateSession(data, id, fn) {
  return { ...data, sessions: data.sessions.map((s) => (s.id === id ? fn({ ...s }) : s)) }
}

export function deleteSession(data, id) {
  return { ...data, sessions: data.sessions.filter((s) => s.id !== id) }
}

// A session with no entries and no notes is an artifact of opening a tab, not a
// record of anything — drop it so the log stays honest.
export function pruneEmpty(data) {
  return {
    ...data,
    sessions: data.sessions.filter(
      (s) =>
        (s.notes ?? '').trim() !== '' ||
        (s.boulders?.length ?? 0) > 0 ||
        (s.routes?.length ?? 0) > 0 ||
        (s.sets?.length ?? 0) > 0,
    ),
  }
}

export function exportJson(data) {
  const blob = new Blob([serialize(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `training-${todayStr()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseImport(text) {
  const parsed = migrate(JSON.parse(text))
  if (!parsed.sessions.every((s) => s && s.date && (s.type === 'climb' || s.type === 'lift'))) {
    throw new Error('File does not look like a training export.')
  }
  return parsed
}

const uniq = (a) => [...new Set(a)]

// Merge keeps both sides: sessions matching on (type, date) have their entries
// concatenated, deduped by entry id, so re-importing the same file is a no-op.
export function mergeData(current, incoming) {
  const sessions = current.sessions.map((s) => ({ ...s }))
  for (const inc of incoming.sessions) {
    const mine = sessions.find((s) => s.type === inc.type && s.date === inc.date)
    if (!mine) {
      sessions.push({ ...inc })
      continue
    }
    for (const key of ['boulders', 'routes', 'sets']) {
      if (!inc[key]) continue
      const seen = new Set((mine[key] ?? []).map((e) => e.id))
      mine[key] = [...(mine[key] ?? []), ...inc[key].filter((e) => !seen.has(e.id))]
    }
    if (inc.notes && inc.notes !== mine.notes) {
      mine.notes = mine.notes ? `${mine.notes}\n${inc.notes}` : inc.notes
    }
  }
  return {
    version: VERSION,
    sessions,
    customBoulderTags: uniq([...current.customBoulderTags, ...incoming.customBoulderTags]),
    customExercises: uniq([...current.customExercises, ...incoming.customExercises]),
  }
}
