import { useRef, useState } from 'react'
import { exportJson, mergeData, parseImport, storageBytes } from '../lib/storage.js'
import { Overlay, Section } from './ui.jsx'

export default function Settings({ data, update, onClose }) {
  const fileRef = useRef(null)
  const [status, setStatus] = useState(null)

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
      update((d) => mergeData(d, incoming))
      setStatus(`Merged ${n} sessions.`)
      return
    }
    if (window.confirm('Replace all local data with the file? Current data will be lost.')) {
      update(incoming)
      setStatus(`Replaced with ${n} sessions.`)
    } else {
      setStatus('Import cancelled.')
    }
  }

  const bytes = storageBytes()

  return (
    <Overlay title="Settings" onClose={onClose}>
      <Section title="Backup">
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => exportJson(data)}>
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
        <p className="mt-3 text-sm text-zinc-500">
          Data lives only in this browser. Export on one device and import on another to sync.
        </p>
      </Section>

      <Section title="Storage">
        <p className="text-sm text-zinc-500">
          {data.sessions.length} sessions · {(bytes / 1024).toFixed(1)} KB
        </p>
      </Section>

      {status && <p className="text-sm text-zinc-500">{status}</p>}
    </Overlay>
  )
}
