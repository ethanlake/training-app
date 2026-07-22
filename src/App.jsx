import { useCallback, useEffect, useState } from 'react'
import { load, save } from './lib/storage.js'
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
  const [overlay, setOverlay] = useState(null) // 'log' | 'settings' | null

  // One write path: every mutation is a whole-blob replace, then a save().
  const update = useCallback((fn) => {
    setData((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      save(next)
      return next
    })
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
  useEffect(() => {
    const key = window.location.hash.slice(1)
    if (TABS.some((t) => t.key === key)) setTab(key)
  }, [])
  useEffect(() => {
    window.history.replaceState(null, '', `#${tab}`)
  }, [tab])

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
            onClick={() => setOverlay('log')}
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
            onClick={() => setOverlay('settings')}
            aria-label="Settings"
            className="min-h-9 rounded-lg px-2.5 text-base text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ⚙
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-28 sm:pb-8">
        {tab === 'climb' && <ClimbTab {...props} />}
        {tab === 'lift' && <LiftTab {...props} />}
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

      {overlay === 'log' && <SessionLog {...props} onClose={() => setOverlay(null)} />}
      {overlay === 'settings' && <Settings {...props} onClose={() => setOverlay(null)} />}
    </div>
  )
}
