import { GROUND_SHADOW_BACKGROUND } from './lighting/groundShadow';
import { TAVERN_STAGE_RATIO } from './TavernSceneConfig';
import { TAVERN_LIGHT_DAY } from './tavernLight';
import SceneLighting from './lighting/SceneLighting';

// Освещение окружения Таверны (zIndex 6–8): над фоном и огнём, под всеми
// спрайтами и их метками. Ночь меняет только эмбиент спрайтов (tavernLight.js),
// окружение темнит ночная тонировка в TavernHubScreen.
export default function TavernLighting() {
  return <SceneLighting scene={TAVERN_LIGHT_DAY} zBase={6} />;
}

// Тени на полу (zIndex 9): отдельный слой под всеми спрайтами, чтобы тень
// стола не ложилась поверх посетителя, стоящего за ним. Геометрия — из pos/scale
// сущности и её `shadow` (доли бокса), смещение от огня — из entity.light.
export function TavernShadows({ entities }) {
  return entities.map((e) => {
    const boxH = e.scale * 100; // % высоты сцены
    const boxW = (boxH * (e.aspect ?? 1)) / TAVERN_STAGE_RATIO; // % ширины сцены
    const shift = e.light?.shadowShift ?? 0;
    const stretch = e.light?.shadowStretch ?? 1;
    return (
      <div
        key={`shadow_${e.id}`}
        className="absolute pointer-events-none"
        style={{
          left: `${parseFloat(e.pos.left) + shift * boxW}%`,
          top: `${parseFloat(e.pos.top) + (e.shadow.top - 0.5) * boxH}%`,
          width: `${e.shadow.width * stretch * boxW}%`,
          height: `${e.shadow.height * boxH}%`,
          transform: 'translate(-50%, -50%)',
          zIndex: 9,
          background: GROUND_SHADOW_BACKGROUND,
        }}
      />
    );
  });
}
