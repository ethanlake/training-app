import { useMemo } from 'react'
import { formatBoulder } from '../lib/grades.js'
import { Overlay } from './ui.jsx'
import SessionDetail from './SessionDetail.jsx'

// Which session is open is owned by App, because it is a history entry — see the
// view stack there. This component just reports taps and renders what it is told.
export default function SessionLog({ data, update, openId, onOpen, onClose }) {
  const sessions = useMemo(
    () => [...data.sessions].sort((a, b) => b.date.localeCompare(a.date) || a.type.localeCompare(b.type)),
    [data.sessions],
  )
  const open = sessions.find((s) => s.id === openId)

  if (open) {
    return <SessionDetail session={open} update={update} onClose={onClose} onDeleted={onClose} />
  }

  return (
    <Overlay title="Log" onClose={onClose}>
      {sessions.length === 0 ? (
        <p className="py-12 text-center text-sm text-zinc-400">Nothing logged yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onOpen(s.id)}
                className="flex w-full items-center gap-3 py-3.5 text-left"
              >
                <span className="w-24 shrink-0 text-sm tabular-nums text-zinc-500">
                  {formatDay(s.date)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{describe(s)}</span>
                  {s.notes?.trim() && (
                    <span className="mt-0.5 block truncate text-xs text-zinc-400">{s.notes}</span>
                  )}
                </span>
                <span className="text-zinc-300 dark:text-zinc-700">›</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Overlay>
  )
}

export function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  })
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function describe(s) {
  if (s.type === 'climb') {
    const parts = []
    if (s.boulders?.length) {
      const hardest = Math.max(...s.boulders.map((b) => b.grade))
      parts.push(`${plural(s.boulders.length, 'boulder')} · up to ${formatBoulder(hardest)}`)
    }
    if (s.routes?.length) parts.push(plural(s.routes.length, 'route'))
    return parts.join(' · ') || 'Climb'
  }
  const names = [...new Set((s.sets ?? []).map((x) => x.exercise))]
  const parts = []
  if (names.length) parts.push(`${plural(s.sets.length, 'set')} · ${names.join(', ')}`)
  if (s.bodyweight != null) parts.push(`${s.bodyweight} lb`)
  return parts.join(' · ') || 'Lift'
}
