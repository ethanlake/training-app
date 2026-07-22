// End-to-end verification. Drives a real Chrome against a running dev or preview
// server, entirely through ARIA roles and visible text, so it stays valid across
// refactors — and would still validate the app if it were rewritten without React.
//
//   npm run dev &&  npm run verify
//   APP_URL=http://localhost:4173/training-app/ npm run verify   # production build
//
// Screenshots land in tests/.artifacts/ (gitignored) for eyeballing after a run.

import { chromium } from 'playwright-core'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SHOTS = resolve(HERE, '.artifacts')
mkdirSync(SHOTS, { recursive: true })

const URL = process.env.APP_URL ?? 'http://localhost:5173/training-app/'

// playwright-core ships no browser of its own; borrow the system Chrome.
const CHROME =
  process.env.CHROME_PATH ??
  [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync)

if (!CHROME) {
  console.error('No Chrome found. Set CHROME_PATH to a Chrome or Chromium binary.')
  process.exit(1)
}

const browser = await chromium.launch({ channel: 'chrome', executablePath: CHROME })

const errors = []
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

// Sequential dialog answers: true = OK, false = Cancel, string = prompt text.
let dialogQueue = []
let lastDialog = ''
page.on('dialog', async (d) => {
  lastDialog = d.message()
  const next = dialogQueue.shift()
  if (next === false || next === undefined) return d.dismiss()
  return d.accept(typeof next === 'string' ? next : undefined)
})

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const ok = []
const fail = []
const check = (name, cond, extra = '') =>
  (cond ? ok : fail).push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)

await page.goto(URL, { waitUntil: 'networkidle' })

// ---- climbing session ------------------------------------------------------
await page.getByRole('button', { name: 'power', exact: true }).click()
await page.getByRole('button', { name: 'moon', exact: true }).click()
for (const g of ['V6', 'V6', 'V7', 'V8', 'V5']) {
  await page.getByRole('button', { name: g, exact: true }).first().click()
}
// custom tag via prompt()
dialogQueue = ['compression']
await page.getByRole('button', { name: 'Add custom tag' }).click()
await page.getByRole('button', { name: 'V9', exact: true }).first().click()

check('custom tag persisted', await page.getByRole('button', { name: 'compression', exact: true }).isVisible())

// sport route, behind the Boulders/Sport sub-toggle
await page.getByRole('button', { name: 'Sport', exact: true }).click()
await page.locator('select').first().selectOption('11c')
await page.getByRole('button', { name: 'outdoor', exact: true }).click()
await page.getByRole('button', { name: 'Add', exact: true }).click()
check('boulder grid hidden in sport mode', !(await page.getByRole('button', { name: 'V7', exact: true }).isVisible()))
check('route logged', await page.locator('li button', { hasText: '.11c' }).isVisible())
await page.getByRole('button', { name: 'Boulders', exact: true }).click()
check('grid back in boulder mode', await page.getByRole('button', { name: 'V7', exact: true }).isVisible())

const climbNotes = 'Felt strong on overhangs, tweaky left ring finger.'
await page.locator('textarea').fill(climbNotes)
await page.locator('textarea').blur()

await page.screenshot({ path: `${SHOTS}/desktop-climb.png` })

// ---- lifting session -------------------------------------------------------
await page.getByRole('button', { name: 'Lift', exact: true }).first().click()
await page.getByRole('button', { name: 'deadlift', exact: true }).click()
// barbell lifts are entered per side; 115 a side + the 45 lb bar = 275 total
check('barbell field asks for per side', (await page.getByRole('spinbutton', { name: 'Per side (lb)' }).count()) === 1)
await page.getByRole('spinbutton', { name: 'Per side (lb)' }).fill('115')
await page.getByRole('spinbutton', { name: 'Reps' }).fill('5')
check('running total shown while typing', await page.getByText(/275 lb total/).isVisible())
await page.getByRole('button', { name: '8', exact: true }).click()
await page.getByRole('button', { name: 'Add set' }).click()
await page.getByRole('button', { name: 'Add set' }).click()
await page.getByRole('button', { name: 'bench press', exact: true }).click()
await page.getByRole('spinbutton', { name: 'Per side (lb)' }).fill('70')
await page.getByRole('spinbutton', { name: 'Reps' }).fill('8')
await page.getByRole('button', { name: 'Add set' }).click()
await page.locator('textarea').fill('Bar speed good.')
await page.locator('textarea').blur()
await page.screenshot({ path: `${SHOTS}/desktop-lift.png` })

// ---- reload & persistence --------------------------------------------------
await page.reload({ waitUntil: 'networkidle' })
const after = await page.evaluate(() => JSON.parse(localStorage.getItem('training-app/v1')))
const climb = after.sessions.find((s) => s.type === 'climb')
const lift = after.sessions.find((s) => s.type === 'lift')
check('6 boulders persisted', climb?.boulders.length === 6, `got ${climb?.boulders.length}`)
check('tags on boulder', JSON.stringify(climb?.boulders[0].tags) === '["power","moon"]', JSON.stringify(climb?.boulders[0].tags))
check('custom tag on V9', climb?.boulders[5].tags.includes('compression'), JSON.stringify(climb?.boulders[5].tags))
check('route persisted', climb?.routes.length === 1 && climb.routes[0].grade === '11c')
check('route tags', JSON.stringify(climb?.routes[0].tags) === '["indoor","outdoor"]', JSON.stringify(climb?.routes[0].tags))
check('climb notes persisted', climb?.notes === climbNotes, JSON.stringify(climb?.notes))
check('3 sets persisted', lift?.sets.length === 3, `got ${lift?.sets.length}`)
check('per-side entry stored as the true total', lift?.sets[0].weight === 275, String(lift?.sets[0].weight))
check('bench stored as total', lift?.sets[2].weight === 185, String(lift?.sets[2].weight))
check('set prefill worked', lift?.sets[1].weight === 275 && lift.sets[1].reps === 5)
check('lift notes persisted', lift?.notes === 'Bar speed good.')

// the requested read-out: per side, with the total in parentheses
await page.getByRole('button', { name: 'Lift', exact: true }).first().click()
await page.waitForTimeout(200)
check('barbell set reads "w (x tot)"', await page.getByText('115 (275 tot)').first().isVisible())
check('bench set reads "w (x tot)"', await page.getByText('70 (185 tot)').first().isVisible())
// prefill must come back down to per-side, not re-enter the total: the default
// chip after a reload is deadlift, whose last set was stored as 275
check(
  'prefill converts the total back to per side',
  (await page.getByRole('spinbutton', { name: 'Per side (lb)' }).inputValue()) === '115',
  await page.getByRole('spinbutton', { name: 'Per side (lb)' }).inputValue(),
)
// a non-barbell lift keeps a plain field and a plain read-out
await page.getByRole('button', { name: 'pullup', exact: true }).click()
await page.waitForTimeout(150)
check('non-barbell field stays plain', (await page.getByRole('spinbutton', { name: 'Weight (lb)' }).count()) === 1)
// an exercise with no history shows empty boxes, not suggested numbers
check(
  'no placeholder numbers on an unlogged exercise',
  (await page.getByRole('spinbutton', { name: 'Weight (lb)' }).getAttribute('placeholder')) === null &&
    (await page.getByRole('spinbutton', { name: 'Reps' }).getAttribute('placeholder')) === null,
)
check('no total hint for non-barbell', (await page.getByText(/lb total/).count()) === 0)
await page.getByRole('spinbutton', { name: 'Weight (lb)' }).fill('25')
await page.getByRole('spinbutton', { name: 'Reps' }).fill('6')
await page.getByRole('button', { name: 'Add set' }).click()
await page.waitForTimeout(200)
const pullup = await page.evaluate(
  () =>
    JSON.parse(localStorage.getItem('training-app/v1'))
      .sessions.filter((s) => s.type === 'lift')
      .flatMap((s) => s.sets)
      .find((x) => x.exercise === 'pullup'),
)
check('non-barbell weight stored as typed', pullup?.weight === 25, String(pullup?.weight))
check('non-barbell set reads plain', await page.getByText('25 × 6').first().isVisible())
// remove it again so later counts stay predictable
await page.getByText('25 × 6').first().click()
await page.waitForTimeout(200)

// ---- deleting tags and exercises -------------------------------------------
// Long-press (or right-click) a chip to remove it; anything already used by a
// logged entry must refuse, or the data would reference something the picker
// can no longer explain.
const chip = (name) => page.getByRole('button', { name, exact: true })

await page.getByRole('button', { name: 'Lift', exact: true }).first().click()
await page.waitForTimeout(150)

dialogQueue = []
await chip('deadlift').click({ button: 'right' })
await page.waitForTimeout(200)
check('in-use exercise refused', /cannot be deleted/.test(lastDialog), lastDialog.split('\n')[0])
check('refusal names the entry count', /used by 2 logged entries/.test(lastDialog), lastDialog.split('\n')[0])
check('refused exercise still listed', (await chip('deadlift').count()) === 1)

dialogQueue = [true]
await chip('bicep curl').click({ button: 'right' })
await page.waitForTimeout(250)
check('unused exercise deleted', (await chip('bicep curl').count()) === 0)
check(
  'deletion persisted as hidden',
  (await page.evaluate(() => JSON.parse(localStorage.getItem('training-app/v1')).hiddenExercises)).includes(
    'bicep curl',
  ),
)

// re-adding the same name brings a built-in back
dialogQueue = ['bicep curl']
await page.getByRole('button', { name: 'Add custom exercise' }).click()
await page.waitForTimeout(250)
check('re-adding un-hides a built-in', (await chip('bicep curl').count()) === 1)
check(
  'un-hidden name not duplicated as custom',
  (await page.evaluate(() => JSON.parse(localStorage.getItem('training-app/v1')).customExercises)).length === 0,
)

// tags behave the same way
await page.getByRole('button', { name: 'Climb', exact: true }).first().click()
await page.waitForTimeout(150)
dialogQueue = []
await chip('compression').click({ button: 'right' })
await page.waitForTimeout(200)
check('in-use tag refused', /cannot be deleted/.test(lastDialog), lastDialog.split('\n')[0])
check('refused tag still listed', (await chip('compression').count()) === 1)

dialogQueue = [true]
await chip('slab').click({ button: 'right' })
await page.waitForTimeout(250)
check('unused tag deleted', (await chip('slab').count()) === 0)
dialogQueue = ['slab']
await page.getByRole('button', { name: 'Add custom tag' }).click()
await page.waitForTimeout(250)
check('deleted tag can be added back', (await chip('slab').count()) === 1)

// a real long-press must not also toggle the chip it was held on
const dyn = chip('dynamic')
const wasOn = (await dyn.getAttribute('class')).includes('chip-on')
dialogQueue = [false] // cancel the delete
await dyn.hover()
await page.mouse.down()
await page.waitForTimeout(700)
await page.mouse.up()
await page.waitForTimeout(250)
check('long-press offers deletion', /Delete the tag/.test(lastDialog), lastDialog)
check('cancelled delete keeps the tag', (await dyn.count()) === 1)
check(
  'long-press does not toggle the chip',
  (await dyn.getAttribute('class')).includes('chip-on') === wasOn,
)

// The real target is a touchscreen, where Android also fires its own
// contextmenu mid-hold — one hold must still produce exactly one dialog.
let dialogCount = 0
const countDialogs = () => (dialogCount += 1)
page.on('dialog', countDialogs)
dialogQueue = [false]
const box2 = await dyn.boundingBox()
const at = { clientX: box2.x + box2.width / 2, clientY: box2.y + box2.height / 2, pointerType: 'touch' }
await dyn.dispatchEvent('pointerdown', at)
await page.waitForTimeout(700)
await dyn.dispatchEvent('contextmenu', at) // what Android does on its own
await dyn.dispatchEvent('pointerup', at)
await page.waitForTimeout(250)
page.off('dialog', countDialogs)
check('touch hold offers deletion', /Delete the tag/.test(lastDialog), lastDialog)
check('one hold opens exactly one dialog', dialogCount === 1, `${dialogCount} dialogs`)

// ---- back-dating -----------------------------------------------------------
// Tapping the date opens a native picker; picking an older day retargets every
// write on the tab, so a forgotten session can be filled in after the fact.
const backDate = await page.evaluate(() => {
  const d = new Date()
  d.setDate(d.getDate() - 3)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})
await page.getByRole('button', { name: 'Climb', exact: true }).first().click()
await page.waitForTimeout(150)
const dateInput = page.getByLabel('Change date').first()
check('date input capped at today', (await dateInput.getAttribute('max')) === todayStr())
await dateInput.fill(backDate)
await page.waitForTimeout(200)
check('back-dated day starts empty', (await page.locator('li button').count()) === 0)

await page.getByRole('button', { name: 'V4', exact: true }).first().click()
await page.waitForTimeout(200)
const dated = await page.evaluate(
  (d) => JSON.parse(localStorage.getItem('training-app/v1')).sessions.find((s) => s.date === d),
  backDate,
)
check('boulder written to the chosen date', dated?.boulders?.length === 1, JSON.stringify(dated?.date))
check(
  "today's session untouched by the back-fill",
  (await page.evaluate(
    (d) => JSON.parse(localStorage.getItem('training-app/v1')).sessions.find((s) => s.date === d && s.type === 'climb')
      .boulders.length,
    todayStr(),
  )) === 6,
)

// the date carries across tabs, so one back-fill covers a climb and a lift
await page.getByRole('button', { name: 'Lift', exact: true }).first().click()
await page.waitForTimeout(150)
check(
  'chosen date carries to the Lift tab',
  (await page.getByLabel('Change date').first().inputValue()) === backDate,
)

// and "Today" returns without hunting through the calendar
await page.getByRole('button', { name: 'Today', exact: true }).click()
await page.waitForTimeout(200)
check('Today button resets the date', (await page.getByLabel('Change date').first().inputValue()) === todayStr())
check('no Today button on today', (await page.getByRole('button', { name: 'Today', exact: true }).count()) === 0)

// a back-dated day must not survive a relaunch as the silent default
await page.reload({ waitUntil: 'networkidle' })
check('date resets to today on launch', (await page.getByLabel('Change date').first().inputValue()) === todayStr())

// clean up so later session counts stay predictable
await page.evaluate((d) => {
  const KEY = 'training-app/v1'
  const data = JSON.parse(localStorage.getItem(KEY))
  data.sessions = data.sessions.filter((s) => s.date !== d)
  localStorage.setItem(KEY, JSON.stringify(data, null, 2))
}, backDate)
await page.reload({ waitUntil: 'networkidle' })

// ---- storage durability ----------------------------------------------------
// Installed PWAs get persistent storage on request; without asking, Android and
// Chrome may evict the whole store under pressure. Chrome refuses the grant to
// an automated, uninstalled context no matter what, so what is testable here is
// that the app asks and reports the answer truthfully — the grant itself is on
// the manual on-device list.
const persisted = await page.evaluate(() => navigator.storage?.persisted?.() ?? null)
check('persistence API wired up', typeof persisted === 'boolean', String(persisted))

// ---- seed backdated sessions -----------------------------------------------
await page.evaluate(() => {
  const KEY = 'training-app/v1'
  const d = JSON.parse(localStorage.getItem(KEY))
  const uid = () => Math.random().toString(36).slice(2, 10)
  const iso = (daysAgo) => {
    const x = new Date()
    x.setDate(x.getDate() - daysAgo)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  }
  const tags = ['power', 'dynamic', 'slab', 'coordo', 'moon', 'tension']
  for (let w = 1; w <= 30; w++) {
    const date = iso(w * 7 + 1)
    const base = 4 + Math.floor((30 - w) / 6)
    d.sessions.push({
      id: uid(),
      type: 'climb',
      date,
      boulders: Array.from({ length: 5 + (w % 4) }, (_, i) => ({
        id: uid(),
        grade: Math.min(12, base + (i % 3)),
        tags: [tags[(w + i) % tags.length]],
      })),
      routes: w % 3 === 0 ? [{ id: uid(), grade: ['11a', '11c', '12a'][w % 3], tags: ['indoor'] }] : [],
      notes: w === 1 ? 'Last week: felt flat.' : '',
    })
    d.sessions.push({
      id: uid(),
      type: 'lift',
      date: iso(w * 7 + 3),
      sets: [
        { id: uid(), exercise: 'deadlift', weight: 205 + (30 - w) * 2, reps: 5, rpe: 8 },
        { id: uid(), exercise: 'bench press', weight: 135 + (30 - w), reps: 5, rpe: 7 },
      ],
      notes: '',
    })
  }
  localStorage.setItem(KEY, JSON.stringify(d, null, 2))
})
await page.reload({ waitUntil: 'networkidle' })

// ---- analysis --------------------------------------------------------------
await page.getByRole('button', { name: 'Analysis', exact: true }).first().click()
await page.waitForTimeout(200)
const readStat = async (label) =>
  (await page.locator('dt', { hasText: new RegExp(`^${label}$`, 'i') }).locator('..').locator('dd').innerText()).trim()

const monthBoulders = await readStat('Boulders')
await page.screenshot({ path: `${SHOTS}/desktop-analysis.png`, fullPage: true })

await page.getByRole('button', { name: 'All', exact: true }).click()
await page.waitForTimeout(200)
const allBoulders = await readStat('Boulders')
check('window switch changes stats', Number(allBoulders) > Number(monthBoulders), `month=${monthBoulders} all=${allBoulders}`)
check('streak computed', Number(await readStat('Week streak')) > 1, await readStat('Week streak'))
check('hardest grade shown', /^V\d+$/.test(await readStat('Hardest')), await readStat('Hardest'))
// volume and 1RM must be computed from true totals, never per-side entries
const volume = Number((await readStat('Volume \\(lb\\)')).replace(/,/g, ''))
const expectedVolume = await page.evaluate(() =>
  JSON.parse(localStorage.getItem('training-app/v1'))
    .sessions.filter((s) => s.type === 'lift')
    .flatMap((s) => s.sets)
    .reduce((acc, x) => acc + x.weight * x.reps, 0),
)
check('volume uses the total on the bar', volume === expectedVolume, `${volume} vs ${expectedVolume}`)

const bars = await page.locator('svg polyline').count()
check('line charts rendered', bars >= 2, `${bars} polylines`)
await page.screenshot({ path: `${SHOTS}/desktop-analysis-all.png`, fullPage: true })

await page.getByRole('button', { name: 'Week', exact: true }).click()
await page.waitForTimeout(200)
const weekBoulders = await readStat('Boulders')
check('week window narrower than all', Number(weekBoulders) < Number(allBoulders), `week=${weekBoulders}`)

// ---- session log & detail --------------------------------------------------
await page.getByRole('button', { name: 'Log', exact: true }).click()
await page.waitForTimeout(150)
const rows = await page.locator('li button').count()
check('log lists sessions', rows > 50, `${rows} rows`)
await page.screenshot({ path: `${SHOTS}/desktop-log.png` })

// open the backdated climb session that has notes
await page.getByText('Last week: felt flat.').click()
await page.waitForTimeout(150)
check('detail shows notes', await page.getByText('Last week: felt flat.').isVisible())
const entriesBefore = await page.locator('ul li').count()
await page.getByRole('button', { name: 'Edit', exact: true }).click()
await page.locator('button[aria-label="Delete entry"]').first().click()
await page.waitForTimeout(150)
const entriesAfter = await page.locator('ul li').count()
check('detail entry delete works', entriesAfter === entriesBefore - 1, `${entriesBefore} -> ${entriesAfter}`)
await page.screenshot({ path: `${SHOTS}/desktop-detail.png` })

const sessionsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('training-app/v1')).sessions.length)
dialogQueue = [true]
await page.getByRole('button', { name: 'Delete session' }).click()
await page.waitForTimeout(200)
const sessionsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('training-app/v1')).sessions.length)
check('session delete works', sessionsAfter === sessionsBefore - 1, `${sessionsBefore} -> ${sessionsAfter}`)
await page.getByRole('button', { name: 'Done', exact: true }).click()

// ---- Android back gesture --------------------------------------------------
// The hardware/gesture back button is a history pop. Overlays must be history
// entries, or back quits the app instead of closing what is open.
await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForTimeout(150)
check('settings overlay opened', await page.getByText(/Safety copy|Backup/i).first().isVisible())
await page.goBack()
await page.waitForTimeout(200)
check('back closes the settings overlay', (await page.getByRole('button', { name: 'Export JSON' }).count()) === 0)
check('app still alive after back', await page.getByRole('heading', { name: 'Training' }).isVisible())

// two layers deep: detail -> list -> app
await page.getByRole('button', { name: 'Log', exact: true }).click()
await page.waitForTimeout(150)
await page.locator('li button').first().click() // any session; the notes one was deleted above
await page.waitForTimeout(200)
check('session detail opened', (await page.getByRole('button', { name: 'Delete session' }).count()) === 1)
await page.goBack()
await page.waitForTimeout(200)
check('back closes detail first', (await page.getByRole('button', { name: 'Delete session' }).count()) === 0)
check('back leaves the log open', (await page.locator('li button').count()) > 10)
await page.goBack()
await page.waitForTimeout(200)
check('second back closes the log', (await page.getByRole('button', { name: 'Log', exact: true }).count()) === 1)

// ---- export / import round trip --------------------------------------------
const before = await page.evaluate(() => localStorage.getItem('training-app/v1'))
await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForTimeout(150)
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export JSON' }).click(),
])
const exportPath = `${SHOTS}/export.json`
await download.saveAs(exportPath)
const exported = readFileSync(exportPath, 'utf8')
check('export matches storage byte-for-byte', exported === before, `${exported.length} vs ${before.length}`)

// the nag: stale before the first export, gone right after
const dot = () => page.locator('button[aria-label^="Settings"] span').count()
check('export marked as recent', (await page.getByText(/Exported today/)).isVisible())
await page.getByRole('button', { name: 'Done', exact: true }).click()
check('no dot right after exporting', (await dot()) === 0)
await page.evaluate(() => localStorage.removeItem('training-app/last-export'))
await page.reload({ waitUntil: 'networkidle' })
check('dot appears when never exported', (await dot()) === 1)
await page.evaluate(() => {
  const old = new Date()
  old.setDate(old.getDate() - 45)
  localStorage.setItem('training-app/last-export', old.toISOString())
})
await page.reload({ waitUntil: 'networkidle' })
check('dot appears when export is 45 days old', (await dot()) === 1)
await page.evaluate(() => localStorage.setItem('training-app/last-export', new Date().toISOString()))
await page.reload({ waitUntil: 'networkidle' })
check('no dot when export is fresh', (await dot()) === 0)

// simulate a fresh device: clear the store out from under the app
await page.evaluate(() => localStorage.removeItem('training-app/v1'))
await page.reload({ waitUntil: 'networkidle' })
const wiped = await page.evaluate(
  () => JSON.parse(localStorage.getItem('training-app/v1') ?? '{"sessions":[]}').sessions.length,
)
check('starts empty on a fresh device', wiped === 0, `${wiped} sessions`)
await page.getByRole('button', { name: 'Settings' }).click()
await page.waitForTimeout(150)
check('no wipe button', (await page.getByRole('button', { name: /wipe/i }).count()) === 0)

// import: first dialog = merge? -> Cancel, second = replace? -> OK
dialogQueue = [false, true]
await page.locator('input[type=file]').setInputFiles(exportPath)
await page.waitForTimeout(300)
const restored = await page.evaluate(() => localStorage.getItem('training-app/v1'))
check('re-import is a byte-identical round trip', restored === before, `${restored?.length} vs ${before.length}`)

// With data now in place, a replace-import of a DIFFERENT file must stash what
// it overwrites. Build that file by dropping a session from the export.
const trimmed = JSON.parse(exported)
trimmed.sessions = trimmed.sessions.slice(1)
const trimmedPath = `${SHOTS}/export-trimmed.json`
writeFileSync(trimmedPath, JSON.stringify(trimmed, null, 2))

const liveBefore = await page.evaluate(() => localStorage.getItem('training-app/v1'))
dialogQueue = [false, true]
await page.locator('input[type=file]').setInputFiles(trimmedPath)
await page.waitForTimeout(300)

const snap = await page.evaluate(() => JSON.parse(localStorage.getItem('training-app/v1.backup')))
check('import wrote a safety copy', snap?.raw === liveBefore, JSON.stringify(snap?.reason))
check('safety copy names its reason', /import/.test(snap?.reason ?? ''), snap?.reason)
check('safety copy offered in Settings', await page.getByText(/Safety copy/i).isVisible())
const liveCount = () => page.evaluate(() => JSON.parse(localStorage.getItem('training-app/v1')).sessions.length)
check('import actually replaced the data', (await liveCount()) === trimmed.sessions.length, `${await liveCount()}`)

// restore must be reversible: the copy goes live, what was live becomes the copy
dialogQueue = [true]
await page.getByRole('button', { name: 'Restore this copy' }).click()
await page.waitForTimeout(300)
const liveAfter = await page.evaluate(() => localStorage.getItem('training-app/v1'))
const snapAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('training-app/v1.backup')))
check('restore brought the old data back', JSON.parse(liveAfter).sessions.length === JSON.parse(liveBefore).sessions.length)
check('restore is itself reversible', JSON.parse(snapAfter.raw).sessions.length === trimmed.sessions.length)
check('storage state reported', await page.getByText(/sessions ·/).isVisible())
// the protection line must agree with what the browser actually says
const persistedNow = await page.evaluate(() => navigator.storage.persisted())
check(
  'storage protection reported honestly',
  await page.getByText(persistedNow ? /^Protected —/ : /Not protected\./).isVisible(),
  `persisted=${persistedNow}`,
)
await page.screenshot({ path: `${SHOTS}/desktop-settings.png` })
await page.getByRole('button', { name: 'Done', exact: true }).click()

// ---- mobile viewport -------------------------------------------------------
const mobile = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  storageState: await ctx.storageState(),
})
const mp = await mobile.newPage()
mp.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`))
await mp.goto(URL, { waitUntil: 'networkidle' })
await mp.evaluate((blob) => localStorage.setItem('training-app/v1', blob), before)
await mp.reload({ waitUntil: 'networkidle' })
await mp.screenshot({ path: `${SHOTS}/mobile-climb.png` })

const bottomBar = mp.locator('nav.fixed')
check('bottom bar visible on mobile', await bottomBar.isVisible())
const box = await bottomBar.locator('button').first().boundingBox()
check('tab target >= 44px', box.height >= 44, `${box.height}px`)
const scrollW = await mp.evaluate(() => document.documentElement.scrollWidth)
check('no horizontal overflow (mobile)', scrollW <= 375, `${scrollW}px`)

await mp.getByRole('button', { name: 'Lift', exact: true }).last().click()
await mp.waitForTimeout(150)
// the last set of the default exercise should be loaded into the fields, not
// merely hinted at, so "Add set" is usable on arrival
// deadlift is the default chip, so the field is the per-side one
check('inputs prefilled from history', (await mp.getByRole('spinbutton', { name: 'Per side (lb)' }).inputValue()) !== '')
check('Add set enabled on arrival', await mp.getByRole('button', { name: 'Add set' }).isEnabled())
await mp.getByRole('button', { name: 'bicep curl', exact: true }).click()
await mp.waitForTimeout(100)
check(
  'switching to an unlogged exercise clears the fields',
  (await mp.getByRole('spinbutton', { name: 'Weight (lb)' }).inputValue()) === '',
)
await mp.getByRole('button', { name: 'deadlift', exact: true }).click()
await mp.waitForTimeout(100)
await mp.screenshot({ path: `${SHOTS}/mobile-lift.png` })
await mp.getByRole('button', { name: 'Analysis', exact: true }).last().click()
await mp.waitForTimeout(250)
await mp.screenshot({ path: `${SHOTS}/mobile-analysis.png`, fullPage: true })
const scrollW2 = await mp.evaluate(() => document.documentElement.scrollWidth)
check('no horizontal overflow (analysis)', scrollW2 <= 375, `${scrollW2}px`)

// dark mode
const dark = await browser.newContext({
  viewport: { width: 375, height: 812 },
  deviceScaleFactor: 2,
  colorScheme: 'dark',
})
const dp = await dark.newPage()
await dp.goto(URL, { waitUntil: 'networkidle' })
await dp.evaluate((blob) => localStorage.setItem('training-app/v1', blob), before)
await dp.reload({ waitUntil: 'networkidle' })
await dp.screenshot({ path: `${SHOTS}/mobile-dark.png` })

// exercise chip order
await page.getByRole('button', { name: 'Lift', exact: true }).first().click()
await page.waitForTimeout(150)
const chipOrder = await page
  .locator('section', { has: page.locator('h2', { hasText: 'EXERCISE' }) })
  .locator('button')
  .allInnerTexts()
check(
  'exercise order',
  chipOrder.slice(0, 6).join(',') ===
    'deadlift,bench press,pullup,front squat,overhead press,split squats',
  chipOrder.join(','),
)

// theme toggle
const htmlClass = () => page.evaluate(() => document.documentElement.className)
const startDark = (await htmlClass()).includes('dark')
await page.getByRole('button', { name: /Switch to (light|dark) mode/ }).click()
await page.waitForTimeout(150)
check('theme toggle flips the class', (await htmlClass()).includes('dark') !== startDark)
check(
  'theme choice persisted',
  ['light', 'dark'].includes(await page.evaluate(() => localStorage.getItem('training-app/theme'))),
)
await page.reload({ waitUntil: 'networkidle' })
check('theme survives reload', (await htmlClass()).includes('dark') !== startDark)
await page.screenshot({ path: `${SHOTS}/desktop-toggled.png` })

check('no console errors', errors.length === 0, errors.join(' | '))

console.log([...ok, ...fail].join('\n'))
console.log(`\n${ok.length} passed, ${fail.length} failed`)
await browser.close()
process.exit(fail.length ? 1 : 0)
