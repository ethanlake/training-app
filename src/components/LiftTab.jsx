import { useMemo, useState } from 'react'
import { findSession, todayStr, uid, updateDay, pruneEmpty } from '../lib/storage.js'
import {
  DEFAULT_EXERCISES,
  formatWeight,
  isBarbell,
  num,
  sideFromTotal,
  totalFromSide,
} from '../lib/exercises.js'
import { Chip, DateHeading, Section } from './ui.jsx'
import Notes from './Notes.jsx'

const RPE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export default function LiftTab({ data, update, date, onDateChange }) {
  const session = findSession(data, 'lift', date)
  const sets = session?.sets ?? []

  const exercises = [...DEFAULT_EXERCISES, ...data.customExercises]

  // Most recent set of each exercise, anywhere in the history — a new set is
  // nearly always a repeat of the last one, so it seeds the inputs outright
  // rather than only hinting at them.
  const recentSets = useMemo(
    () =>
      data.sessions
        .filter((s) => s.type === 'lift')
        .sort((a, b) => b.date.localeCompare(a.date))
        .flatMap((s) => [...(s.sets ?? [])].reverse()),
    [data.sessions],
  )

  // The field always holds what the user types: per-side for barbell lifts,
  // plain weight otherwise. Stored sets are always totals, so seeding the field
  // from history converts back down.
  const fieldValue = (set) =>
    set ? String(num(isBarbell(set.exercise) ? sideFromTotal(set.weight) : set.weight)) : ''

  const [exercise, setExercise] = useState(exercises[0])
  const seed = recentSets.find((s) => s.exercise === exercises[0])
  const [weight, setWeight] = useState(() => fieldValue(seed))
  const [reps, setReps] = useState(seed ? String(seed.reps) : '')
  const [rpe, setRpe] = useState(seed?.rpe ?? 7)

  const lastSet = recentSets.find((s) => s.exercise === exercise)
  const perSide = isBarbell(exercise)

  const pickExercise = (name) => {
    setExercise(name)
    const prev = recentSets.find((s) => s.exercise === name)
    // Never carry the previous exercise's numbers over — a 275 lb deadlift
    // left sitting in the box under "bicep curl" is a wrong entry waiting.
    setWeight(fieldValue(prev))
    setReps(prev ? String(prev.reps) : '')
    setRpe(prev?.rpe ?? 7)
  }

  const addCustomExercise = () => {
    const name = window.prompt('New exercise')?.trim().toLowerCase()
    if (!name) return
    if (!exercises.includes(name)) update((d) => ({ ...d, customExercises: [...d.customExercises, name] }))
    setExercise(name)
  }

  const entered = Number(weight)
  const r = Number(reps)
  // An empty field is Number('') === 0, so blankness is checked separately —
  // a bare bar (0 per side) is a legitimate entry, an empty box is not.
  const weightOk =
    weight.trim() !== '' && Number.isFinite(entered) && (perSide ? entered >= 0 : entered > 0)
  const canAdd = weightOk && Number.isFinite(r) && r > 0

  // What actually gets stored: the true weight on the bar.
  const total = perSide ? totalFromSide(entered) : entered

  const addSet = () => {
    if (!canAdd) return
    update((d) =>
      updateDay(
        d,
        'lift',
        (s) => ({ ...s, sets: [...s.sets, { id: uid(), exercise, weight: total, reps: r, rpe }] }),
        date,
      ),
    )
  }

  const removeSet = (id) =>
    update((d) =>
      pruneEmpty(updateDay(d, 'lift', (s) => ({ ...s, sets: s.sets.filter((x) => x.id !== id) }), date)),
    )

  const grouped = useMemo(() => {
    const map = new Map()
    for (const s of sets) {
      if (!map.has(s.exercise)) map.set(s.exercise, [])
      map.get(s.exercise).push(s)
    }
    return [...map.entries()]
  }, [sets])

  return (
    <div>
      <DateHeading date={date} onChange={onDateChange} />

      <Section title="Exercise">
        <div className="flex flex-wrap gap-1.5">
          {exercises.map((e) => (
            <Chip key={e} on={e === exercise} onClick={() => pickExercise(e)}>
              {e}
            </Chip>
          ))}
          <Chip onClick={addCustomExercise} aria-label="Add custom exercise">
            +
          </Chip>
        </div>
      </Section>

      <Section title="Set">
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="label mb-1 block">
              {perSide ? 'Per side (lb)' : 'Weight (lb)'}
            </span>
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder={lastSet ? fieldValue(lastSet) : perSide ? '90' : '135'}
              className="field"
            />
          </label>
          <label className="flex-1">
            <span className="label mb-1 block">Reps</span>
            <input
              type="number"
              inputMode="numeric"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder={lastSet ? String(lastSet.reps) : '5'}
              className="field"
            />
          </label>
        </div>

        {/* the arithmetic, done for you, before you commit to the set */}
        {perSide && (
          <p className="mt-2 text-sm text-zinc-500 tabular-nums">
            {weightOk ? `${num(total)} lb total — ${num(entered)} a side plus the 45 lb bar` : ` `}
          </p>
        )}

        <div className="mt-3">
          <span className="label mb-1 block">RPE {rpe}</span>
          <div className="grid grid-cols-10 gap-1">
            {RPE.map((n) => (
              <button
                key={n}
                onClick={() => setRpe(n)}
                className={`min-h-11 rounded-lg border text-sm ${
                  n === rpe
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                    : 'border-zinc-200 text-zinc-500 dark:border-zinc-800'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <button className="btn mt-3 w-full" onClick={addSet} disabled={!canAdd}>
          Add set
        </button>
      </Section>

      {grouped.length > 0 && (
        <Section title={date === todayStr() ? 'Today' : 'Logged'}>
          <div className="flex flex-col gap-4">
            {grouped.map(([name, list]) => (
              <div key={name}>
                <h3 className="mb-1.5 text-sm font-medium">{name}</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {list.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => removeSet(s.id)}
                        title="Tap to delete"
                        className="flex min-h-11 items-center gap-2 rounded-lg bg-zinc-100 px-3
                          text-sm tabular-nums active:opacity-60 dark:bg-zinc-900"
                      >
                        <span className="font-medium">
                          {formatWeight(s.exercise, s.weight)}
                          <span className="text-zinc-400"> × </span>
                          {s.reps}
                        </span>
                        <span className="text-xs text-zinc-500">RPE {s.rpe}</span>
                        <span className="text-zinc-400">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Notes
        value={session?.notes ?? ''}
        onCommit={(notes) => update((d) => pruneEmpty(updateDay(d, 'lift', (s) => ({ ...s, notes }), date)))}
      />
    </div>
  )
}
