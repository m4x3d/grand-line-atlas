// Everything drawn on screen besides the terrain comes from this atlas, built at runtime (zero image bytes).
import { drawDecals } from './decals.js'

export const PAL = {
  k: '#1b1b22', w: '#f5f5f0', s: '#9aa0a8', S: '#555a66', y: '#f2c230', Y: '#f7e08a', o: '#ef7d21', r: '#d8322c',
  m: '#7a1f2b', p: '#f28cb1', v: '#7b4bb3', b: '#2f6fd0', n: '#1f2f5c', c: '#49c4d8', g: '#3fa34d', d: '#1f5c38',
  l: '#a5d63a', t: '#8a5a35', e: '#f3c8a2', a: '#d39a6a', f: '#6a4a3a', u: '#7fb7e6',
}
const FONT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-.'?!:/ "
// 3x5 glyphs, one octal digit per row
const BITS = ('25755 65656 34443 65556 74647 74644 34553 55755 72227 11152 55655 44447 57755 65555 25552 65644 25573 65655 ' +
  '34216 72222 55557 55552 55575 55255 55222 71247 75557 26227 61247 61216 55711 74616 34757 71222 75757 75716 ' +
  "00700 00002 22000 61202 22202 02020 11244 00000").split(' ')

export const SIZE = 1024
export const charRect = i => [i % 32 * 32, (i / 32 | 0) * 42, 32, 42]
export const glyph = ch => [(FONT.indexOf(ch) + 44) % 44 * 4, 432, 4, 7]   // unknown chars fall through to the blank
export const SHIP = { merry: [0, 448, 64, 64], sunny: [64, 448, 64, 64] }

/* look = skin, hair colour, hair style, hat, hat colour, top, bottom, then extras
   hair: 0 bald 1 short 2 long 3 spiky 4 afro 5 pompadour 6 topknot
   hat:  1 straw 2 cap 3 top hat 4 crown 5 horns 6 bandana 7 tricorn 8 hood/helmet 9 fluffy V viking helmet with horns
   extras: c/C/P/R/O/Y/V/D/B white/black/pink/red/orange/yellow/purple/green/navy coat, b beard, u moustache, m crescent moustache,
           l long nose, g shades, n blue nose, N red nose, M bandaged mouth, E animal ears, T fish tail for legs, s sword,
           G giant (drawn at double size by main.js) */
function person(R, [sk, hc, hs, hat, htc, top, bot, ...ex]) {
  const X = c => ex.includes(c), H = (...a) => R(htc, ...a), D = '#0003'
  R('#0006', 7, 38, 18, 1); R('#0006', 9, 39, 14, 1)
  const coat = { c: 'w', C: 'k', P: 'p', R: 'r', O: 'o', Y: 'y', V: 'v', D: 'd', B: 'n' }[ex.find(c => 'cCPROYVDB'.includes(c))]
  if (coat) { R(coat, 5, 19, 22, 17); R(D, 5, 19, 2, 17); R(D, 25, 19, 2, 17) }
  R(bot, 10, 28, 12, 3); R(bot, 10, 31, 5, 6); R(bot, 17, 31, 5, 6); R(D, 14, 31, 1, 6); R(D, 17, 31, 1, 6)
  R('k', 9, 36, 6, 2); R('k', 17, 36, 6, 2)
  R(top, 9, 19, 14, 10); R(top, 6, 19, 3, 7); R(top, 23, 19, 3, 7)
  R(D, 9, 19, 1, 9); R(D, 22, 19, 1, 9); R('#0004', 9, 27, 14, 1); R('#fff3', 11, 20, 4, 1)
  R(sk, 6, 26, 3, 3); R(sk, 23, 26, 3, 3)
  R(sk, 9, 6, 14, 13); R(sk, 8, 8, 16, 9); R(D, 10, 18, 12, 1)
  R('k', 12, 12, 2, 3); R('k', 18, 12, 2, 3); R('w', 12, 12, 1, 1); R('w', 18, 12, 1, 1)
  R('#0006', 14, 16, 4, 1); R('#e0607060', 10, 15, 2, 1); R('#e0607060', 20, 15, 2, 1)
  if (hs > 0) { R(hc, 11, 3, 10, 1); R(hc, 9, 4, 14, 3); R(hc, 8, 6, 16, 4); R(hc, 8, 10, 2, 3); R(hc, 22, 10, 2, 3); R('#fff3', 12, 5, 5, 1) }
  else R('#fff4', 12, 7, 3, 1)
  if (hs == 2) { R(hc, 6, 8, 3, 18); R(hc, 23, 8, 3, 18); R(D, 6, 24, 3, 2); R(D, 23, 24, 3, 2) }
  if (hs == 3) for (const x of [8, 12, 16, 20]) { R(hc, x, 2, 4, 2); R(hc, x + 1, 0, 2, 2) }
  if (hs == 4) { R(hc, 6, 0, 20, 11); R(hc, 3, 2, 26, 7); R('#fff2', 8, 2, 6, 2) }
  if (hs == 5) { R(hc, 12, 0, 12, 5); R(hc, 21, 1, 5, 3); R('#fff3', 14, 1, 6, 1) }
  if (hs == 6) { R(hc, 14, 0, 4, 4); R(hc, 24, 6, 3, 12) }
  if (hat == 1) { H(11, 0, 10, 2); H(9, 1, 14, 5); R('r', 9, 5, 14, 2); H(4, 7, 24, 2); H(6, 6, 20, 1); R(D, 4, 8, 24, 1) }
  if (hat == 2) { H(11, 1, 10, 1); H(9, 2, 14, 6); H(9, 7, 18, 2); R(D, 9, 8, 18, 1) }
  if (hat == 3) { H(10, 0, 12, 7); R('#fff4', 10, 5, 12, 1); H(6, 7, 20, 2) }
  if (hat == 4) { H(9, 4, 14, 3); for (const x of [9, 15, 21]) H(x, 1, 2, 3); H(12, 2, 2, 2); H(18, 2, 2, 2); R('r', 15, 5, 2, 1) }
  if (hat == 5) { H(6, 3, 3, 6); H(5, 0, 2, 4); H(23, 3, 3, 6); H(25, 0, 2, 4) }
  if (hat == 6) { H(9, 3, 14, 1); H(8, 4, 16, 4); H(24, 8, 2, 6) }
  if (hat == 7) { H(9, 0, 14, 4); H(4, 4, 24, 4); H(3, 3, 3, 2); H(26, 3, 3, 2); R('#fff8', 15, 1, 2, 2); R(D, 4, 7, 24, 1) }
  if (hat == 8) { H(9, 1, 14, 1); H(7, 2, 18, 6); H(6, 6, 3, 13); H(23, 6, 3, 13); R(D, 7, 7, 18, 1) }
  if (hat == 9) { H(9, 0, 14, 1); H(7, 1, 18, 6); H(4, 7, 24, 2); for (const [x, y] of [[10, 2], [16, 1], [21, 3]]) R(D, x, y, 2, 2); R(D, 4, 8, 24, 1) }
  if (hat == 'V') {
    const hn = '#efe6cc'
    R(hn, 4, 4, 4, 3); R(hn, 2, 1, 3, 4); R(hn, 2, 0, 2, 1); R(hn, 24, 4, 4, 3); R(hn, 27, 1, 3, 4); R(hn, 28, 0, 2, 1); R(D, 4, 6, 4, 1); R(D, 24, 6, 4, 1)
    H(11, 0, 10, 1); H(9, 1, 14, 3); H(7, 4, 18, 4); R('#fff5', 11, 1, 6, 1); R(D, 7, 7, 18, 1); H(15, 8, 2, 5)
    for (const x of [9, 13, 18, 22]) R('#fff6', x, 5, 1, 1)
  }
  if (X('T')) { R(bot, 12, 31, 8, 3); R(bot, 13, 34, 6, 2); R(bot, 8, 35, 5, 3); R(bot, 19, 35, 5, 3); R(D, 13, 33, 6, 1) }
  if (X('E')) { R(sk, 7, 1, 4, 4); R(sk, 8, 0, 2, 1); R(sk, 21, 1, 4, 4); R(sk, 22, 0, 2, 1); R('#e0607090', 8, 2, 2, 2); R('#e0607090', 22, 2, 2, 2) }
  if (X('b')) { R(hc, 10, 16, 12, 4); R(hc, 12, 20, 8, 2) }
  if (X('u')) { R(hc, 11, 15, 10, 1); R(hc, 10, 16, 3, 2); R(hc, 19, 16, 3, 2) }
  if (X('m')) { R('w', 6, 14, 20, 2); R('w', 5, 11, 2, 4); R('w', 25, 11, 2, 4) }
  if (X('l')) { R(sk, 20, 13, 8, 2); R(D, 20, 14, 8, 1) }
  if (X('g')) { R('k', 10, 11, 12, 3); R('#fff6', 11, 11, 2, 1); R('#fff6', 17, 11, 2, 1) }
  if (X('n')) R('b', 14, 14, 4, 2)
  if (X('N')) R('r', 14, 14, 4, 3)
  if (X('M')) { R('w', 9, 15, 14, 4); R(D, 9, 16, 14, 1); R(D, 9, 18, 14, 1) }
  if (X('s')) { R('s', 28, 8, 2, 19); R('w', 28, 8, 1, 19); R('y', 27, 26, 4, 2); R('t', 28, 28, 2, 4) }
}

// Side view, bow to the left. Going Merry: sheep figurehead. Thousand Sunny: lion, lawn deck, two big sails.
function ship(R, sunny) {
  const D = '#0003', wood = sunny ? 'a' : 't', sail = (x, y, w, h) => {
    R('w', x + 2, y, w - 4, h); R('w', x, y + 2, w, h - 4); R(D, x, y + h - 4, w, 2)
    for (let i = 1; i < 4; i++) R('#0001', x + i * w / 4 | 0, y, 1, h)
  }
  R('#fff8', 5, 58, 54, 2); R('#fff5', 12, 60, 40, 1)
  R(wood, 4, 39, 9, 7); R(wood, 8, 44, 48, 4); R(wood, 10, 48, 44, 4); R('f', 12, 52, 40, 3); R('f', 16, 55, 32, 3)
  R(sunny ? 'r' : 'w', 10, 47, 44, 1); R(D, 10, 51, 44, 1)
  R(wood, 44, 35, 14, 9); R(sunny ? 'y' : 'a', 44, 35, 14, 2); R('Y', 47, 39, 3, 3); R('Y', 52, 39, 3, 3)
  R(sunny ? 'y' : 'a', 8, 42, 48, 2)
  if (sunny) R('g', 14, 41, 28, 1)
  R('w', 24, 34, 14, 8); R(sunny ? 'r' : 'o', 23, 32, 16, 2); R('t', 29, 37, 4, 5); R('c', 34, 36, 2, 2)
  R('f', 30, 3, 3, 31); R('t', 27, 7, 9, 3)
  R('f', 12, 10, 38, 2); sail(12, 12, 38, 19)
  R('k', 27, 18, 9, 6); R('k', 29, 24, 5, 2); R('w', 29, 20, 2, 2); R('w', 33, 20, 2, 2)      // jolly roger
  for (const [x, y] of [[23, 17], [25, 19], [37, 19], [39, 17], [23, 26], [25, 24], [37, 24], [39, 26]]) R('k', x, y, 2, 2)
  R('Y', 25, 16, 13, 2); R('Y', 28, 14, 7, 2); R('r', 28, 15, 7, 1)                            // with a straw hat
  R('k', 33, 0, 10, 6); R('w', 36, 2, 3, 2)
  R('f', 51, 12, 2, 23)
  if (sunny) { R('f', 43, 14, 18, 2); sail(44, 16, 16, 14); R('r', 50, 20, 4, 4) }
  else sail(45, 17, 6, 13)
  if (sunny) {
    R('o', 0, 26, 14, 15); R('o', 2, 24, 10, 19)
    for (const [x, y] of [[0, 24], [12, 24], [0, 41], [12, 41], [6, 22]]) R('o', x, y, 2, 2)
    R('y', 2, 28, 10, 11); R('k', 4, 31, 2, 3); R('k', 8, 31, 2, 3); R('t', 6, 35, 2, 1); R('w', 5, 37, 4, 1)
  } else {
    R('w', 0, 30, 10, 10); R('w', 1, 29, 8, 12); R('w', 5, 40, 6, 3)
    R('Y', 8, 27, 5, 5); R('f', 10, 29, 2, 2); R('k', 2, 33, 2, 3); R('k', 6, 33, 2, 3); R('p', 3, 37, 4, 1)
  }
}

// One dark pixel around every solid shape, the classic sprite outline.
function outline(g, h) {
  const im = g.getImageData(0, 0, SIZE, h), d = im.data, solid = new Uint8Array(SIZE * h)
  for (let i = 0; i < solid.length; i++) solid[i] = d[i * 4 + 3] > 250
  for (let i = 0; i < solid.length; i++) {
    if (!solid[i] && (solid[i - 1] || solid[i + 1] || solid[i - SIZE] || solid[i + SIZE])) d.set([27, 27, 34, 255], i * 4)
  }
  g.putImageData(im, 0, 0)
}

export function makeAtlas(cast) {
  const cv = Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE })
  const g = cv.getContext('2d', { willReadFrequently: true })
  let ox = 0, oy = 0
  const R = (c, x, y, w, h) => { g.fillStyle = PAL[c] || c; g.fillRect(ox + x, oy + y, w, h) }
  cast.forEach((c, i) => { [ox, oy] = charRect(i); oy++; person(R, c.look) })
  ;[ox, oy] = SHIP.merry; ox++; ship(R, false)   // one pixel in, so the outline stays inside the cell
  ;[ox, oy] = SHIP.sunny; ox++; ship(R, true)
  outline(g, 512)
  BITS.forEach((b, i) => {
    ox = i * 4; oy = 432
    R('#0b1830d0', 0, 0, 4, 7)
    ;[...b].forEach((d, r) => { for (let x = 0; x < 3; x++) if (d >> (2 - x) & 1) R('w', x, r + 1, 1, 1) })
  })
  drawDecals(g)
  return cv
}
