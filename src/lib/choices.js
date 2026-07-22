// The pickable tags and exercises, and the rules for adding or removing one.
//
// Two sources feed each list: a built-in set in code and whatever the user has
// added. Removing a built-in cannot delete it from the source, so it goes on a
// hidden list instead; removing a custom one drops it outright. Adding a name
// back clears it from the hidden list, which is how a built-in returns.

import { DEFAULT_BOULDER_TAGS } from './grades.js'
import { DEFAULT_EXERCISES } from './exercises.js'

const KINDS = {
  tag: {
    label: 'tag',
    defaults: DEFAULT_BOULDER_TAGS,
    customKey: 'customBoulderTags',
    hiddenKey: 'hiddenBoulderTags',
    // Route tags (indoor/outdoor) are a separate fixed set and are not editable.
    countUses: (data, name) =>
      data.sessions
        .flatMap((s) => s.boulders ?? [])
        .filter((b) => (b.tags ?? []).includes(name)).length,
  },
  exercise: {
    label: 'exercise',
    defaults: DEFAULT_EXERCISES,
    customKey: 'customExercises',
    hiddenKey: 'hiddenExercises',
    countUses: (data, name) =>
      data.sessions.flatMap((s) => s.sets ?? []).filter((x) => x.exercise === name).length,
  },
}

export const kindLabel = (kind) => KINDS[kind].label

export function listChoices(data, kind) {
  const k = KINDS[kind]
  const hidden = new Set(data[k.hiddenKey] ?? [])
  const custom = (data[k.customKey] ?? []).filter((n) => !hidden.has(n))
  return [...k.defaults.filter((n) => !hidden.has(n)), ...custom]
}

export const countUses = (data, kind, name) => KINDS[kind].countUses(data, name)

export function addChoice(data, kind, name) {
  const k = KINDS[kind]
  const hidden = (data[k.hiddenKey] ?? []).filter((n) => n !== name)
  const isDefault = k.defaults.includes(name)
  const custom = data[k.customKey] ?? []
  return {
    ...data,
    [k.hiddenKey]: hidden,
    [k.customKey]: isDefault || custom.includes(name) ? custom : [...custom, name],
  }
}

// The removal flow both tabs share, dialogs included — native confirm/alert is
// what the rest of the app already uses for destructive choices. Returns the
// new data, or null if it was refused or cancelled.
export function promptRemove(data, kind, name, { minRemaining = 0 } = {}) {
  const label = kindLabel(kind)
  const uses = countUses(data, kind, name)

  // A name in use is not deletable: dropping it from the picker while entries
  // still reference it would leave data no longer explicable by the UI.
  if (uses > 0) {
    window.alert(
      `“${name}” is used by ${uses} logged ${uses === 1 ? 'entry' : 'entries'}, so it cannot be deleted.\n\n` +
        `Delete those entries first, or keep the ${label}.`,
    )
    return null
  }
  if (minRemaining && listChoices(data, kind).length <= minRemaining) {
    window.alert(`At least one ${label} has to remain.`)
    return null
  }
  if (!window.confirm(`Delete the ${label} “${name}”?`)) return null
  return removeChoice(data, kind, name)
}

// Callers must check countUses() first — this does not guard, so that the
// refusal and its explanation live in one place.
export function removeChoice(data, kind, name) {
  const k = KINDS[kind]
  const isDefault = k.defaults.includes(name)
  return {
    ...data,
    [k.customKey]: (data[k.customKey] ?? []).filter((n) => n !== name),
    [k.hiddenKey]: isDefault ? [...new Set([...(data[k.hiddenKey] ?? []), name])] : (data[k.hiddenKey] ?? []),
  }
}
