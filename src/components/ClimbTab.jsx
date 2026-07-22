import { useState } from 'react'
import {
  BOULDER_GRADES,
  DEFAULT_BOULDER_TAGS,
  ROUTE_TAGS,
  SPORT_GRADES,
  formatBoulder,
  formatSport,
} from '../lib/grades.js'
import { findSession, todayStr, uid, updateToday, pruneEmpty } from '../lib/storage.js'
import { Chip, DateHeading, Section, SubNav } from './ui.jsx'
import Notes from './Notes.jsx'

export default function ClimbTab({ data, update }) {
  const date = todayStr()
  const session = findSession(data, 'climb', date)
  const boulders = session?.boulders ?? []
  const routes = session?.routes ?? []

  // Tags persist between adds — a session's problems usually share a character,
  // so re-picking them for every boulder would be the slowest part of logging.
  const [tags, setTags] = useState([])
  const [mode, setMode] = useState('boulder')

  const allTags = [...DEFAULT_BOULDER_TAGS, ...data.customBoulderTags]

  const toggleTag = (t) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))

  const addBoulder = (grade) =>
    update((d) =>
      updateToday(d, 'climb', (s) => ({
        ...s,
        boulders: [...s.boulders, { id: uid(), grade, tags: [...tags] }],
      })),
    )

  const removeBoulder = (id) =>
    update((d) =>
      pruneEmpty(
        updateToday(d, 'climb', (s) => ({ ...s, boulders: s.boulders.filter((b) => b.id !== id) })),
      ),
    )

  const addRoute = (grade, routeTags) =>
    update((d) =>
      updateToday(d, 'climb', (s) => ({
        ...s,
        routes: [...s.routes, { id: uid(), grade, tags: routeTags }],
      })),
    )

  const removeRoute = (id) =>
    update((d) =>
      pruneEmpty(
        updateToday(d, 'climb', (s) => ({ ...s, routes: s.routes.filter((r) => r.id !== id) })),
      ),
    )

  const addCustomTag = () => {
    const name = window.prompt('New tag')?.trim().toLowerCase()
    if (!name) return
    if (!allTags.includes(name)) update((d) => ({ ...d, customBoulderTags: [...d.customBoulderTags, name] }))
    setTags((prev) => (prev.includes(name) ? prev : [...prev, name]))
  }

  return (
    <div>
      <DateHeading date={date} />

      <SubNav
        value={mode}
        onChange={setMode}
        options={[
          { key: 'boulder', label: 'Boulders' },
          { key: 'sport', label: 'Sport' },
        ]}
      />

      {mode === 'boulder' ? (
        <>
          <Section>
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
              {BOULDER_GRADES.map((g) => (
                <button
                  key={g}
                  onClick={() => addBoulder(g)}
                  className="min-h-14 rounded-lg border border-zinc-200 text-base font-medium
                    text-zinc-800 transition-colors active:bg-zinc-900 active:text-white
                    dark:border-zinc-800 dark:text-zinc-200 dark:active:bg-zinc-100
                    dark:active:text-zinc-900"
                >
                  {formatBoulder(g)}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Tags">
            <div className="flex flex-wrap gap-1.5">
              {allTags.map((t) => (
                <Chip key={t} on={tags.includes(t)} onClick={() => toggleTag(t)}>
                  {t}
                </Chip>
              ))}
              <Chip onClick={addCustomTag} aria-label="Add custom tag">
                +
              </Chip>
            </div>
          </Section>

          {boulders.length > 0 && (
            <Section title="Today">
              <ul className="flex flex-wrap gap-1.5">
                {boulders.map((b) => (
                  <li key={b.id}>
                    <button
                      onClick={() => removeBoulder(b.id)}
                      title="Tap to delete"
                      className="flex min-h-11 items-center gap-2 rounded-lg bg-zinc-100 px-3
                        text-sm active:opacity-60 dark:bg-zinc-900"
                    >
                      <span className="font-medium">{formatBoulder(b.grade)}</span>
                      {b.tags?.length > 0 && (
                        <span className="text-xs text-zinc-500">{b.tags.join(' · ')}</span>
                      )}
                      <span className="text-zinc-400">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      ) : (
        <>
          <Section>
            <RouteAdder onAdd={addRoute} />
          </Section>

          {routes.length > 0 && (
            <Section title="Today">
              <ul className="flex flex-wrap gap-1.5">
                {routes.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => removeRoute(r.id)}
                      title="Tap to delete"
                      className="flex min-h-11 items-center gap-2 rounded-lg bg-zinc-100 px-3
                        text-sm active:opacity-60 dark:bg-zinc-900"
                    >
                      <span className="font-medium">{formatSport(r.grade)}</span>
                      {r.tags?.length > 0 && (
                        <span className="text-xs text-zinc-500">{r.tags.join(' · ')}</span>
                      )}
                      <span className="text-zinc-400">×</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}

      <Notes
        value={session?.notes ?? ''}
        onCommit={(notes) => update((d) => pruneEmpty(updateToday(d, 'climb', (s) => ({ ...s, notes }))))}
      />
    </div>
  )
}

function RouteAdder({ onAdd }) {
  const [grade, setGrade] = useState('11a')
  const [tags, setTags] = useState(['indoor'])

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <select value={grade} onChange={(e) => setGrade(e.target.value)} className="field w-28">
        {SPORT_GRADES.map((g) => (
          <option key={g} value={g}>
            {formatSport(g)}
          </option>
        ))}
      </select>
      {ROUTE_TAGS.map((t) => (
        <Chip
          key={t}
          on={tags.includes(t)}
          onClick={() =>
            setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
          }
        >
          {t}
        </Chip>
      ))}
      <button className="btn ml-auto" onClick={() => onAdd(grade, [...tags])}>
        Add
      </button>
    </div>
  )
}
