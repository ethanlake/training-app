// What the app knows about exercises, including how barbell weight is entered
// versus stored.
//
// Barbell lifts are logged the way they are loaded: the weight on ONE end of the
// bar. What gets stored is always the true total (2 × per-side + bar), because
// `weight` feeds PRs and total volume in stats.js — storing a per-side
// number there would quietly halve every strength figure. Per-side is a display
// and input concern, derived on the way in and out.

// Ordered by how often they get logged, not alphabetically — the first chip
// should usually be the right one.
export const DEFAULT_EXERCISES = [
  'deadlift',
  'bench press',
  'pullup',
  'block pull',
  'front squat',
  'overhead press',
  'split squats',
  'bicep curl',
]

export const BAR_WEIGHT = 45

const BARBELL = new Set(['deadlift', 'bench press', 'front squat', 'overhead press'])

// Custom exercises are treated as plain weights; there is no way to know
// whether a name someone typed is loaded on a bar.
export const isBarbell = (exercise) => BARBELL.has(exercise)

export const totalFromSide = (perSide) => 2 * Number(perSide) + BAR_WEIGHT

export const sideFromTotal = (total) => (Number(total) - BAR_WEIGHT) / 2

// Trim the pointless ".0" that 2w + 45 produces for whole plates.
export const num = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10))

// "115 (275 tot)" for barbell lifts, plain "60" for everything else. A stored
// total at or below the bar cannot be a per-side load, so it renders plain
// rather than showing a nonsensical zero or negative.
export function formatWeight(exercise, total) {
  if (!isBarbell(exercise) || Number(total) <= BAR_WEIGHT) return num(Number(total))
  return `${num(sideFromTotal(total))} (${num(Number(total))} tot)`
}
