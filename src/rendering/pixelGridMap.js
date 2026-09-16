import { PIXEL_GRID_FRAGMENT_SHADER, PIXEL_GRID_VERTEX_SHADER } from './pixelGrid.js';

// The map is static between setting/viewport changes. No scene readback,
// screenshots, animation loop, or per-frame canvas upload is needed.
export function createPixelGridMap(onContextLost) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL недоступен');
  const shaders = [];
  let program;
  let buffer;
  const lost = event => {
    event.preventDefault();
    onContextLost();
  };
  const dispose = () => {
    canvas.removeEventListener('webglcontextlost', lost);
    if (buffer) gl.deleteBuffer(buffer);
    if (program) gl.deleteProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  };
  try {
    for (const [type, source] of [
      [gl.VERTEX_SHADER, PIXEL_GRID_VERTEX_SHADER],
      [gl.FRAGMENT_SHADER, PIXEL_GRID_FRAGMENT_SHADER],
    ]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Ошибка компиляции Pixel Grid');
    }
    program = gl.createProgram();
    shaders.forEach(shader => gl.attachShader(program, shader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Ошибка подключения Pixel Grid');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DITHER);
    const resolution = gl.getUniformLocation(program, 'u_resolution');
    const size = gl.getUniformLocation(program, 'u_gridSize');
    const offset = gl.getUniformLocation(program, 'u_gridOffset');
    const limits = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    canvas.addEventListener('webglcontextlost', lost);
    return {
      render(width, height, settings) {
        if (gl.isContextLost()) throw new Error('Контекст WebGL потерян');
        if (width > limits[0] || height > limits[1]) throw new Error('Слишком большой экран для Pixel Grid');
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
        gl.uniform2f(resolution, width, height);
        gl.uniform1f(size, settings.size);
        gl.uniform2f(offset, settings.offsetX, settings.offsetY);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (gl.getError() !== gl.NO_ERROR) throw new Error('Не удалось создать сетку WebGL');
        return canvas.toDataURL('image/png');
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
