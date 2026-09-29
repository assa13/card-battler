import { naturalFireAt } from './fireFlicker.js';
// One texture sample; works with the existing Pixi WebGL renderer and live alpha.
// The light model is shared with DOM sprites, not duplicated inside the shader.
export const SPRITE_LIGHT_FRAGMENT = `
varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputSize;
uniform vec4 outputFrame;
uniform float uBrightness;
uniform float uSaturation;
uniform vec3 uAmbientColor;
uniform float uAmbientStrength;
uniform vec3 uLightColor;
uniform float uLightStrength;
uniform float uSourceGain;
uniform vec2 uDirection;
uniform float uFlicker;
void main() {
  vec4 source = texture2D(uSampler, vTextureCoord);
  vec3 color = source.rgb / max(source.a, 0.0001);
  vec3 overlay = mix(2.0 * color * uLightColor,
    1.0 - 2.0 * (1.0 - color) * (1.0 - uLightColor), step(vec3(0.5), color));
  color = mix(color, overlay, 0.35 * uLightStrength * uSourceGain * uFlicker);
  // Pixi's pooled filter texture may exceed the visible frame. Normalize only
  // the directional gradient; sample the source at its original texture UV.
  vec2 localUV = vTextureCoord * inputSize.xy / max(outputFrame.zw, vec2(1.0));
  float facing = clamp((0.55 - (0.5 + dot(localUV - 0.5, uDirection))) / 0.55, 0.0, 1.0);
  vec3 glow = uLightColor * (0.45 * pow(uLightStrength, 1.5) * uSourceGain * facing * uFlicker);
  color = 1.0 - (1.0 - color) * (1.0 - glow);
  color *= mix(vec3(1.0), uAmbientColor, uAmbientStrength) * uBrightness;
  float luminance = dot(color, vec3(0.213, 0.715, 0.072));
  color = mix(vec3(luminance), color, uSaturation);
  gl_FragColor = vec4(clamp(color, 0.0, 1.0) * source.a, source.a);
}`;

export function spriteLightUniforms(light, time = 0) {
  const sample = light?.gpu;
  const phase = ((time % 2.3) + 2.3) % 2.3 / 2.3;
  const stops = [[0, 1], [0.13, 0.86], [0.27, 0.97], [0.41, 0.82], [0.58, 1], [0.72, 0.9], [0.86, 0.95]];
  const flicker = sample?.flicker === 'naturalFire'
    ? naturalFireAt(time, sample.flickerOffset)
    : sample?.flicker ? stops.filter(([at]) => at <= phase).at(-1)[1] : 1;
  return {
    uBrightness: sample?.brightness ?? 1,
    uSaturation: sample?.saturation ?? 1,
    uAmbientColor: sample?.ambientColor || [1, 1, 1],
    uAmbientStrength: sample?.ambientStrength || 0,
    uLightColor: sample?.lightColor || [1, 1, 1],
    uLightStrength: sample?.lightStrength || 0,
    uSourceGain: sample?.sourceGain ?? 1,
    uDirection: sample?.direction || [0, 1],
    uFlicker: flicker,
  };
}
