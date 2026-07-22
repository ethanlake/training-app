// Shared shells used by more than one tab.

import { todayStr } from '../lib/storage.js'

export function Section({ title, action, children }) {
  return (
    <section className="mb-8">
      {(title || action) && (
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="label">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

// Full-screen panel used for the session log, session detail, and settings.
export function Overlay({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-3">
          <h2 className="mr-auto text-base font-semibold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="min-h-11 px-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Done
          </button>
        </div>
      </header>
      <div
        className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-4"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
      {footer}
    </div>
  )
}

// Sub-navigation within a tab, echoing the header's tab styling one level down.
export function SubNav({ value, onChange, options }) {
  return (
    <nav className="mb-7 flex gap-1">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`min-h-11 rounded-lg px-3.5 text-sm transition-colors ${
            value === o.key
              ? 'bg-(--color-accent)/10 font-medium text-(--color-accent)'
              : 'text-zinc-500'
          }`}
        >
          {o.label}
        </button>
      ))}
    </nav>
  )
}

export function Chip({ on, children, ...rest }) {
  return (
    <button type="button" className={`chip ${on ? 'chip-on' : ''}`} {...rest}>
      {children}
    </button>
  )
}

// Tapping the date opens the platform's own calendar — a transparent native
// date input sits over the label, which is what makes the phone show its real
// picker instead of a hand-rolled one. Back-dating is for sessions you forgot
// to log, so future dates are capped out.
export function DateHeading({ date, onChange }) {
  const today = todayStr()
  const isToday = date === today
  const d = new Date(`${date}T00:00:00`)

  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="relative inline-flex items-center">
        <span
          className={`text-sm ${
            isToday ? 'text-zinc-500' : 'font-medium text-(--color-accent)'
          }`}
        >
          {d.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }),
          })}
        </span>
        <input
          type="date"
          value={date}
          max={today}
          aria-label="Change date"
          // showPicker() is what opens the calendar on desktop; on phones the
          // tap alone is enough.
          onClick={(e) => e.currentTarget.showPicker?.()}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </span>

      {/* only offered when it would do something — no dead control on a normal day */}
      {!isToday && (
        <button
          onClick={() => onChange(today)}
          className="text-sm text-zinc-500 underline underline-offset-4"
        >
          Today
        </button>
      )}
    </div>
  )
}
