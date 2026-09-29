import { FLICKER, rgba, lightAnimation } from './lightModel';
import { NATURAL_FIRE_KEYFRAMES } from './fireFlicker';

// Освещение ОКРУЖЕНИЯ сцены по описанию scene (см. lightModel.js):
// полноэкранные CSS-слои над фоном и под спрайтами. Спрайты освещаются
// индивидуально (computeSpriteLight → AtlasSprite), поэтому метки сущностей
// остаются над светом.
//
// Порядок (zBase … zBase+2, внутри одного z — порядок DOM):
//   shade    — multiply: затенение, растёт с удалением от главного света;
//   tint     — overlay: цветной оттенок средних тонов вокруг источника;
//   glow     — screen: подсветка + пятно на полу (floor);
//   core     — screen: горячее ядро источника;
//   vignette — чёрная кромка кадра: гасит засветку у краёв сцены.
// Размеры эллипсов — доли радиуса света (в % высоты), по X пересчёт через ratio.

const layer = (zIndex, mixBlendMode, background, animation) => ({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex,
  mixBlendMode,
  background,
  animation,
  willChange: animation ? 'opacity' : undefined,
});

const ellipse = (scene, x, y, rH, rV, color, alpha) =>
  `radial-gradient(ellipse ${(rH / scene.ratio).toFixed(2)}% ${rV.toFixed(2)}% at ${x}% ${y}%,`
  + ` ${rgba(color, alpha)} 0%, ${rgba(color, alpha * 0.45)} 40%, ${rgba(color, 0)} 100%)`;

function LightEnv({ scene, light: L, zBase }) {
  const R = L.radius;
  const env = L.env ?? {};
  const anim = lightAnimation(L);
  const glow = [
    env.floor && ellipse(scene, L.x + (env.floorOffsetX ?? 6), L.y + (env.floorOffsetY ?? 20), 0.84 * R, 0.2 * R, L.color, env.floor),
    env.glow && ellipse(scene, L.x, L.y, 0.9 * R, 0.83 * R, L.color, env.glow),
  ].filter(Boolean).join(',');
  return (
    <>
      {env.tint > 0 && (
        <div style={layer(zBase + 1, 'overlay', ellipse(scene, L.x, L.y, 1.45 * R, 1.33 * R, L.color, env.tint), anim)} />
      )}
      {glow && <div style={layer(zBase + 1, 'screen', glow, anim)} />}
      {env.core > 0 && (
        <div style={layer(zBase + 2, 'screen', ellipse(scene, L.x, L.y + 2, 0.225 * R, 0.23 * R, L.coreColor ?? L.color, env.core), L.flicker ? FLICKER.fireCore : undefined)} />
      )}
    </>
  );
}

const vignetteBackground = (scene) => {
  const v = scene.vignette;
  const bandX = (v.band / scene.ratio).toFixed(2);
  const edge = `rgba(0,0,0,${v.edge})`;
  return [
    `linear-gradient(to right, ${edge} 0%, rgba(0,0,0,0) ${bandX}%)`,
    `linear-gradient(to left, ${edge} 0%, rgba(0,0,0,0) ${bandX}%)`,
    `linear-gradient(to bottom, ${edge} 0%, rgba(0,0,0,0) ${v.band}%)`,
    `linear-gradient(to top, ${edge} 0%, rgba(0,0,0,0) ${v.band}%)`,
    `radial-gradient(ellipse farthest-corner at 50% 50%, rgba(0,0,0,0) ${v.start * 100}%, rgba(0,0,0,${v.strength}) 100%)`,
  ].join(',');
};

export default function SceneLighting({ scene, zBase = 6 }) {
  const main = scene.lights[0];
  return (
    <>
      {scene.shade && main && (
        <div
          style={layer(zBase, 'multiply',
            `radial-gradient(ellipse ${(3.55 * main.radius / scene.ratio).toFixed(2)}% ${(2.17 * main.radius).toFixed(2)}% at ${main.x}% ${main.y}%,`
            + ` #ffffff 0%, #ffffff 20%, ${rgba(scene.shade.color, 1)} 100%)`)}
        />
      )}
      {scene.lights.map((L, i) => <LightEnv key={i} scene={scene} light={L} zBase={zBase} />)}
      {scene.vignette && <div style={layer(zBase + 2, 'normal', vignetteBackground(scene))} />}
      <style>{`
        ${NATURAL_FIRE_KEYFRAMES}
        @keyframes sceneLightFlicker {
          0%   { opacity: 1; }
          13%  { opacity: 0.86; }
          27%  { opacity: 0.97; }
          41%  { opacity: 0.82; }
          58%  { opacity: 1; }
          72%  { opacity: 0.9; }
          86%  { opacity: 0.95; }
        }
        @keyframes sceneLightCore {
          0%   { opacity: 0.9; }
          18%  { opacity: 0.65; }
          35%  { opacity: 1; }
          52%  { opacity: 0.75; }
          70%  { opacity: 0.95; }
          85%  { opacity: 0.7; }
        }
      `}</style>
    </>
  );
}
