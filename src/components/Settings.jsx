import { useEffect, useRef, useState } from 'react'
import {
  daysSinceExport,
  exportIsStale,
  exportJson,
  mergeData,
  parseImport,
  readBackup,
  snapshot,
  storageBytes,
} from '../lib/storage.js'
import { Overlay, Section } from './ui.jsx'

export default function Settings({ data, update, onClose }) {
  const fileRef = useRef(null)
  const [status, setStatus] = useState(null)
  // Read once per open: both change only as a result of actions taken here.
  const [backup, setBackup] = useState(readBackup)
  const [days, setDays] = useState(daysSinceExport)
  const [persistent, setPersistent] = useState(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistent, () => setPersistent(null))
  }, [])

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be picked twice
    if (!file) return
    let incoming
    try {
      incoming = parseImport(await file.text())
    } catch (err) {
      setStatus(`Could not read that file: ${err.message}`)
      return
    }

    const n = incoming.sessions.length
    const merge = window.confirm(
      `Import ${n} session${n === 1 ? '' : 's'} from ${file.name}?\n\n` +
        'OK — merge into what is already here.\n' +
        'Cancel — choose whether to replace everything instead.',
    )
    if (merge) {
      snapshot('before merge import')
      update((d) => mergeData(d, incoming))
      setBackup(readBackup())
      setStatus(`Merged ${n} sessions.`)
      return
    }
    if (window.confirm('Replace all local data with the file? Current data will be lost.')) {
      snapshot('before replace import')
      update(incoming)
      setBackup(readBackup())
      setStatus(`Replaced with ${n} sessions.`)
    } else {
      setStatus('Import cancelled.')
    }
  }

  const restore = () => {
    if (
      !window.confirm(
        `Restore the safety copy from ${formatWhen(backup.at)} (${backup.sessions} sessions)?\n\n` +
          'What is here now will be kept as the new safety copy, so this is reversible.',
      )
    )
      return
    snapshot('before restore')
    update(backup.data)
    setBackup(readBackup())
    setStatus('Safety copy restored.')
  }

  const stale = exportIsStale(data)

  return (
    <Overlay title="Settings" onClose={onClose}>
      <Section title="Backup">
        <div className="flex flex-wrap gap-2">
          <button
            className="btn"
            onClick={() => {
              exportJson(data)
              setDays(0)
              setStatus(null)
            }}
          >
            Export JSON
          </button>
          <button className="btn-quiet" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={onFile}
            className="hidden"
          />
        </div>

        <p
          className={`mt-3 text-sm ${
            stale ? 'font-medium text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'
          }`}
        >
          {exportAge(days, data.sessions.length)}
        </p>
        <p className="mt-1.5 text-sm text-zinc-500">
          Data lives only in this browser, and browsers do delete it. An exported file kept
          somewhere else is the only real backup.
        </p>
      </Section>

      {backup && (
        <Section title="Safety copy">
          <p className="mb-2.5 text-sm text-zinc-500">
            {backup.sessions} sessions, saved {formatWhen(backup.at)} — {backup.reason}.
          </p>
          <button className="btn-quiet" onClick={restore}>
            Restore this copy
          </button>
        </Section>
      )}

      <Section title="Storage">
        <p className="text-sm text-zinc-500">
          {data.sessions.length} sessions · {(storageBytes() / 1024).toFixed(1)} KB
        </p>
        <p className="mt-1.5 text-sm text-zinc-500">
          {persistent === true
            ? 'Protected — this browser will not evict the data on its own.'
            : persistent === false
              ? 'Not protected. Install the app to your home screen, or the browser may clear this data.'
              : 'Protection status unknown in this browser.'}
        </p>
      </Section>

      {status && <p className="text-sm text-zinc-500">{status}</p>}
    </Overlay>
  )
}

function exportAge(days, sessions) {
  if (!sessions) return 'Nothing logged yet.'
  if (days === null) return 'Never exported.'
  if (days === 0) return 'Exported today.'
  if (days === 1) return 'Exported yesterday.'
  return `Last exported ${days} days ago.`
}

const formatWhen = (d) =>
  d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
