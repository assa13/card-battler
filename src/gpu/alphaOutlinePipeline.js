// WebGPU Alpha-Outline pipeline.
// Спека: alpha-based outline по силуэту PNG/PNG-секвенций. Контур уходит ПОД
// оригинальный пиксель — поэтому при полупрозрачной границе альфа-эджа нет шва.
//
// UNIFORM LAYOUT (64 байта, Float32Array[16]):
//   off  0: [time(0), outputW, outputH, _]
//   off 16: [inputW, inputH, _, _]
//   off 32: [outline.r, .g, .b, .a]   // НЕпремультиплированный RGBA 0..1
//   off 48: [thickness, _, _, _]      // в пикселях ВХОДНОЙ текстуры
//
// Sampler: linear/linear, clamp-to-edge.
// Texture: rgba8unorm, premultiplied alpha.
// Blend: НЕТ (шейдер сам делает композит и возвращает финальный premul RGBA).
// Quad: 6 вершин в NDC [-1,1], UV [0,1] с инверсией Y (uv.y=1 ↔ верх экрана).

export const OUTLINE_WGSL = /* wgsl */ `
struct Uniforms {
  frame:     vec4<f32>, // (time, outputW, outputH, _)
  inputDims: vec4<f32>, // (inputW, inputH, _, _)
  outline:   vec4<f32>, // (r, g, b, a)
  params:    vec4<f32>, // (thickness, _, _, _)
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var inputTex: texture_2d<f32>;
@group(0) @binding(2) var inputSampler: sampler;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vsMain(@builtin(vertex_index) vi: u32) -> VSOut {
  // Два треугольника на полный экран. UV с инверсией Y по спеке.
  var positions = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>(-1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
  );
  var uvs = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(1.0, 0.0),
  );
  var out: VSOut;
  out.pos = vec4<f32>(positions[vi], 0.0, 1.0);
  out.uv  = uvs[vi];
  return out;
}

@fragment
fn fsMain(in: VSOut) -> @location(0) vec4<f32> {
  let inputColor = textureSample(inputTex, inputSampler, in.uv);
  let thickness  = u.params.x;
  let thicknessI = i32(round(thickness));
  let texel      = vec2<f32>(1.0, 1.0) / u.inputDims.xy;

  var hit: bool = false;
  for (var dy: i32 = -thicknessI; dy <= thicknessI; dy = dy + 1) {
    for (var dx: i32 = -thicknessI; dx <= thicknessI; dx = dx + 1) {
      let d = length(vec2<f32>(f32(dx), f32(dy)));
      if (d > thickness) { continue; }
      let sampleUv = in.uv + vec2<f32>(f32(dx), f32(dy)) * texel;
      // Явный 0 за пределами [0,1] (не edge-clamp).
      var neighborAlpha: f32 = 0.0;
      if (sampleUv.x >= 0.0 && sampleUv.x <= 1.0 &&
          sampleUv.y >= 0.0 && sampleUv.y <= 1.0) {
        neighborAlpha = textureSample(inputTex, inputSampler, sampleUv).a;
      }
      if (neighborAlpha > 0.01) {
        hit = true;
        break;
      }
    }
    if (hit) { break; }
  }

  if (hit) {
    let outPremul = vec4<f32>(u.outline.rgb * u.outline.a, u.outline.a);
    // OUTLINE-ONLY pass. Полный композит спеки (inputColor + outPremul*(1-inputColor.a))
    // разнесён на 2 слоя: канва тут отдаёт только хвост outPremul*(1-inputColor.a),
    // а DOM-<img> поверх вносит inputColor. Финальный пиксель идентичен спеке,
    // при этом исходное изображение остаётся в DOM (нет seam на anti-aliased edge,
    // не нужно прятать <img> на hover, хитбокс/скейл живут на своих местах).
    return outPremul * (1.0 - inputColor.a);
  }
  return vec4<f32>(0.0, 0.0, 0.0, 0.0);
}
`;

/**
 * Создаёт WebGPU-рендерер обводки на заданном <canvas>.
 * Возвращает API { uploadTexture, render, destroy } или null, если WebGPU недоступен.
 */
export async function createAlphaOutlineRenderer(canvas) {
  if (typeof navigator === 'undefined' || !navigator.gpu) return null;
  if (!canvas) return null;

  let adapter;
  try {
    adapter = await navigator.gpu.requestAdapter();
  } catch {
    return null;
  }
  if (!adapter) return null;

  const device = await adapter.requestDevice();
  const ctx = canvas.getContext('webgpu');
  if (!ctx) return null;

  const format = navigator.gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format, alphaMode: 'premultiplied' });

  const module = device.createShaderModule({ code: OUTLINE_WGSL });
  const pipeline = device.createRenderPipeline({
    layout: 'auto',
    vertex:   { module, entryPoint: 'vsMain' },
    fragment: { module, entryPoint: 'fsMain', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
    // Blend намеренно НЕ задаётся (шейдер сам делает композит).
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
    addressModeU: 'clamp-to-edge',
    addressModeV: 'clamp-to-edge',
  });

  const uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  let inputTexture = null;
  let bindGroup = null;
  let destroyed = false;

  function uploadTexture(source, width, height) {
    if (destroyed) return;
    if (inputTexture) inputTexture.destroy();
    inputTexture = device.createTexture({
      size: [width, height, 1],
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });
    device.queue.copyExternalImageToTexture(
      { source, flipY: false },
      { texture: inputTexture, premultipliedAlpha: true },
      [width, height]
    );
    bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: inputTexture.createView() },
        { binding: 2, resource: sampler },
      ],
    });
  }

  function render({ inputW, inputH, outlineColor, thickness }) {
    if (destroyed || !bindGroup) return;
    const w = canvas.width;
    const h = canvas.height;

    const uniforms = new Float32Array(16);
    // frame: time, outputW, outputH, _
    uniforms[0] = 0;
    uniforms[1] = w;
    uniforms[2] = h;
    uniforms[3] = 0;
    // inputDims
    uniforms[4] = inputW;
    uniforms[5] = inputH;
    uniforms[6] = 0;
    uniforms[7] = 0;
    // outline RGBA (НЕпремультиплированный)
    uniforms[8]  = outlineColor[0];
    uniforms[9]  = outlineColor[1];
    uniforms[10] = outlineColor[2];
    uniforms[11] = outlineColor[3];
    // params: thickness
    uniforms[12] = thickness;
    uniforms[13] = 0;
    uniforms[14] = 0;
    uniforms[15] = 0;
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: ctx.getCurrentTexture().createView(),
        loadOp: 'clear',
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        storeOp: 'store',
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  function destroy() {
    destroyed = true;
    if (inputTexture) inputTexture.destroy();
    uniformBuffer.destroy();
  }

  return { uploadTexture, render, destroy };
}

/** Хелпер: '#fbbf24' → [1, 0.749, 0.141, 1]. */
export function hexToRgba01(hex, a = 1) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [1, 1, 1, a];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}
