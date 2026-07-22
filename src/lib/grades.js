// Grade scales and ordinal helpers. Boulders are stored as the integer V-grade;
// sport routes as the YDS suffix string ('11c'), whose ordinal comes from SPORT_GRADES.

export const BOULDER_GRADES = [4, 5, 6, 7, 8, 9, 10, 11, 12]

export const SPORT_GRADES = [
  '10a', '10b', '10c', '10d',
  '11a', '11b', '11c', '11d',
  '12a', '12b', '12c', '12d',
  '13a', '13b', '13c', '13d',
]

export const DEFAULT_BOULDER_TAGS = ['power', 'dynamic', 'slab', 'coordo', 'moon', 'tension']

export const ROUTE_TAGS = ['indoor', 'outdoor']

export const formatBoulder = (grade) => `V${grade}`

export const formatSport = (grade) => `.${grade}`

export const boulderOrdinal = (grade) => BOULDER_GRADES.indexOf(grade)

export const sportOrdinal = (grade) => SPORT_GRADES.indexOf(grade)

// Median of an ordinal list, rounded down to a real grade rather than interpolated.
export function medianBy(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}
