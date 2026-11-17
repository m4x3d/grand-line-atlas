// The whole world (sea, Red Line, islands, clouds) is one fragment shader, drawn at half resolution.
// Sprites are instanced quads on top at full resolution, so a sprite pixel is half a terrain pixel.
export default /* wgsl */`
struct U {
  cam: vec4f,                  // centre x, y, zoom (terrain px per world unit), time
  res: vec4f,                  // terrain w, h, island count
  isl: array<vec4f, 60>,       // x, y, radius, seed
  col: array<vec4f, 60>,       // low, mid, high, speckle as 0xRRGGBB (painted islands: atlas x, y, size)
  ext: array<vec4f, 60>,       // speckle density, special
  tarai: vec4f,                // centre x, y and radius of the Tarai Current
};
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var atlas: texture_2d<f32>;

const LAP = 2400.;             // the world wraps: sea noise keeps going, everything placed repeats
fn wrap(d: f32) -> f32 { return d - LAP * round(d / LAP); }
fn rgb(p: f32) -> vec3f { return vec3f(floor(p / 65536.), floor(p / 256.) % 256., p % 256.) / 255.; }
fn hash(p: vec2f) -> f32 {
  var q = fract(p * vec2f(.1031, .1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}
fn noise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let s = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2f(1., 0.)), s.x), mix(hash(i + vec2f(0., 1.)), hash(i + vec2f(1., 1.)), s.x), s.y);
}
fn fbm(p: vec2f) -> f32 {
  var v = 0.; var a = .5; var q = p;
  for (var i = 0; i < 4; i++) { v += a * noise(q); q = q * 2.03 + 17.; a *= .5; }
  return v;
}
fn bayer(p: vec2f) -> f32 {
  var b = array<f32, 16>(0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
  return b[(i32(p.x) & 3) + (i32(p.y) & 3) * 4] / 16.;
}
struct L { h: f32, i: i32, art: i32 };
fn land(w: vec2f) -> L {
  var best = L(-9., -1, -1);
  for (var i = 0; i < i32(u.res.z); i++) {
    let s = u.isl[i];
    let rel = vec2f(wrap(w.x - s.x), w.y - s.y);
    if (u.ext[i].y == 4.) {
      if (max(abs(rel.x), abs(rel.y)) < s.z * 1.3) { best.art = i; }
      continue;
    }
    let d = length(rel) / s.z;
    if (d > 1.8) { continue; }
    let h = 1. - d + (fbm(rel / s.z * 2.5 + s.w) - .47) * .9;
    if (h > best.h) { best.h = h; best.i = i; }
  }
  return best;
}
fn redline(w: vec2f) -> f32 {   // the continent crosses the map every 1200 units
  let k = round((w.x - 40.) / 1200.);
  let sx = w.x - 40. - k * 1200.;
  return 1. - abs(sx) / 26. + (fbm(vec2f(sx, w.y) * .05 + (abs(k) % 2.) * 31.) - .47) * 1.2;
}

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32((i << 1u) & 2u) * 2. - 1., f32(i & 2u) * 2. - 1., 0., 1.);
}

@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let z = u.cam.z; let t = u.cam.w;
  let wp = floor(fc.xy) + floor(u.cam.xy * z) - floor(u.res.xy * .5);   // world pixel, so dither sticks to the map
  let w = (wp + .5) / z;
  let dth = bayer(wp);

  // sea: four dithered shades, teal on the Grand Line, flat and dark in the Calm Belts
  let gl = abs(w.y - 600.) + (noise(w * .03) - .5) * 14.;
  var sea = array<vec3f, 4>(vec3f(.07, .22, .42), vec3f(.09, .31, .54), vec3f(.13, .41, .66), vec3f(.2, .53, .77));
  let wave = fbm(w * .03 + vec2f(t * .04, t * .02)) + .5 * fbm(w * .11 - vec2f(t * .05, 0.));
  var k = clamp(floor((wave - .4) * 5. + dth), 0., 3.);
  if (gl > 140. && gl < 200.) { k = min(k, 1.) * step(.5, dth + fract(wp.y * .5) * .2); }
  var col = sea[i32(k)];
  if (gl < 140.) { col = mix(col, vec3f(.1, .55, .62), .22); }
  if (hash(wp + floor(t * 3.)) > .9988) { col = vec3f(.85, .95, 1.); }

  let l = land(w);
  var h = l.h;
  let rl = redline(w);
  if (rl > 0. && h <= 0.) {
    let lit = rl - redline(w - vec2f(1.));
    col = vec3f(.35, .15, .13);
    if (rl + dth * .15 > .25) { col = vec3f(.55, .23, .17); }
    if (rl + dth * .15 > .65) { col = vec3f(.71, .33, .23); }
    if (rl + dth * .15 > 1.05) { col = vec3f(.8, .5, .38); }
    col *= 1. + clamp(lit * 6., -.18, .14);
  } else if (l.i >= 0) {
    let s = u.isl[l.i]; let pc = u.col[l.i]; let e = u.ext[l.i]; let sp = e.y;
    let rel = vec2f(wrap(w.x - s.x), w.y - s.y);
    if (h > 0.) {
      var c = rgb(pc.x); var mid = rgb(pc.y); var top = rgb(pc.z);
      if (sp == 2. && rel.x > (noise(rel * .2) - .5) * 8.) { c = vec3f(.78, .88, .95); mid = vec3f(.9, .96, 1.); top = vec3f(1.); }
      let hd = h + dth * .12;
      if (hd > .62) { c = top; } else if (hd > .32) { c = mid; }
      if (sp != 1. && h < .1) { c = vec3f(.93, .86, .62); }                // beach
      let cell = floor(rel / 2.6); let f = fract(rel / 2.6);               // tiny houses / blossoms
      if (h > .14 && hash(cell + s.w) < e.x && f.x < .78 && f.y < .74) {
        c = mix(rgb(pc.w), vec3f(.96, .93, .85), step(.42, f.y));
      }
      c *= 1. + clamp((h - land(w - vec2f(1.)).h) * 7., -.2, .14);         // light from the north-west
      if (sp != 1. && h < .03) { c *= .6; }                                // coast outline
      col = c;
      if (sp == 3.) { col = mix(sea[1], c, .5); }                          // seen through 10,000 m of water
    } else if (sp != 1.) {
      if (h > -.22) { col = mix(col, vec3f(.23, .65, .81), .7); }
      if (h > -.11 - dth * .05) { col = vec3f(.37, .82, .85); }
      if (abs(h + .05 + .025 * sin(t * 1.4 + s.w)) < .012) { col = vec3f(.95, 1., 1.); }   // surf
    }
    if (sp == 3. && abs(length(rel) / s.z - 1.12) * s.z * z < 1. && dth > .25) { col = vec3f(.8, .97, 1.); }   // air bubble
  }
  if (l.art >= 0) {                                                        // hand-painted places (Baratie, Zou)
    let s = u.isl[l.art]; let a = u.col[l.art];
    let q = (vec2f(wrap(w.x - s.x), w.y - s.y) / (s.z * 1.3) * .5 + .5) * a.z;
    let px = textureLoad(atlas, vec2i(a.xy + q), 0);
    if (px.a > .5) { col = px.rgb; h = 1.; }
  }

  // the Tarai Current: a ring of fast water linking Enies Lobby, Impel Down and Marineford
  let tc = vec2f(wrap(w.x - u.tarai.x), w.y - u.tarai.y);
  let ring = abs(length(tc) - u.tarai.z) * z;
  if (h < 0. && rl < 0. && ring < 1.6 && (ring < .8 || dth > .5) && fract(atan2(tc.y, tc.x) * u.tarai.z * z / 10. - t * 1.5) < .55) {
    col = mix(col, vec3f(.75, .95, 1.), .8);
  }

  // drifting clouds, only on the overview
  let edge = .7 + smoothstep(.45, 1.3, z) * .35;   // they thin out and vanish as you zoom in
  if (edge < 1.) {
    let cw = w * .006 + vec2f(t * .006, 0.);
    if (fbm(cw) + dth * .03 > edge) { col = mix(col, vec3f(1.), .88); }
    else if (fbm(cw + vec2f(.03, -.03)) > edge) { col *= .78; }
  }
  return vec4f(col, 1.);
}

struct I { @location(0) pos: vec4f, @location(1) rect: vec4f, @location(2) misc: vec4f };   // misc: scale, alpha, hop phase, tint
struct V { @builtin(position) p: vec4f, @location(0) uv: vec2f, @location(1) @interpolate(flat) misc: vec4f };

@vertex fn vs2(@builtin(vertex_index) vi: u32, i: I) -> V {
  let c = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u));
  let z = u.cam.z * 2.; let res = u.res.xy * 2.;   // sprites live on the full resolution canvas
  var px = floor(i.pos.xy * z) - floor(u.cam.xy * z) + floor(res * .5) + i.pos.zw;
  if (i.misc.z >= 0.) { px.y -= 2. * step(.72, fract(u.cam.w * 1.1 + i.misc.z)); }
  px += c * i.rect.zw * i.misc.x;
  var o: V;
  o.p = vec4f(px / res * vec2f(2., -2.) + vec2f(-1., 1.), 0., 1.);
  o.uv = i.rect.xy + c * i.rect.zw;
  o.misc = i.misc;
  return o;
}
@fragment fn fs2(v: V) -> @location(0) vec4f {
  var c = textureLoad(atlas, vec2i(v.uv), 0);
  if (c.a < .05) { discard; }
  if (v.misc.w == 1.) { c = vec4f(c.rgb * vec3f(1., .82, .25), c.a); }
  if (v.misc.w == 2.) { c = vec4f(min(c.rgb * 1.3 + .1, vec3f(1.)), c.a); }
  return vec4f(c.rgb, c.a * v.misc.y);
}

// second pass: the half resolution terrain, blown up 2x
@group(0) @binding(0) var low: texture_2d<f32>;
@fragment fn blit(@builtin(position) fc: vec4f) -> @location(0) vec4f { return textureLoad(low, vec2i(fc.xy * .5), 0); }
`
