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

  // Baratie: the sea restaurant, a three-storey ship with a fish for a bow
  at(DECAL.baratie, () => {
    const wood = '#8a5a35', dark = '#6a4a3a', fish = '#5fae8f', wall = '#f5efd8', roof = '#d8322c', glass = '#49c4d8'
    E('#ffffff', 64, 104, 58, 5)
    P(fish, 108, 66, 127, 46, 122, 66, 127, 84)                                // tail fin
    g.fillStyle = wood; g.beginPath(); g.moveTo(12, 70); g.quadraticCurveTo(64, 122, 116, 70); g.fill()
    g.fillStyle = dark; g.beginPath(); g.moveTo(26, 84); g.quadraticCurveTo(64, 114, 102, 84); g.fill()
    R('#d39a6a', 12, 66, 104, 5)
    E(fish, 18, 62, 17, 14); E('#4a9478', 18, 68, 13, 6)                       // fish head
    P('#1b1b22', 1, 62, 14, 58, 14, 68); R('#f28cb1', 2, 56, 12, 3); R('#f28cb1', 2, 67, 12, 3)
    E('#f5f5f0', 20, 54, 4, 4); R('#1b1b22', 19, 53, 3, 3)
    R(dark, 27, 12, 3, 34); R(dark, 100, 20, 3, 28)                            // masts and sails
    R('#f5f5f0', 18, 16, 20, 15); R('#d8d8d0', 18, 28, 20, 3); R('#f5f5f0', 92, 24, 19, 13); R('#d8d8d0', 92, 34, 19, 3)
    R('#1b1b22', 30, 6, 8, 5)
    for (const [x, y, w, h] of [[36, 44, 60, 23], [46, 23, 40, 17], [58, 9, 16, 10]]) {
      R(wall, x, y, w, h); R('#0000001f', x, y + h - 4, w, 4); R(roof, x - 4, y - 4, w + 8, 5); R('#a8241f', x - 4, y, w + 8, 1)
      for (let wx = x + 5; wx < x + w - 6; wx += 11) R(glass, wx, y + 6, 6, 8)
    }
    R(dark, 62, 55, 8, 12)
  })

  // Zou: Zunesha wading through the New World with the Mokomo Dukedom on its back
  at(DECAL.zou, () => {
    const skin = '#8d949e', far = '#737a86'
    for (const x of [57, 103]) { E('#ffffff', x, 121, 12, 4); R(far, x - 5, 68, 10, 53) }
    for (const x of [44, 90]) {
      E('#ffffff', x, 123, 14, 4); R(skin, x - 6, 68, 12, 55)
      for (let y = 78; y < 118; y += 9) R('#0000002a', x - 6, y, 12, 1)
    }
    E(skin, 72, 58, 41, 22); E('#0000002a', 72, 68, 35, 10)
    E(skin, 30, 54, 18, 20); E(far, 43, 52, 9, 16)
    curve(skin, 9, 18, 62, 4, 86, 14, 112)                                     // trunk
    curve('#f5f5f0', 3, 23, 68, 12, 78, 5, 70)                                 // tusk
    R('#1b1b22', 22, 47, 3, 3)
    E('#6a5a45', 72, 38, 41, 8); E('#4f9a45', 72, 33, 39, 10); E('#2f7a3a', 52, 30, 12, 6); E('#2f7a3a', 94, 31, 11, 5)
    for (const [x, y] of [[62, 34], [68, 37], [78, 35], [84, 38], [74, 31]]) { R('#f5efd8', x, y, 3, 3); R('#d8322c', x, y - 1, 3, 1) }
    R('#8a5a35', 70, 10, 4, 18); E('#2f7a3a', 72, 10, 14, 8); E('#3f9a45', 69, 8, 8, 4)   // the whale-shaped tree
  })
}
