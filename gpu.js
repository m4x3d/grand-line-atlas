import WGSL from './shader.js'

// Float offsets into the uniform block (see struct U in shader.js)
export const OFF = { isl: 8, col: 248, ext: 488, tarai: 728 }
export const MAX_SPRITES = 4096

export async function initGPU(cv, atlas) {
  const adapter = await navigator.gpu?.requestAdapter()
  if (!adapter) return null
  const dev = await adapter.requestDevice()
  const ctx = cv.getContext('webgpu'), format = navigator.gpu.getPreferredCanvasFormat()
  ctx.configure({ device: dev, format, alphaMode: 'opaque' })

  const module = dev.createShaderModule({ code: WGSL })
  module.getCompilationInfo().then(i => i.messages.forEach(m => console.error(`wgsl ${m.lineNum}:${m.linePos} ${m.message}`)))

  const U = new Float32Array(732), INST = new Float32Array(12 * MAX_SPRITES)
  const ubuf = dev.createBuffer({ size: U.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
  const ibuf = dev.createBuffer({ size: INST.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST })
  const tex = dev.createTexture({
    size: [atlas.width, atlas.height], format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
  })
  dev.queue.copyExternalImageToTexture({ source: atlas }, { texture: tex }, [atlas.width, atlas.height])

  const bgl = dev.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  })
  const layout = dev.createPipelineLayout({ bindGroupLayouts: [bgl] })
  const bind = dev.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: tex.createView() }] })

  const vertex = { module, entryPoint: 'vs' }
  const world = dev.createRenderPipeline({ layout, vertex, fragment: { module, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] } })
  const blit = dev.createRenderPipeline({ layout: 'auto', vertex, fragment: { module, entryPoint: 'blit', targets: [{ format }] } })
  const sprites = dev.createRenderPipeline({
    layout,
    vertex: {
      module, entryPoint: 'vs2',
      buffers: [{ arrayStride: 48, stepMode: 'instance', attributes: [0, 1, 2].map(i => ({ shaderLocation: i, offset: i * 16, format: 'float32x4' })) }],
    },
    fragment: {
      module, entryPoint: 'fs2',
      targets: [{ format, blend: { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one' } } }],
    },
    primitive: { topology: 'triangle-strip' },
  })

  let low, lowBind   // the half resolution terrain target, rebuilt when the canvas resizes
  const target = view => ({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] })

  return {
    U, INST,
    draw(n) {
      const w = cv.width / 2, h = cv.height / 2
      if (low?.width !== w || low.height !== h) {
        low?.destroy()
        low = dev.createTexture({ size: [w, h], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING })
        lowBind = dev.createBindGroup({ layout: blit.getBindGroupLayout(0), entries: [{ binding: 0, resource: low.createView() }] })
      }
      dev.queue.writeBuffer(ubuf, 0, U)
      dev.queue.writeBuffer(ibuf, 0, INST, 0, n * 12)
      const enc = dev.createCommandEncoder()
      let pass = enc.beginRenderPass(target(low.createView()))
      pass.setBindGroup(0, bind); pass.setPipeline(world); pass.draw(3)
      pass.end()
      pass = enc.beginRenderPass(target(ctx.getCurrentTexture().createView()))
      pass.setPipeline(blit); pass.setBindGroup(0, lowBind); pass.draw(3)
      pass.setPipeline(sprites); pass.setBindGroup(0, bind); pass.setVertexBuffer(0, ibuf); pass.draw(4, n)
      pass.end()
      dev.queue.submit([enc.finish()])
    },
  }
}
