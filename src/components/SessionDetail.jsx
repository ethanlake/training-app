import { useState } from 'react'
import { formatBoulder, formatSport } from '../lib/grades.js'
import { formatWeight } from '../lib/exercises.js'
import { deleteSession, updateSession } from '../lib/storage.js'
import Notes from './Notes.jsx'
import { Overlay, Section } from './ui.jsx'
import { formatDay } from './SessionLog.jsx'

export default function SessionDetail({ session, update, onClose, onDeleted }) {
  const [editing, setEditing] = useState(false)

  const edit = (fn) => update((d) => updateSession(d, session.id, fn))

  const removeEntry = (key, id) =>
    edit((s) => ({ ...s, [key]: s[key].filter((e) => e.id !== id) }))

  const removeSession = () => {
    if (!window.confirm('Delete this whole session? This cannot be undone.')) return
    update((d) => deleteSession(d, session.id))
    onDeleted()
  }

  const title = session.type === 'climb' ? 'Climb' : 'Lift'

  return (
    <Overlay title={`${title} · ${formatDay(session.date)}`} onClose={onClose}>
      <div className="mb-6 flex gap-2">
        <button className="btn-quiet" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done editing' : 'Edit'}
        </button>
        <button
          className="btn-quiet ml-auto text-red-600 dark:text-red-400"
          onClick={removeSession}
        >
          Delete session
        </button>
      </div>

      {session.type === 'climb' ? (
        <>
          <EntryList
            title="Boulders"
            entries={session.boulders}
            editing={editing}
            render={(b) => (
              <>
                <span className="font-medium">{formatBoulder(b.grade)}</span>
                {b.tags?.length > 0 && (
                  <span className="text-xs text-zinc-500">{b.tags.join(' · ')}</span>
                )}
              </>
            )}
            onRemove={(id) => removeEntry('boulders', id)}
          />
          <EntryList
            title="Sport routes"
            entries={session.routes}
            editing={editing}
            render={(r) => (
              <>
                <span className="font-medium">{formatSport(r.grade)}</span>
                {r.tags?.length > 0 && (
                  <span className="text-xs text-zinc-500">{r.tags.join(' · ')}</span>
                )}
              </>
            )}
            onRemove={(id) => removeEntry('routes', id)}
          />
        </>
      ) : (
        <EntryList
          title="Sets"
          entries={session.sets}
          editing={editing}
          render={(s) => (
            <>
              <span className="font-medium">{s.exercise}</span>
              <span className="tabular-nums">
                {formatWeight(s.exercise, s.weight)} × {s.reps}
              </span>
              <span className="text-xs text-zinc-500">RPE {s.rpe}</span>
            </>
          )}
          onRemove={(id) => removeEntry('sets', id)}
        />
      )}

      {editing ? (
        <Notes value={session.notes ?? ''} onCommit={(notes) => edit((s) => ({ ...s, notes }))} />
      ) : (
        <Section title="Notes">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
            {session.notes?.trim() || <span className="text-zinc-400">—</span>}
          </p>
        </Section>
      )}
    </Overlay>
  )
}

function EntryList({ title, entries, editing, render, onRemove }) {
  if (!entries?.length) return null
  return (
    <Section title={title}>
      <ul className="flex flex-wrap gap-1.5">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-zinc-100 px-3 text-sm dark:bg-zinc-900"
          >
            {render(e)}
            {editing && (
              <button
                onClick={() => onRemove(e.id)}
                aria-label="Delete entry"
                className="ml-1 text-zinc-400 active:opacity-60"
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}
