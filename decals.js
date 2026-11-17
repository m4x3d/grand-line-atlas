// Places that are not islands get painted by hand instead of grown from noise. The terrain shader samples
// these 128x128 pictures from the atlas and scales them with the map (special 4 in islands.js).
export const DECAL = { baratie: [0, 512, 128], zou: [128, 512, 128] }

export function drawDecals(g) {
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h) }
  const E = (c, x, y, rx, ry) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill() }
  const P = (c, ...p) => { g.fillStyle = c; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.fill() }
  const curve = (c, w, x0, y0, cx, cy, x1, y1) => {
    g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx, cy, x1, y1); g.stroke()
  }
  const at = ([x, y], draw) => { g.save(); g.translate(x, y); draw(); g.restore() }

  const Q = (c, x, y, ...p) => { g.fillStyle = c; g.beginPath(); g.moveTo(x, y); for (let i = 0; i < p.length; i += 4) g.quadraticCurveTo(p[i], p[i + 1], p[i + 2], p[i + 3]); g.fill() }

  // Baratie: the sea restaurant, a fish-shaped ship with a two-storey restaurant on deck
  at(DECAL.baratie, () => {
    const fish = '#5fae8f', shade = '#3f8a6f', belly = '#c9d98a', wall = '#f5efd8', roof = '#d8322c', glass = '#49c4d8', wood = '#8a5a35'
    E('#ffffff', 64, 108, 60, 5)
    P(shade, 100, 84, 127, 60, 118, 84, 127, 108); P(fish, 102, 84, 123, 64, 115, 84, 123, 104)   // tail fin
    Q(fish, 4, 86, 4, 64, 30, 64, 68, 64, 106, 66, 108, 100, 60, 106, 10, 106, 4, 86)              // fish hull
    Q(belly, 12, 98, 40, 108, 70, 105, 98, 100, 105, 88, 60, 102, 12, 98)
    for (let x = 44; x < 100; x += 9) for (const y of [78, 88]) { E(shade, x, y, 4, 3); E(fish, x, y - 1, 4, 3) }   // scales
    curve(shade, 2, 34, 68, 42, 84, 34, 100)                                                       // gill
    P(shade, 44, 88, 62, 93, 46, 98)                                                               // side fin
    P('#1b1b22', 3, 80, 20, 87, 3, 95)                                                             // open mouth
    for (let x = 5; x < 17; x += 5) {
      const u = 80 + (x - 3) * 0.4, d = 95 - (x - 3) * 0.45
      P('#f5f5f0', x, u + 1, x + 3, u + 2, x + 1.5, u + 4); P('#f5f5f0', x, d - 1, x + 3, d - 2, x + 1.5, d - 4)
    }
    curve('#f28cb1', 3, 3, 80, 11.5, 83.5, 20, 87); curve('#f28cb1', 3, 3, 95, 11.5, 91, 20, 87)
    E('#f5f5f0', 24, 74, 5, 5); E('#1b1b22', 25, 74, 2.5, 2.5)
    R('#0000002a', 26, 66, 78, 2); R('#6a4a3a', 24, 60, 82, 6); R('#d39a6a', 22, 57, 86, 3)        // deck on the fish's back
    R(wood, 22, 53, 86, 1); for (let x = 22; x < 108; x += 6) R(wood, x, 53, 1, 4)
    R(wood, 26, 10, 3, 47); R(wood, 102, 20, 3, 37)                                               // masts and sails
    R('#f5f5f0', 17, 16, 21, 16); R('#d8d8d0', 17, 29, 21, 3); R('#f5f5f0', 94, 26, 19, 13); R('#d8d8d0', 94, 36, 19, 3)
    R('#1b1b22', 29, 4, 10, 6); R('#f5f5f0', 32, 5, 4, 2); R('#f5f5f0', 33, 7, 2, 2)              // flag with a chef hat
    for (const [x, y, w, h] of [[38, 35, 56, 18], [48, 17, 36, 14]]) {
      R(wall, x, y, w, h); R('#0000001f', x, y + h - 3, w, 3)
      P(roof, x - 5, y + 1, x + 6, y - 7, x + w - 6, y - 7, x + w + 5, y + 1); R('#a8241f', x - 5, y, w + 10, 1)
      for (let wx = x + 4; wx < x + w - 5; wx += 9) { E(glass, wx + 3, y + 6, 3, 3); R('#0000002a', wx, y + 6, 6, 1) }
    }
    R(wood, 56, 30, 20, 4); for (let x = 58; x < 74; x += 3) R('#f5efd8', x, 31, 2, 2)           // sign board
    R('#6a4a3a', 62, 43, 8, 10); R('#f2c230', 68, 47, 1, 1)                                         // door
  })

  // Zou: Zunesha wading through the New World with the Mokomo Dukedom on its back
  at(DECAL.zou, () => {
    const skin = '#8d949e', far = '#6f7682', fold = '#00000024'
    const leg = (c, x) => {
      E('#ffffff', x, 121, 13, 4); P(c, x - 9, 66, x + 9, 66, x + 7, 121, x - 7, 121)
      for (let y = 80; y < 118; y += 8) R(fold, x - 7, y, 14, 1)
    }
    leg(far, 64); leg(far, 108)
    curve(far, 4, 116, 54, 126, 64, 122, 80)                                                       // tail
    E(skin, 76, 58, 42, 24); E(fold, 78, 72, 36, 9)
    for (const x of [64, 82, 100]) curve(fold, 1, x, 44, x + 4, 58, x, 74)                         // wrinkles
    leg(skin, 50); leg(skin, 94)
    E(skin, 34, 52, 19, 21)                                                                         // head, ear, trunk
    E(far, 50, 54, 12, 18); E('#7f8692', 51, 55, 8, 13)
    curve(skin, 11, 22, 62, 4, 86, 12, 112); curve(skin, 7, 12, 112, 16, 122, 22, 116)
    for (const [x, y] of [[12, 74], [8, 86], [9, 98]]) R(fold, x, y, 8, 1)
    curve('#f5f5f0', 4, 28, 68, 18, 82, 6, 76)                                                     // tusk
    for (const y of [38, 42]) R(fold, 24, y, 14, 1)
    R('#1b1b22', 24, 48, 3, 3); R('#ffffff66', 24, 48, 1, 1)
    E('#6a5a45', 76, 36, 40, 7); E('#4f9a45', 76, 31, 38, 9)                                       // Mokomo Dukedom
    for (const [x, y, r] of [[46, 30, 8], [56, 26, 7], [98, 27, 9], [108, 32, 6], [88, 24, 6]]) { E('#2f7a3a', x, y, r, r * 0.7); E('#3f9a45', x - 2, y - 2, r / 2, r / 3) }
    for (const [x, y] of [[62, 33], [68, 36], [78, 34], [84, 37], [72, 30]]) { R('#f5efd8', x, y, 3, 3); R('#d8322c', x, y - 1, 3, 1) }
    R('#8a5a35', 74, 12, 4, 18)                                                                     // the whale tree
    E('#2f7a3a', 74, 11, 15, 8); P('#2f7a3a', 86, 10, 97, 2, 94, 11, 98, 18); E('#3f9a45', 70, 8, 8, 3); R('#1b1b22', 64, 11, 2, 2)
  })
}
