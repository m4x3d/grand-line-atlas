import { ARCS, ISLANDS, CAST, CODES, LAP, SAIL, TARAI, inArc, where, locate } from './data.js'
import { makeAtlas, charRect, glyph, SHIP } from './sprites.js'
import { DECAL } from './decals.js'
import { initGPU, OFF } from './gpu.js'
import { initGL } from './gl.js'

const $ = s => document.querySelector(s)
const cv = $('canvas'), panel = $('#panel'), when = $('#when')
const atlas = makeAtlas(CAST)
const gpu = await initGPU(cv, atlas) ?? initGL(cv, atlas)   // WebGPU first, WebGL2 if there is no adapter
if (!gpu) { $('#nogpu').hidden = false; throw new Error('no WebGPU or WebGL2') }
document.documentElement.style.setProperty('--atlas', `url(${atlas.toDataURL()})`)

const { U, INST } = gpu
const SEAS = [['East Blue', 640, 60], ['South Blue', 640, 1100], ['North Blue', 1840, 60], ['West Blue', 1840, 1100],
  ['Paradise', 180, 478], ['New World', 1420, 470], ['Calm Belt', 300, 430], ['Calm Belt', 300, 770], ['Red Line', 1240, 280], ['Red Line', 40, 900]]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const SUNNY = CODES.indexOf('g')   // the arc where the Sunny replaces the Merry
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

// S = screen px per sprite pixel. The terrain is drawn at half that resolution, cam.z is in terrain px per world unit.
let arc = 0, placed = [], hits = [], hover = null, sel = null, ship = null, n = 0, W = 0, H = 0, S = 1, drag = null, mouse = [-9, -9]
const cam = { x: 640, y: 500, z: .3 }, tgt = { ...cam }
const near = x => cam.x + lap(x - cam.x)         // the copy of a world x that is closest to the camera

// Every character stands where the story last saw them at the selected point in time.
function place() {
  const groups = new Map()
  for (const c of CAST) {
    const { prev, shown } = locate(c, arc)
    if (!shown) continue
    const isl = where(c, prev)
    if (!groups.has(isl)) groups.set(isl, [])
    groups.get(isl).push(c)
  }
  placed = []
  for (const [isl, cast] of groups) {
    const cols = Math.ceil(Math.sqrt(cast.length * 1.6)), rows = Math.ceil(cast.length / cols)
    const top = isl.y + 3 - (isl.special === 4 ? isl.r * .5 : 0)   // on deck, on the elephant's back
    cast.forEach((c, i) => {
      const row = i / cols | 0
      placed.push({ c, isl, x: isl.x + (i % cols - (cols - 1) / 2 + (row & 1) * .5 - .25) * 5.4, y: top + (row - (rows - 1) / 2) * 6.8 })
    })
  }
  placed.sort((a, b) => a.y - b.y)
  const sailed = ARCS.slice(0, arc + 1)
  const pts = [ISLANDS[0], ...sailed.filter(a => a.only).map(a => a.isl)]   // Luffy's route, from Dawn Island
  pts.forEach((p, i) => U.set([p.x, p.y], OFF.route + i * 4))
  U[7] = pts.length
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
const back = () => `<h3>Now</h3><button class="chip">Back to ${ARCS[arc].name}</button>`

// Why a character is or is not on the map right now, and the nearest chapters where they can be found
function status(c) {
  const { prev, next, dead, shown } = locate(c, arc)
  const spot = a => `${chip(ARCS[a])} on ${where(c, a).name}`
  const away = c.join > arc ? 'has not joined the Straw Hats yet' : c.away || AWAY.find(([re]) => re.test(c.crew.split(', later')[0]))?.[1]
  const why = dead ? `Dies during ${ARCS[c.dies].name}.`
    : shown && prev === arc ? `On the map now, on ${where(c, arc).name}.`
    : shown ? `Still where the story last saw them, on ${where(c, prev).name}.`
    : `Not on the map right now${away ? `: ${away}` : ''}.`
  return `<p class="note${shown ? '' : ' off'}">${why}</p>
    ${prev >= 0 && prev !== arc ? `<p>Last seen: ${spot(prev)}</p>` : ''}${next >= 0 ? `<p>Next seen: ${spot(next)}</p>` : ''}`
}

function flyTo(x, y, z) {
  const pad = innerWidth > 760 ? 165 / S / z / 2 : 0   // keep the target clear of the side panel
  Object.assign(tgt, { x: near(x) + pad, y, z })
}
// Gold ticks above the slider: every stop on the timeline that involves the selected island or character
let selIsl = null
function marks(stops) {
  $('#marks').innerHTML = stops.map(i => `<button data-arc="${i}" title="${ARCS[i].name}" style="left:${i / (ARCS.length - 1) * 100}%"></button>`).join('')
}
function showArc() {
  sel = selIsl = null
  marks([])
  const a = ARCS[arc]
  panel.innerHTML = `<h2>${a.name}</h2><div class="dim">${when_(a)} · ${a.isl.name}</div><p>${a.text}</p>
    <h3>Characters in this arc</h3>${CAST.filter(c => inArc(c, arc)).map(who).join('')}`
  panel.scrollTop = 0
}
function showChar(c) {
  sel = c; selIsl = null
  marks(ARCS.filter(a => inArc(c, a.i)).map(a => a.i))
  panel.innerHTML = `<i class="spr big" style="${pos(c)}"></i><h2>${c.name}</h2>
    ${c.epithet ? `<div class="dim">"${c.epithet}"</div>` : ''}<p>${c.crew}</p>
    ${c.fruit ? `<h3>Devil Fruit</h3><p>${c.fruit}</p>` : ''}
    <h3>Where</h3>${status(c)}
    <h3>Appears in</h3>${ARCS.filter(a => inArc(c, a.i)).map(chip).join('')}${back()}`
  panel.scrollTop = 0
}
function showIsland(s) {
  sel = null; selIsl = s
  // everything that happens here: arcs set on the island, and arcs where somebody is shown here while the story is elsewhere
  const events = ARCS.map(a => ({ a, cast: CAST.filter(c => inArc(c, a.i) && where(c, a.i) === s) })).filter(e => e.a.isl === s || e.cast.length)
  marks(events.map(e => e.a.i))
  const row = ({ a, cast }) => `<div class="ev">${chip(a)}<span class="dim">${a.past ? a.ch : `ch. ${a.ch}`}</span>
    <div class="dim">${cast.slice(0, 4).map(c => c.name).join(', ')}${cast.length > 4 ? ` +${cast.length - 4}` : ''}</div></div>`
  const here = placed.filter(p => p.isl === s).map(p => who(p.c)).join('')
  panel.innerHTML = `<h2>${s.name}</h2>${s.note ? `<p>${s.note}</p>` : ''}
    <h3>On the timeline</h3>${events.map(row).join('') || '<p class="dim">Nothing in the story is shown here.</p>'}
    <h3>Here now</h3>${here || '<p class="dim">Nobody at this point of the story.</p>'}${back()}`
  panel.scrollTop = 0
}
function focusChar(c) {
  const p = placed.find(p => p.c === c)
  showChar(c)   // when they are not on the map, the card says why and where to find them
  if (p) flyTo(p.x, p.y, Math.max(tgt.z, 4))
}
function focusIsland(s) {
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
function setArc(i, fly = true) {
  arc = clamp(i, 0, ARCS.length - 1)
  const a = ARCS[arc]
  when.value = arc
  $('#arc').innerHTML = `<b>${a.name}</b> <span class="dim">${a.past ? a.ch : `${a.saga} Saga · ch. ${a.ch}`}</span>`
  document.body.classList.toggle('past', a.past)   // sepia map and timeline while in a flashback
  history.replaceState(null, '', '#' + CODES[arc])
  place()
  showArc()
  if (fly && a.wide) frameCrew()
  else if (fly) flyTo(a.isl.x, a.isl.y, clamp(100 / a.isl.ext, 2.6, 4))
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
  tgt.z = clamp(tgt.z, W / 2 / LAP, 9)           // never show more than one lap of the globe
  tgt.y = clamp(tgt.y, 0, 1200)
  for (const k of 'xyz') cam[k] += (tgt[k] - cam[k]) * .12
  const z = cam.z, z2 = z * 2
  const sx = x => Math.floor(near(x) * z2) - Math.floor(cam.x * z2) + W / 2
  const sy = y => Math.floor(y * z2) - Math.floor(cam.y * z2) + H / 2

  n = 0; hits = []
  if (z < 1.1) for (const [name, x, y] of SEAS) text(name, x, y)
  const cur = ARCS[arc].isl
  for (const s of ISLANDS) if (z >= .75 || s === cur) text(s.name, s.x, s.y + s.ext + 3, 0, s === cur ? 1 : 0)
  if (z >= .75) text('Tarai Current', TARAI[0], TARAI[1])
  const k = z >= 6 ? 2 : 1
  if (ship) push(ship.isl.x - ship.isl.ext - 5, ship.isl.y + ship.isl.r * .5, -32 * k, -58 * k, ship.rect, k, 0)
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

// ponytail: mouse, pen and one-finger drag only. Pinch zoom needs two-pointer tracking, add it if phones matter.
const toWorld = ([mx, my]) => [cam.x + (mx - W / 2) / cam.z / 2, cam.y + (my - H / 2) / cam.z / 2]
cv.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY, moved: 0 }; cv.setPointerCapture(e.pointerId) }
cv.onpointermove = e => {
  mouse = [e.clientX / S, e.clientY / S]
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    drag.moved += Math.abs(dx) + Math.abs(dy); drag.x = e.clientX; drag.y = e.clientY
    tgt.x = cam.x -= dx / S / cam.z / 2; tgt.y = cam.y -= dy / S / cam.z / 2
  }
  hover = pick()
  cv.style.cursor = hover ? 'pointer' : drag ? 'grabbing' : 'grab'
}
cv.onpointerup = e => {
  mouse = [e.clientX / S, e.clientY / S]
  if (drag && drag.moved < 5) {
    const p = pick(), [wx, wy] = toWorld(mouse)
    const s = ISLANDS.find(s => Math.hypot(lap(s.x - wx), s.y - wy) < s.ext * 1.1)
    if (p) showChar(p.c)
    else if (s) focusIsland(s)
  }
  drag = null
}
cv.addEventListener('wheel', e => {
  e.preventDefault()
  const m = [e.clientX / S, e.clientY / S], [wx, wy] = toWorld(m)
  tgt.z = clamp(tgt.z * Math.exp(-e.deltaY * .0015), W / 2 / LAP, 9)
  tgt.x = wx - (m[0] - W / 2) / tgt.z / 2; tgt.y = wy - (m[1] - H / 2) / tgt.z / 2   // zoom towards the cursor
}, { passive: false })

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
  else showArc()
}
$('#prev').onclick = () => setArc(arc - 1)
$('#next').onclick = () => setArc(arc + 1)
$('#world').onclick = () => Object.assign(tgt, { y: 600, z: 0 })
when.max = ARCS.length - 1
$('#era-past').style.flex = SAIL; $('#era-now').style.flex = ARCS.length - SAIL
$('#era-past').onclick = () => setArc(0)
$('#era-now').onclick = () => setArc(SAIL)
when.oninput = () => setArc(+when.value)
const FIND = [...CAST, ...ISLANDS]   // characters first, so a shared name finds the person
$('#names').innerHTML = FIND.map(x => `<option value="${x.name}">`).join('')
$('#find').onchange = e => {
  const q = e.target.value.trim().toLowerCase()
  const hit = q && (FIND.find(x => x.name.toLowerCase() === q) ?? FIND.find(x => x.name.toLowerCase().includes(q)))
  if (hit) hit.look ? focusChar(hit) : focusIsland(hit)
}
onkeydown = e => {
  if (e.target.matches('input')) return
  if (e.key === 'ArrowLeft') setArc(arc - 1)
  if (e.key === 'ArrowRight') setArc(arc + 1)
}

setArc(location.hash[1] && CODES.includes(location.hash[1]) ? CODES.indexOf(location.hash[1]) : SAIL)
requestAnimationFrame(frame)
