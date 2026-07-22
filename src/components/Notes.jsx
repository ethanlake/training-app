import { useEffect, useState } from 'react'
import { Section } from './ui.jsx'

// Uncontrolled while focused, committed on blur — saving per keystroke would
// rewrite the whole blob on every character.
export default function Notes({ value, onCommit, label = 'Notes' }) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <Section title={label}>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        rows={3}
        className="field resize-y py-2.5 leading-relaxed"
      />
    </Section>
  )
}
