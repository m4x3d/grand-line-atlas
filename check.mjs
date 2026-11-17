// node check.mjs - fails if the hand-written data tables are inconsistent
import assert from 'node:assert/strict'
import { ARCS, ISLANDS, CAST, CODES, TARAI, inArc, where, locate } from './data.js'
const at = ch => CODES.indexOf(ch)
import { PAL } from './sprites.js'

assert(ISLANDS.length <= 60 && ARCS.filter(a => a.only).length + 1 <= 35, 'shader holds 60 islands and 35 route points')
assert.equal(ARCS.length, CODES.length)
assert.equal(ARCS.findIndex(a => !a.past), at('0'), 'the past comes first')
for (const a of ARCS) {
  assert(a.isl, `${a.name}: unknown island`)
  assert(CAST.some(c => inArc(c, a.i)), `${a.name}: nobody appears`)
}
assert.equal(new Set(CAST.map(c => c.name)).size, CAST.length, 'duplicate character')
assert(CAST.length <= 320, 'atlas holds 320 characters')
for (const c of CAST) {
  assert(c.arcs.length && c.arcs.every(a => a >= 0), `${c.name}: bad arc code`)
  assert.deepEqual(c.arcs, [...c.arcs].sort((a, b) => a - b), `${c.name}: arcs out of order`)
  assert(c.dies === undefined || c.dies === c.arcs.at(-1), `${c.name}: seen after death`)
  assert(c.look.length >= 7, `${c.name}: look too short`)
  for (const i of [0, 1, 4, 5, 6]) assert(PAL[c.look[i]] || (i === 4 && c.look[i] === '0'), `${c.name}: colour '${c.look[i]}' at ${i}`)
  assert(/^\d[\dV]$/.test(c.look.slice(2, 4)), `${c.name}: hair/hat must be digits`)
  assert(/^[cCPROYVDBbumlgnNMETsG]*$/.test(c.look.slice(7)), `${c.name}: unknown extra in '${c.look}'`)
}
const crew = a => CAST.filter(c => c.join !== undefined && inArc(c, a)).map(c => c.key).join('')
assert.equal(crew(at('0')), 'LZ')
assert.equal(CAST.filter(c => c.join !== undefined && inArc(c, at('j')) && where(c, at('j')).id === 'amazon').length, 1)   // Amazon Lily: Luffy alone, the rest scattered
assert.equal(crew(at('s')), 'LNSCBJ')     // Whole Cake Island team (Jinbe listed explicitly)
assert.equal(crew(at('t')), '')           // Levely: no Straw Hats
assert.equal(crew(at('w')), 'LZNUSCRFBJ')
for (const s of ISLANDS) {   // the current's ring passes through its three islands and keeps clear of every other shore
  const gap = Math.abs(Math.hypot(s.x - TARAI[0], s.y - TARAI[1]) - TARAI[2])
  assert(['enies', 'impel', 'marineford'].includes(s.id) ? gap < .01 : gap > s.r * 1.45 + 5, `Tarai Current touches ${s.name}`)
}
for (const a of ISLANDS) for (const b of ISLANDS) {
  assert(a === b || Math.hypot(a.x - b.x, a.y - b.y) > (a.r + b.r) * 1.15, `${a.name} overlaps ${b.name}`)
}
const skip = at('x'), away = CAST.filter(c => c.join !== undefined && inArc(c, skip))   // the timeskip: nine Straw Hats on nine different islands
assert.equal(away.length, 9)
assert.equal(new Set(away.map(c => where(c, skip))).size, 9)
const wb = CAST.find(c => c.name === 'Edward Newgate'), seen = ch => locate(wb, at(ch))
assert.deepEqual([seen('a').shown, seen('a').prev, seen('a').next], [false, at('D'), at('g')])   // Alabasta: off the map, God Valley behind, Sphinx ahead
assert(seen('l').shown && seen('h').shown && !seen('m').shown && seen('m').dead)                // on the map from Sphinx to Marineford, then dead
assert(!locate(CAST.find(c => c.name === 'Shanks'), at('0')).shown, 'flashback positions must not carry into the voyage')
console.log(`ok: ${CAST.length} characters, ${ARCS.length} arcs, ${ISLANDS.length} islands`)
