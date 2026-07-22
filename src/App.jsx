import { useCallback, useEffect, useMemo, useState } from 'react'
import { exportIsStale, load, requestPersistence, save, todayStr } from './lib/storage.js'
import { applyTheme, storedTheme, systemPrefersDark, THEME_KEY } from './lib/theme.js'
import ClimbTab from './components/ClimbTab.jsx'
import LiftTab from './components/LiftTab.jsx'
import AnalysisTab from './components/AnalysisTab.jsx'
import SessionLog from './components/SessionLog.jsx'
import Settings from './components/Settings.jsx'

const TABS = [
  { key: 'climb', label: 'Climb' },
  { key: 'lift', label: 'Lift' },
  { key: 'analysis', label: 'Analysis' },
]

export default function App() {
  const [data, setData] = useState(load)
  const [tab, setTab] = useState('climb')
  // Which day the logging tabs write to. Deliberately not persisted: it resets
  // to today on every launch, so a back-fill can never silently become the
  // default and swallow a real session.
  const [date, setDate] = useState(todayStr)
  // A stack of open views, one per history entry: [] | [log] | [log, detail].
  // Centralizing it here is what lets one popstate handler unwind exactly one
  // level, instead of each component guessing whether a back was meant for it.
  const [stack, setStack] = useState([])
  const overlay = stack[0]?.view ?? null
  const top = stack[stack.length - 1] ?? null

  // One write path: every mutation is a whole-blob replace, then a save().
  const update = useCallback((fn) => {
    setData((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      save(next)
      return next
    })
  }, [])

  // Ask once per launch. Installed apps are granted this silently; in a plain
  // browser tab it may be refused, which is what Settings reports.
  useEffect(() => {
    requestPersistence()
  }, [])

  // Explicit choice wins; until one is made, follow the system and keep
  // following it if it changes.
  const [theme, setTheme] = useState(storedTheme)
  const [sysDark, setSysDark] = useState(systemPrefersDark)
  const isDark = theme ? theme === 'dark' : sysDark

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => setSysDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    applyTheme(isDark)
  }, [isDark])

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, next)
    setTheme(next)
  }

  // Keep the tab in the URL hash so a phone reload lands where it left off.
  // replaceState, not pushState: on Android, back from a top-level tab should
  // leave the app, not walk back through every tab the user has pressed.
  useEffect(() => {
    const key = window.location.hash.slice(1)
    if (TABS.some((t) => t.key === key)) setTab(key)
  }, [])
  useEffect(() => {
    window.history.replaceState(null, '', `#${tab}`)
  }, [tab])

  // Each open view is a history entry, so Android's back gesture closes what is
  // open instead of quitting the app. Every close route calls back(), so the
  // history stack and this state can never drift apart.
  const pushView = (entry) => {
    window.history.pushState({ view: entry.view }, '')
    setStack((s) => [...s, entry])
  }
  const popView = () => window.history.back()

  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Recomputed whenever data changes or Settings closes, which covers both
  // "first session logged" and "just exported".
  const needsBackup = useMemo(() => exportIsStale(data), [data, overlay])

  const props = { data, update }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="flex items-center gap-2 px-4 py-3">
          <h1 className="mr-auto text-base font-semibold tracking-tight">Training</h1>

          {/* desktop tabs live up here; mobile gets the bottom bar */}
          <nav className="mr-2 hidden gap-1 sm:flex">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`min-h-9 rounded-lg px-3 text-sm transition-colors ${
                  tab === t.key
                    ? 'bg-(--color-accent)/10 font-medium text-(--color-accent)'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <button
            onClick={() => pushView({ view: 'log' })}
            className="min-h-9 rounded-lg px-2.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Log
          </button>
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            className="min-h-9 rounded-lg px-2.5 text-base text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {isDark ? '☀' : '☾'}
          </button>
          <button
            onClick={() => pushView({ view: 'settings' })}
            aria-label={needsBackup ? 'Settings — backup is out of date' : 'Settings'}
            className="relative min-h-9 rounded-lg px-2.5 text-base text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ⚙
            {/* the whole nag: a dot, no dialog, no banner */}
            {needsBackup && (
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-(--color-accent)" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28 sm:pb-8">
        {tab === 'climb' && <ClimbTab {...props} date={date} onDateChange={setDate} />}
        {tab === 'lift' && <LiftTab {...props} date={date} onDateChange={setDate} />}
        {tab === 'analysis' && <AnalysisTab {...props} />}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-zinc-200 bg-white/90 backdrop-blur sm:hidden dark:border-zinc-800 dark:bg-zinc-950/90"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-14 flex-1 text-sm transition-colors ${
              tab === t.key ? 'font-medium text-(--color-accent)' : 'text-zinc-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* Done and the back gesture take the same path out. */}
      {overlay === 'log' && (
        <SessionLog
          {...props}
          openId={top?.view === 'detail' ? top.id : null}
          onOpen={(id) => pushView({ view: 'detail', id })}
          onClose={popView}
        />
      )}
      {overlay === 'settings' && <Settings {...props} onClose={popView} />}
    </div>
  )
}
