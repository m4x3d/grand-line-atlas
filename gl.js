// WebGL2 fallback for browsers without a WebGPU adapter. Same uniform block, same instances, same picture.
// ponytail: this is a hand-kept GLSL twin of shader.js, change both together. Delete this file once WebGPU is everywhere.
const HEAD = `#version 300 es
precision highp float;
`
const WORLD_FS = HEAD + `
uniform vec4 U[183];   // cam, res, then isl[60], col[60], ext[60], tarai
uniform sampler2D atlas;
out vec4 o;
float wrap(float d) { return d - 2400. * round(d / 2400.); }
vec3 rgb(float p) { return vec3(floor(p / 65536.), mod(floor(p / 256.), 256.), mod(p, 256.)) / 255.; }
float hash(vec2 p) { vec2 q = fract(p * vec2(.1031, .1030)); q += dot(q, q.yx + 33.33); return fract((q.x + q.y) * q.x); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), s = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), s.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), s.x), s.y);
}
float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.; a *= .5; } return v; }
const float B[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
float bayer(vec2 p) { return B[(int(p.x) & 3) + (int(p.y) & 3) * 4] / 16.; }
float land(vec2 w, out int id, out int art) {
  float best = -9.; id = -1; art = -1;
  for (int i = 0; i < int(U[1].z); i++) {
    vec4 s = U[2 + i];
    vec2 rel = vec2(wrap(w.x - s.x), w.y - s.y);
    if (U[122 + i].y == 4.) {
      if (max(abs(rel.x), abs(rel.y)) < s.z * 1.3) art = i;
      continue;
    }
    float d = length(rel) / s.z;
    if (d > 1.8) continue;
    float h = 1. - d + (fbm(rel / s.z * 2.5 + s.w) - .47) * .9;
    if (h > best) { best = h; id = i; }
  }
  return best;
}
float redline(vec2 w) {
  float k = round((w.x - 40.) / 1200.);
  float sx = w.x - 40. - k * 1200.;
  return 1. - abs(sx) / 26. + (fbm(vec2(sx, w.y) * .05 + mod(abs(k), 2.) * 31.) - .47) * 1.2;
}
void main() {
  float z = U[0].z, t = U[0].w;
  vec2 fc = vec2(gl_FragCoord.x, U[1].y - gl_FragCoord.y);
  vec2 wp = floor(fc) + floor(U[0].xy * z) - floor(U[1].xy * .5);
  vec2 w = (wp + .5) / z;
  float dth = bayer(wp);

  float gl = abs(w.y - 600.) + (noise(w * .03) - .5) * 14.;
  vec3 sea[4] = vec3[4](vec3(.07, .22, .42), vec3(.09, .31, .54), vec3(.13, .41, .66), vec3(.2, .53, .77));
  float wave = fbm(w * .03 + vec2(t * .04, t * .02)) + .5 * fbm(w * .11 - vec2(t * .05, 0.));
  float k = clamp(floor((wave - .4) * 5. + dth), 0., 3.);
  if (gl > 140. && gl < 200.) k = min(k, 1.) * step(.5, dth + fract(wp.y * .5) * .2);
  vec3 col = sea[int(k)];
  if (gl < 140.) col = mix(col, vec3(.1, .55, .62), .22);
  if (hash(wp + floor(t * 3.)) > .9988) col = vec3(.85, .95, 1.);

  int id, art, _a, _b;
  float h = land(w, id, art);
  float rl = redline(w);
  if (rl > 0. && h <= 0.) {
    float lit = rl - redline(w - vec2(1.));
    col = vec3(.35, .15, .13);
    if (rl + dth * .15 > .25) col = vec3(.55, .23, .17);
    if (rl + dth * .15 > .65) col = vec3(.71, .33, .23);
    if (rl + dth * .15 > 1.05) col = vec3(.8, .5, .38);
    col *= 1. + clamp(lit * 6., -.18, .14);
  } else if (id >= 0) {
    vec4 s = U[2 + id], pc = U[62 + id], e = U[122 + id]; float sp = e.y;
    vec2 rel = vec2(wrap(w.x - s.x), w.y - s.y);
    if (h > 0.) {
      vec3 c = rgb(pc.x), mid = rgb(pc.y), top = rgb(pc.z);
      if (sp == 2. && rel.x > (noise(rel * .2) - .5) * 8.) { c = vec3(.78, .88, .95); mid = vec3(.9, .96, 1.); top = vec3(1.); }
      float hd = h + dth * .12;
      if (hd > .62) c = top; else if (hd > .32) c = mid;
      if (sp != 1. && h < .1) c = vec3(.93, .86, .62);
      vec2 cell = floor(rel / 2.6), f = fract(rel / 2.6);
      if (h > .14 && hash(cell + s.w) < e.x && f.x < .78 && f.y < .74) c = mix(rgb(pc.w), vec3(.96, .93, .85), step(.42, f.y));
      c *= 1. + clamp((h - land(w - vec2(1.), _a, _b)) * 7., -.2, .14);
      if (sp != 1. && h < .03) c *= .6;
      col = c;
      if (sp == 3.) col = mix(sea[1], c, .5);
    } else if (sp != 1.) {
      if (h > -.22) col = mix(col, vec3(.23, .65, .81), .7);
      if (h > -.11 - dth * .05) col = vec3(.37, .82, .85);
      if (abs(h + .05 + .025 * sin(t * 1.4 + s.w)) < .012) col = vec3(.95, 1., 1.);
    }
    if (sp == 3. && abs(length(rel) / s.z - 1.12) * s.z * z < 1. && dth > .25) col = vec3(.8, .97, 1.);
  }
  if (art >= 0) {
    vec4 s = U[2 + art], a = U[62 + art];
    vec2 q = (vec2(wrap(w.x - s.x), w.y - s.y) / (s.z * 1.3) * .5 + .5) * a.z;
    vec4 px = texelFetch(atlas, ivec2(a.xy + q), 0);
    if (px.a > .5) { col = px.rgb; h = 1.; }
  }

  vec2 tc = vec2(wrap(w.x - U[182].x), w.y - U[182].y);
  float ring = abs(length(tc) - U[182].z) * z;
  if (h < 0. && rl < 0. && ring < 1.6 && (ring < .8 || dth > .5) && fract(atan(tc.y, tc.x) * U[182].z * z / 10. - t * 1.5) < .55)
    col = mix(col, vec3(.75, .95, 1.), .8);

  float edge = .7 + smoothstep(.45, 1.3, z) * .35;
  if (edge < 1.) {
    vec2 cw = w * .006 + vec2(t * .006, 0.);
    if (fbm(cw) + dth * .03 > edge) col = mix(col, vec3(1.), .88);
    else if (fbm(cw + vec2(.03, -.03)) > edge) col *= .78;
  }
  o = vec4(col, 1.);
}`
const WORLD_VS = HEAD + `void main() { gl_Position = vec4(float((gl_VertexID << 1) & 2) * 2. - 1., float(gl_VertexID & 2) * 2. - 1., 0., 1.); }`
const SPRITE_VS = HEAD + `
uniform vec4 V[2];
layout(location = 0) in vec4 pos; layout(location = 1) in vec4 rect; layout(location = 2) in vec4 misc;
out vec2 uv; flat out vec4 m;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  float z = V[0].z * 2.; vec2 res = V[1].xy * 2.;
  vec2 px = floor(pos.xy * z) - floor(V[0].xy * z) + floor(res * .5) + pos.zw;
  if (misc.z >= 0.) px.y -= 2. * step(.72, fract(V[0].w * 1.1 + misc.z));
  px += c * rect.zw * misc.x;
  gl_Position = vec4(px / res * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
  uv = rect.xy + c * rect.zw; m = misc;
}`
const SPRITE_FS = HEAD + `
uniform sampler2D atlas;
in vec2 uv; flat in vec4 m; out vec4 o;
void main() {
  vec4 c = texelFetch(atlas, ivec2(uv), 0);
  if (c.a < .05) discard;
  if (m.w == 1.) c.rgb *= vec3(1., .82, .25);
  if (m.w == 2.) c.rgb = min(c.rgb * 1.3 + .1, vec3(1.));
  o = vec4(c.rgb, c.a * m.y);
}`

export function initGL(cv, atlas) {
  const gl = cv.getContext('webgl2', { alpha: false, antialias: false })
  if (!gl) return null
  const program = (vs, fs) => {
    const p = gl.createProgram()
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type)
      gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('glsl', gl.getShaderInfoLog(s))
    }
    gl.linkProgram(p)
    return p
  }
  const world = program(WORLD_VS, WORLD_FS), sprites = program(SPRITE_VS, SPRITE_FS)
  const locU = gl.getUniformLocation(world, 'U'), locV = gl.getUniformLocation(sprites, 'V')

  const U = new Float32Array(732), INST = new Float32Array(12 * 4096)
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, INST.byteLength, gl.DYNAMIC_DRAW)
  for (let i = 0; i < 3; i++) {
    gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(i, 1)
  }
  const texture = () => {
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  }
  // unit 1: the half resolution terrain target. unit 0: the atlas (both programs sample unit 0 by default)
  const fbo = gl.createFramebuffer()
  let lw = 0, lh = 0
  gl.activeTexture(gl.TEXTURE1); texture()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, gl.getParameter(gl.TEXTURE_BINDING_2D), 0)
  gl.activeTexture(gl.TEXTURE0); texture()
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  return {
    U, INST,
    draw(n) {
      const W = cv.width, H = cv.height, w = W / 2, h = H / 2
      if (w !== lw || h !== lh) {
        gl.activeTexture(gl.TEXTURE1)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, lw = w, lh = h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
        gl.activeTexture(gl.TEXTURE0)
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.viewport(0, 0, w, h)
      gl.disable(gl.BLEND)
      gl.useProgram(world); gl.uniform4fv(locU, U); gl.drawArrays(gl.TRIANGLES, 0, 3)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
      gl.blitFramebuffer(0, 0, w, h, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST)
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, W, H)
      gl.enable(gl.BLEND)
      gl.useProgram(sprites); gl.uniform4fv(locV, U.subarray(0, 8))
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, INST, 0, n * 12)
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n)
    },
  }
}
