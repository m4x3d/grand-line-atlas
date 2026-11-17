import { ARCS, ISLANDS, CAST, CODES, LAP, SAIL, TARAI, inArc, where, locate, known, setLimit, LIMIT } from './data.js'
import { makeAtlas, charRect, glyph, SHIP, DOT } from './sprites.js'
import { DECAL } from './decals.js'
import { initGPU, OFF } from './gpu.js'
import { initGL } from './gl.js'

const $ = s => document.querySelector(s)
const cv = $('canvas'), panel = $('#panel'), card = $('#card'), when = $('#when')
const atlas = makeAtlas(CAST)
const gpu = await initGPU(cv, atlas) ?? initGL(cv, atlas)   // WebGPU first, WebGL2 if there is no adapter
if (!gpu) { $('#nogpu').hidden = false; throw new Error('no WebGPU or WebGL2') }
document.documentElement.style.setProperty('--atlas', `url(${atlas.toDataURL()})`)

const { U, INST } = gpu
const SEAS = [['East Blue', 640, 60], ['South Blue', 640, 1100], ['North Blue', 1840, 60], ['West Blue', 1840, 1100],
  ['Paradise', 180, 478], ['New World', 1420, 470], ['Calm Belt', 300, 430], ['Calm Belt', 300, 770], ['Red Line', 1240, 280], ['Red Line', 40, 900]]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const SUNNY = CODES.indexOf('g')   // the arc where the Sunny replaces the Merry
// Legs the crew did not sail on their own ship: to Enies Lobby they rode the sea train Rocketman (ch. 366) while Iceburg's
// repaired Merry followed alone, and the way back the Merry broke apart and Galley-La took them home (ch. 430).
const NO_SAIL = ['f', 'g'].map(c => CODES.indexOf(c))
// What a character is up to while the story is not looking, guessed from their affiliation (cast files can override it).
const AWAY = [
  [/Whitebeard Pirates|Red Hair|Big Mom|Beasts Pirates|Donquixote Pirates|Germa|Mink|Scabbards|Kozuki|Wano|Elbaph/, 'somewhere in the New World'],
  [/Five Elders|World Noble|Holy Knights|sovereign/, 'in the Holy Land Mary Geoise'],
  [/CP9|CP0/, 'on a mission for the World Government'],
  [/(?<!ex-)Warlord/, 'at large as a Warlord of the Sea'],
  [/Marines/, 'on duty with the Marines'],
  [/Revolutionary/, 'with the Revolutionary Army'],
]
const lap = d => d - LAP * Math.round(d / LAP)   // shortest way around the globe

ISLANDS.forEach((s, i) => {
  s.ext = s.r * (s.special === 4 ? 1.3 : 1)      // painted islands fill their whole square
  U.set([s.x, s.y, s.r, s.seed], OFF.isl + i * 4)
  U.set(DECAL[s.id] ?? s.cols, OFF.col + i * 4)
  U.set([s.dens, s.special], OFF.ext + i * 4)
})

U.set(TARAI, OFF.tarai)

// Spoiler guard. An island exists once a stop the reader knows plays on it or shows someone there (or no stop ever does).
const FIRST = new Map(ISLANDS.map(s => [s, Math.min(...ARCS.filter(a => a.isl === s || CAST.some(c => c.at[a.i] === s)).map(a => a.reveal)) % Infinity || 0]))
const seenIsl = s => FIRST.get(s) <= LIMIT
let K = []   // the stops the reader may see, in timeline order
// finished voyage arcs and their last chapter, for the guard's arc picker (the running arc has no end yet)
const READ = ARCS.filter(a => !a.past && /^\d+-\d+/.test(a.ch)).map(a => [a.name, +a.ch.match(/-(\d+)/)[1]])
function guard(n) {
  setLimit(n)
  try { n > 0 ? localStorage.setItem('upto', n) : localStorage.removeItem('upto') } catch {}
  ISLANDS.forEach((s, i) => U[OFF.isl + i * 4 + 1] = seenIsl(s) ? s.y : -1e4)   // unseen islands sink far off the map
  K = ARCS.filter(a => known(a.i)).map(a => a.i)
  when.max = K.length - 1
  const past = K.filter(i => i < SAIL).length
  $('#era-past').hidden = !past; $('#era-past').style.flex = past; $('#era-now').style.flex = K.length - past
  $('#names').innerHTML = FIND().map(x => `<option value="${x.name}">`).join('')
}
const nearestStop = i => K.reduce((b, k) => Math.abs(k - i) < Math.abs(b - i) ? k : b)   // the closest stop the reader may see
const step = d => setArc(K[clamp(K.indexOf(arc) + d, 0, K.length - 1)])

// S = screen px per sprite pixel. The terrain is drawn at half that resolution, cam.z is in terrain px per world unit.
let arc = 0, sailedLegs = 0, placed = [], hits = [], hover = null, sel = null, ship = null, n = 0, W = 0, H = 0, S = 1, drag = null, mouse = [-9, -9]
const cam = { x: 640, y: 500, z: .3 }, tgt = { ...cam }
// zoomed out at most to one lap of the globe and to the height from the northernmost to the southernmost Blue island
const minZ = () => Math.max(W / 2 / LAP, H / 2 / 1150)   // y 25-1175: the islands span 74-1038, plus room for labels and the timeline
const near = x => cam.x + lap(x - cam.x)         // the copy of a world x that is closest to the camera

// Luffy's route from Dawn Island as dotted legs. Each leg is drawn like a pen stroke: the heading sways in a gentle wave,
// and on a few legs it turns once all the way round, which curls the line into a round loop. The stroke is then rotated
// and scaled so it ends on the next island, and the first variant that keeps clear of the islands in between wins.
// Points are [x, y, hidden under an island].
const LOOPS = ['longring', 'thriller', 'punk']   // ponytail: hand-picked, the legs into these islands curl once
const STOPS = [ISLANDS[0], ...ARCS.filter(a => a.only).map(a => a.isl)]
const VIA = { 'marineford amazon': [[1060, 790]] }   // out of the Tarai Current, through the Calm Belt below Impel Down
function leg(a, b, k, before) {   // before: earlier legs between the same two islands, not to be crossed
  const dx = lap(b.x - a.x), dy = b.y - a.y, len = Math.hypot(dx, dy)
  const m = Math.ceil(len), r = LOOPS.includes(b.id) ? Math.min(8, len * .05) : 0, w = 2 * Math.PI * r / len * 1.15
  const stroke = (amp, phase, at) => {
    let x = 0, y = 0
    const q = [[0, 0]]
    for (let j = 1; j <= m; j++) {
      const s = (j - .5) / m, th = amp * Math.sin(2 * Math.PI * s + phase) + (r ? 2 * Math.PI * ease((s - at) / w) : 0)
      q.push([x += Math.cos(th), y += Math.sin(th)])
    }
    const [ex, ey] = q[m], e2 = ex * ex + ey * ey, kx = (dx * ex + dy * ey) / e2, ky = (dy * ex - dx * ey) / e2   // (dx, dy) / end, as complex numbers
    return q.map(([x, y]) => [a.x + x * kx - y * ky, a.y + x * ky + y * kx])
  }
  const dist = (p, s) => Math.hypot(lap(p[0] - s.x), p[1] - s.y)
  const free = p => dist(p, a) > a.ext * 1.3 && dist(p, b) > b.ext * 1.3   // away from both ends
  const ring = [a, b].every(s => ['enies', 'impel', 'marineford'].includes(s.id))   // a ride on the Tarai Current itself
  const cross = (p, q, o, r) => {   // do segments pq and or intersect?
    const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    return d(p, q, o) * d(p, q, r) < 0 && d(o, r, p) * d(o, r, q) < 0
  }
  const apart = pts => before.every(o => pts.every((p, i) => i === 0 || !free(p) || o.every((q, j) => j === 0 || !cross(pts[i - 1], p, o[j - 1], q))))
  const clear = pts => pts.every(p => ISLANDS.every(s => s === a || s === b || dist(p, s) > s.ext * 1.25 + 3) &&
    (ring || !free(p) || Math.hypot(lap(p[0] - TARAI[0]), p[1] - TARAI[1]) > TARAI[2] - 2)) &&   // keep out of the Tarai Current
    apart(pts)   // and never cross the way there
  const flip = k % 2 ? 1 : -1, tries = []
  for (const amp of [.35, .5, .2, .7, 1, 1.3, 1.7, 2.1]) for (const phase of [...before.length ? [0, Math.PI, Math.PI / 2] : [Math.PI / 2, 0, Math.PI], Math.PI / 4, -Math.PI / 4, Math.PI * .75, -Math.PI * .75]) for (const at of [.35, .55, .45]) tries.push([amp * flip, phase, at], [-amp * flip, phase, at])
  const pts = tries.reduce((hit, t) => hit ?? (p => clear(p) ? p : null)(stroke(...t)), null) ?? (console.warn('route fallback', a.id, b.id), stroke(.35 * flip, Math.PI / 2, .4))
  return pts
}
const ease = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x)
const blur = pts => pts.map((p, i) => i < 4 || i > pts.length - 5 ? p : [0, 1].map(c => pts.slice(i - 4, i + 5).reduce((t, q) => t + q[c], 0) / 9))
const LEGS = []
STOPS.slice(1).forEach((b, k) => {
  const a = STOPS[k], before = LEGS.filter((_, i) => [STOPS[i], STOPS[i + 1]].every(s => s === a || s === b))
  if (a === b) return LEGS.push([])
  const hops = [a, ...(VIA[`${a.id} ${b.id}`] ?? []).map(([x, y]) => ({ x, y, ext: 0 })), b]
  let pts = hops.slice(1).flatMap((h, i) => leg(hops[i], h, k + i, before).slice(i ? 1 : 0))
  for (let n = 0; n < (hops.length > 2 ? 6 : 0); n++) pts = blur(pts)   // round off the turn at a waypoint
  LEGS.push(pts.map(p => [...p, ISLANDS.some(s => Math.hypot(lap(p[0] - s.x), p[1] - s.y) < s.r * 1.1)]))
})
const LEN = LEGS.map(pts => pts.reduce((t, p, i) => i ? t + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0))
const along = (pts, d) => {   // the point d along a leg, and which way it heads
  for (let j = 1; j < pts.length; j++) {
    const [x0, y0] = pts[j - 1], [x1, y1] = pts[j], l = Math.hypot(x1 - x0, y1 - y0)
    if (d <= l || j === pts.length - 1) return [x0 + (x1 - x0) * Math.min(1, d / l), y0 + (y1 - y0) * Math.min(1, d / l), x1 - x0]
    d -= l
  }
}
let voyage = null   // the ship under way on the newest leg: { leg, t0, ms, free: the user moved the camera meanwhile }

// Every character stands where the story last saw them at the selected point in time.
function place() {
  const groups = new Map()
  for (const c of CAST) {
    const { isl, shown } = locate(c, arc)
    if (!shown) continue
    if (!groups.has(isl)) groups.set(isl, [])
    groups.get(isl).push(c)
  }
  placed = []
  // a staggered grid; k = 2 for giants, who need twice the room and fill wide rows instead
  const lay = (cast, k) => {
    const cols = k > 1 ? Math.min(cast.length, 5) : Math.ceil(Math.sqrt(cast.length * 1.6))   // giants: rows of up to five
    return cast.map((c, i) => ({ c, row: i / cols | 0, dx: (i % cols - (cols - 1) / 2 + ((i / cols | 0) & 1) * .5 - .25) * 5.4 * k }))
  }
  for (const [isl, cast] of groups) {
    const mid = isl.y + 3 - (isl.special === 4 ? isl.r * .5 : 0)   // on deck, on the elephant's back
    const small = lay(cast.filter(c => !c.giant), 1), big = lay(cast.filter(c => c.giant), 2)
    const rows = small.length && small.at(-1).row + 1, bigRows = big.length && big.at(-1).row + 1
    for (const p of small) placed.push({ c: p.c, isl, x: isl.x + p.dx, y: mid + (p.row - (rows - 1) / 2) * 6.8 })
    // giants get their own rows behind everybody else, so they never hide anyone
    const back = rows ? mid - (rows - 1) / 2 * 6.8 - 6.8 : mid + (bigRows - 1) / 2 * 13.6   // feet of the front giant row
    for (const p of big) placed.push({ c: p.c, isl, x: isl.x + p.dx, y: back - (bigRows - 1 - p.row) * 13.6 })
  }
  placed.sort((a, b) => a.y - b.y)
  const sailed = ARCS.slice(0, arc + 1)
  sailedLegs = sailed.filter(a => a.only).length
  const a = sailed.findLast(a => a.only && a.only !== 'L')                  // the ship waits while Luffy is alone
  ship = a && { isl: a.isl, rect: a.i < SUNNY ? SHIP.merry : SHIP.sunny }   // nobody has set sail in the past
}

const sprScale = c => (cam.z >= 6 ? 2 : 1) * (c.giant ? 2 : 1)
const pos = c => `background-position:-${charRect(c.id)[0]}px -${charRect(c.id)[1]}px`
const who = c => {
  const at = inArc(c, arc) && where(c, arc) !== ARCS[arc].isl ? `<span class="dim">${where(c, arc).name}</span>` : ''
  return `<button class="who" data-c="${c.id}"><i class="spr" style="${pos(c)}"></i>${c.name}${at}</button>`
}
const chip = a => `<button class="chip${a.i === arc ? ' on' : ''}${a.past ? ' old' : ''}" data-arc="${a.i}">${a.name}</button>`
const when_ = a => a.past ? `<span class="tag">Flashback</span> ${a.ch}` : `${a.saga} Saga · chapters ${a.ch}`
const WIKI = { Road: 'Road (Giant)', Sphinx: 'Sphinx (Location)' }   // where the wiki title is not just the name without "Saint"
const wiki = x => `<a class="wiki" target="_blank" rel="noopener" href="https://onepiece.fandom.com/wiki/${encodeURI((WIKI[x.name] ?? x.name.replace(/^Saint /, '')).replaceAll(' ', '_'))}">One Piece Wiki ↗</a>`
const back = () => `<h3>Now</h3><button class="chip">Back to ${ARCS[arc].name}</button>`

// Why a character is or is not on the map right now, and the nearest chapters where they can be found
function status(c) {
  const { prev, next, dead, home, isl, shown } = locate(c, arc)
  const spot = a => `${chip(ARCS[a])} on ${where(c, a).name}`
  const away = c.join > arc ? 'has not joined the Straw Hats yet' : c.away || AWAY.find(([re]) => re.test(c.crew.split(', later')[0]))?.[1]
  const why = dead ? `Dies during ${ARCS[c.dies].name}.`
    : shown && prev === arc ? `On the map now, on ${where(c, arc).name}.`
    : home ? `Back home on ${isl.name}.`
    : shown ? `Still where the story last saw them, on ${isl.name}.`
    : `Not on the map right now${away ? `: ${away}` : ''}.`
  return `<p class="note${shown ? '' : ' off'}">${why}</p>
    ${prev >= 0 && prev !== arc ? `<p>Last seen: ${spot(prev)}</p>` : ''}${next >= 0 ? `<p>Next seen: ${spot(next)}</p>` : ''}`
}

function flyTo(x, y, z) {
  // keep the target clear of the panel: beside it on desktop, above it on mobile where it sits at the bottom
  const wide = innerWidth > 760, below = wide ? 0 : (innerHeight - card.getBoundingClientRect().top) / 2
  Object.assign(tgt, { x: near(x) + (wide ? 165 / S / z / 2 : 0), y: y + below / S / z / 2, z })
}
// Gold ticks above the slider: every stop on the timeline that involves the selected island or character
let selIsl = null
function marks(stops) {
  $('#marks').innerHTML = stops.map(i => `<button data-arc="${i}" title="${ARCS[i].name}" style="left:${K.indexOf(i) / (K.length - 1) * 100}%"></button>`).join('')
}
function showArc() {
  sel = selIsl = null
  marks([])
  const a = ARCS[arc]
  panel.innerHTML = `<h2>${a.name}</h2><div class="dim">${when_(a)} · ${a.isl.name}</div><p>${a.text}</p>
    <h3>Characters in this arc</h3>${CAST.filter(c => inArc(c, arc)).map(who).join('')}
    <h3>Spoiler guard</h3><label class="dim">I have read up to <select id="upto-arc"><option value="">everything</option>${READ.map(([name, end]) =>
      `<option value="${end}"${end === LIMIT ? ' selected' : ''}>the end of ${name}</option>`).join('')}</select></label>
    <label class="dim">or chapter <input id="upto" type="number" min="1" inputmode="numeric" placeholder="all" value="${LIMIT < Infinity ? LIMIT : ''}"></label>`
  card.scrollTop = 0
}
function showChar(c) {
  sel = c; selIsl = null
  marks(ARCS.filter(a => inArc(c, a.i)).map(a => a.i))
  panel.innerHTML = `<i class="spr big" style="${pos(c)}"></i><h2>${c.name}</h2>
    ${c.epithet ? `<div class="dim">"${c.epithet}"</div>` : ''}${wiki(c)}<p>${LIMIT < Infinity ? c.crew.split(', later')[0] : c.crew}</p>
    ${c.fruit ? `<h3>Devil Fruit</h3><p>${c.fruit}</p>` : ''}
    <h3>Where</h3>${status(c)}
    <h3>Appears in</h3>${ARCS.filter(a => inArc(c, a.i)).map(chip).join('')}${back()}`
  card.scrollTop = 0
}
function showIsland(s) {
  sel = null; selIsl = s
  // everything that happens here: arcs set on the island, and arcs where somebody is shown here while the story is elsewhere
  const events = ARCS.map(a => ({ a, cast: CAST.filter(c => inArc(c, a.i) && where(c, a.i) === s) })).filter(e => e.a.isl === s || e.cast.length)
  marks(events.map(e => e.a.i))
  const row = ({ a, cast }) => `<div class="ev">${chip(a)}<span class="dim">${a.past ? a.ch : `ch. ${a.ch}`}</span>
    <div class="dim">${cast.slice(0, 4).map(c => c.name).join(', ')}${cast.length > 4 ? ` +${cast.length - 4}` : ''}</div></div>`
  const here = placed.filter(p => p.isl === s).map(p => who(p.c)).join('')
  panel.innerHTML = `<h2>${s.name}</h2>${wiki(s)}${s.note ? `<p>${s.note}</p>` : ''}
    <h3>On the timeline</h3>${events.map(row).join('') || '<p class="dim">Nothing in the story is shown here.</p>'}
    <h3>Here now</h3>${here || '<p class="dim">Nobody at this point of the story.</p>'}${back()}`
  card.scrollTop = 0
}
function focusChar(c) {
  if (voyage) voyage.free = true
  const p = placed.find(p => p.c === c)
  showChar(c)   // when they are not on the map, the card says why and where to find them
  if (p) flyTo(p.x, p.y, Math.max(tgt.z, 4))
}
function focusIsland(s) {
  if (voyage) voyage.free = true
  showIsland(s)
  flyTo(s.x, s.y, Math.max(tgt.z, clamp(100 / s.ext, 2.6, 4)))
}
const isCrewNow = c => c.join !== undefined && inArc(c, arc)
// Fit every island that holds a Straw Hat into the part of the screen the panel leaves free
function frameCrew() {
  const at = placed.filter(p => isCrewNow(p.c)).map(p => p.isl), xs = at.map(s => s.x), ys = at.map(s => s.y)
  const span = v => Math.max(...v) - Math.min(...v) + 120, mid = v => (Math.max(...v) + Math.min(...v)) / 2
  const free = innerWidth > 760 ? innerWidth - 330 : innerWidth
  flyTo(mid(xs), mid(ys), Math.min(free / span(xs), (innerHeight - 90) / span(ys)) / S / 2)
}
function flyArc(a) {
  if (a.wide) frameCrew()
  else flyTo(a.isl.x, a.isl.y, clamp(100 / a.isl.ext, 2.6, 4))
}
function setArc(i, fly = true) {
  arc = nearestStop(i)
  const a = ARCS[arc], legs = sailedLegs, was = ship
  when.value = K.indexOf(arc)
  $('#arc').innerHTML = `<b>${a.name}</b> <span class="dim">${a.past ? a.ch : `${a.saga} Saga · ch. ${a.ch}`}</span>`
  document.body.classList.toggle('past', a.past)   // sepia map and timeline while in a flashback
  history.replaceState(null, '', '#' + CODES[arc])
  place()
  showArc()
  // one leg further and the ship is aboard, from where it waited to where it is now: it sails while the camera shows the
  // whole leg, then lands. Not after a leg Luffy went alone (Rusukaina to Sabaody: the Sunny never left Sabaody) or one in NO_SAIL.
  voyage = sailedLegs === legs + 1 && !NO_SAIL.includes(arc) && was?.isl === STOPS[legs] && ship?.isl === STOPS[sailedLegs] ? { leg: legs, t0: performance.now(), ms: 1200 + LEN[legs] * 5, free: !fly } : null
  if (voyage) {
    const xs = LEGS[legs].map(p => p[0]), ys = LEGS[legs].map(p => p[1]), mid = v => (Math.max(...v) + Math.min(...v)) / 2
    const span = v => Math.max(...v) - Math.min(...v) + 80, free = innerWidth > 760 ? innerWidth - 330 : innerWidth
    if (fly) flyTo(mid(xs), mid(ys), Math.min(3, free / span(xs), (innerHeight - 90) / span(ys)) / S / 2)
  } else if (fly) flyArc(a)
}

// Sprite instances: world anchor, offset in sprite px, atlas rect, integer scale, hop phase (-1 = still), tint
function push(wx, wy, ox, oy, rect, scale = 1, phase = -1, tint = 0) {
  if (n < INST.length / 12) INST.set([near(wx), wy, ox, oy, ...rect, scale, 1, phase, tint], n++ * 12)
}
function text(str, wx, wy, oy = 0, tint = 0) {
  const s = ` ${str.toUpperCase()} `
  ;[...s].forEach((ch, i) => push(wx, wy, i * 8 - s.length * 4, oy, glyph(ch), 2, -1, tint))
}
const pick = () => hits.findLast(([x, y, w, h]) => mouse[0] >= x && mouse[0] < x + w && mouse[1] >= y && mouse[1] < y + h)?.[4] ?? null

function frame(ms) {
  S = Math.max(1, Math.round(innerWidth / 1280))
  const w = 2 * Math.ceil(innerWidth / S / 2), h = 2 * Math.ceil(innerHeight / S / 2)
  if (w !== W || h !== H) { cv.width = W = w; cv.height = H = h }
  tgt.z = clamp(tgt.z, minZ(), 9)
  // keep the view between the same top and bottom edges as the furthest zoom, so the Blues never drift to the middle
  const keepY = (y, z) => clamp(y, 25 + H / 4 / z, 1175 - H / 4 / z)
  tgt.y = keepY(tgt.y, tgt.z)
  for (const k of 'xyz') cam[k] += (tgt[k] - cam[k]) * .12
  cam.y = keepY(cam.y, cam.z)
  const z = cam.z, z2 = z * 2
  const sx = x => Math.floor(near(x) * z2) - Math.floor(cam.x * z2) + W / 2
  const sy = y => Math.floor(y * z2) - Math.floor(cam.y * z2) + H / 2

  n = 0; hits = []
  // the route sailed so far as dots that drift forward, newest leg in gold
  const gap = 6 / z, drift = ms / 1000 * .5 % 1 * gap
  const p = voyage ? Math.min(1, (performance.now() - voyage.t0) / voyage.ms) : 1, e = ease(p)
  LEGS.slice(0, sailedLegs).forEach((pts, i) => {
    let at = drift, walked = 0
    const end = voyage?.leg === i ? e * LEN[i] : Infinity   // drawn only as far as the ship has sailed
    for (let j = 1; j < pts.length; j++) {
      const [x0, y0, hid] = pts[j - 1], [x1, y1] = pts[j], d = Math.hypot(x1 - x0, y1 - y0)
      for (; at < d && walked + at < end; at += gap) {
        const x = x0 + (x1 - x0) * at / d, y = y0 + (y1 - y0) * at / d
        if (!hid && Math.abs(lap(x - cam.x)) * z2 < W / 2 + 3 && Math.abs(y - cam.y) * z2 < H / 2 + 3) push(x, y, -1, -1, DOT, 1, -1, i === sailedLegs - 1 ? 1 : 0)
      }
      at -= d; walked += d
    }
  })
  if (z < 1.1) for (const [name, x, y] of SEAS) text(name, x, y)
  const cur = ARCS[arc].isl
  for (const s of ISLANDS) if (seenIsl(s) && (z >= .75 || s === cur)) text(s.name, s.x, s.y + s.ext + 3, 0, s === cur ? 1 : 0)
  if (z >= .75) text('Tarai Current', TARAI[0], TARAI[1] - 12)   // above the island names on the ring
  const k = z >= 6 ? 2 : 1
  if (ship) {
    const dock = s => [s.x - s.ext - 5, s.y + s.r * .5]   // where the ship waits beside an island
    let [x, y] = dock(ship.isl), east = false
    if (voyage) {   // on the way: follow the leg, sliding from one dock to the other, bow first (the sprite faces west)
      const [lx, ly, dx] = along(LEGS[voyage.leg], e * LEN[voyage.leg]), a = STOPS[voyage.leg]
      const u = 1 - ease(e / .15), v = ease((e - .85) / .15)   // off the dock at the start, onto the next one at the end, on the line between
      x = lx + (dock(a)[0] - a.x) * u + (x - ship.isl.x) * v; y = ly + (dock(a)[1] - a.y) * u + (y - ship.isl.y) * v
      east = dx > 0
      if (p === 1) { if (!voyage.free) flyArc(ARCS[arc]); voyage = null }
    }
    push(x, y, -32 * k, -58 * k, east ? [ship.rect[0] + 128, ...ship.rect.slice(1)] : ship.rect, k, 0)
  }
  const pins = ARCS[arc].wide && z < 1.6   // zoomed out on the timeskip: the scattered Straw Hats stay visible as named pins
  if (z >= 1.6 || pins) {
    for (const p of placed) {
      if (pins && !isCrewNow(p.c)) continue
      const s = sprScale(p.c)
      push(p.x, p.y, -16 * s, -41 * s, charRect(p.c.id), s, p.c.id * .37 % 1, p === hover || p.c === sel ? 2 : 0)
      hits.push([sx(p.x) - 12 * s, sy(p.y) - 41 * s, 24 * s, 41 * s, p])
      if (pins && p !== hover) text(p.c.name.split(' ').pop(), p.x, p.y, -41 * s - 18)
    }
    if (hover) text(hover.c.name, hover.x, hover.y, -41 * sprScale(hover.c) - 18, 1)
  } else hover = null

  U.set([cam.x, cam.y, z, ms / 1000, W / 2, H / 2, ISLANDS.length])
  gpu.draw(n)
  requestAnimationFrame(frame)
}

const toWorld = ([mx, my]) => [cam.x + (mx - W / 2) / cam.z / 2, cam.y + (my - H / 2) / cam.z / 2]
// zoom by f, keeping the world point under screen point `from` under screen point `to`
function zoomAt(from, to, f) {
  const [wx, wy] = toWorld(from)
  tgt.z = clamp(tgt.z * f, minZ(), 9)
  tgt.x = wx - (to[0] - W / 2) / tgt.z / 2; tgt.y = wy - (to[1] - H / 2) / tgt.z / 2
}
const touches = new Map()   // pointers currently down, for pinch zoom
const pinch = () => {
  const [[ax, ay], [bx, by]] = touches.values()
  return { d: Math.hypot(ax - bx, ay - by), m: [(ax + bx) / 2 / S, (ay + by) / 2 / S] }
}
cv.onpointerdown = e => {
  if (voyage) voyage.free = true
  touches.set(e.pointerId, [e.clientX, e.clientY])
  drag = { x: e.clientX, y: e.clientY, moved: touches.size > 1 ? 99 : 0 }   // a pinch is never a tap
  cv.setPointerCapture(e.pointerId)
}
cv.onpointermove = e => {
  mouse = [e.clientX / S, e.clientY / S]
  if (touches.size === 2 && touches.has(e.pointerId)) {
    const a = pinch(); touches.set(e.pointerId, [e.clientX, e.clientY]); const b = pinch()
    zoomAt(a.m, b.m, b.d / a.d); Object.assign(cam, tgt)   // follow the fingers without easing
    return
  }
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY
    tgt.x = cam.x -= dx / S / cam.z / 2; tgt.y = cam.y -= dy / S / cam.z / 2
  }
  hover = pick()
  cv.style.cursor = hover ? 'pointer' : drag ? 'grabbing' : 'grab'
}
cv.onpointerup = cv.onpointercancel = e => {
  touches.delete(e.pointerId)
  mouse = [e.clientX / S, e.clientY / S]
  if (touches.size) {   // one finger of a pinch lifted: keep dragging with the other
    const [x, y] = touches.values().next().value
    drag = { x, y, moved: 99 }
    return
  }
  if (e.type === 'pointerup' && drag && drag.moved < 5) {
    const p = pick(), [wx, wy] = toWorld(mouse)
    const s = ISLANDS.find(s => seenIsl(s) && Math.hypot(lap(s.x - wx), s.y - wy) < s.ext * 1.1)
    if (p) showChar(p.c)
    else if (s) focusIsland(s)
  }
  drag = null
}
cv.addEventListener('wheel', e => {
  if (voyage) voyage.free = true
  e.preventDefault()
  const m = [e.clientX / S, e.clientY / S]
  zoomAt(m, m, Math.exp(-e.deltaY * .0015))   // zoom towards the cursor
}, { passive: false })

$('#fold').onclick = e => {
  const min = card.classList.toggle('min')
  Object.assign(e.target, { textContent: min ? '+' : '–', ariaLabel: `${min ? 'Expand' : 'Shrink'} the info card`, ariaExpanded: !min })
}
panel.onchange = e => { if (e.target.id.startsWith('upto')) { guard(+e.target.value); setArc(arc, false) } }
panel.onclick = $('#marks').onclick = e => {
  const b = e.target.closest('button')
  if (!b) return
  if (b.dataset.arc) {   // following a character or an island through time keeps their card open
    const c = sel, s = selIsl
    setArc(+b.dataset.arc)
    if (c) focusChar(c)
    else if (s) focusIsland(s)
  }
  else if (b.dataset.c) focusChar(CAST[b.dataset.c])
  else setArc(arc)   // "Back to …": the stop's card and its island again
}
$('#prev').onclick = () => { play(false); step(-1) }
$('#next').onclick = () => { play(false); step(1) }
// Play the story: one stop after another, waiting for the ship to land
let playing = null
function play(on) {
  clearTimeout(playing); playing = null
  $('#play').textContent = on ? '❚❚' : '▶'; $('#play').ariaLabel = on ? 'Pause' : 'Play the story'
  if (!on) return
  if (arc === K.at(-1)) setArc(SAIL)
  const tick = () => {
    if (arc === K.at(-1)) return play(false)
    step(1)
    playing = setTimeout(tick, (voyage?.ms ?? 0) + 2500)
  }
  playing = setTimeout(tick, 1500)
}
$('#play').onclick = () => play(!playing)
$('#world').onclick = () => Object.assign(tgt, { y: 600, z: 0 })
$('#era-past').onclick = () => { play(false); setArc(K[0]) }
$('#era-now').onclick = () => { play(false); setArc(SAIL) }
when.oninput = () => { play(false); setArc(K[+when.value]) }
// characters first, so a shared name finds the person; only who and what the reader has met
const FIND = () => [...CAST.filter(c => ARCS.some(a => inArc(c, a.i))), ...ISLANDS.filter(seenIsl)]
$('#clear').onclick = () => { $('#find').value = ''; $('#find').focus() }
$('#find').onchange = e => {
  const q = e.target.value.trim().toLowerCase()
  const all = FIND(), hit = q && (all.find(x => x.name.toLowerCase() === q) ?? all.find(x => x.name.toLowerCase().includes(q)))
  if (hit) hit.look ? focusChar(hit) : focusIsland(hit)
}
onkeydown = e => {
  if (e.target.matches('input')) return
  if (e.key === 'ArrowLeft') { play(false); step(-1) }
  if (e.key === 'ArrowRight') { play(false); step(1) }
}

let saved = 0
try { saved = +localStorage.getItem('upto') } catch {}
guard(saved)
setArc(location.hash[1] && CODES.includes(location.hash[1]) ? CODES.indexOf(location.hash[1]) : SAIL)
requestAnimationFrame(frame)
