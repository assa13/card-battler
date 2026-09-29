import LightLayers from './lighting/SpriteLightLayers';
import React, { useEffect, useState } from 'react';
import { spriteColorizeFilter } from './spriteColorize';

// Общий рендерер анимированного атлас-спрайта (или статичного <img>, если атлас
// не задан). Раньше был приватной копией внутри TavernHubScreen — вынесен сюда,
// чтобы Таверна и другие сцены (ночная встреча и т.д.) анимировали персонажей
// ОДИНАКОВО, без рассинхрона поведения между копипастами.
//
// Рассинхрон массовки: каждый инстанс стартует со случайного кадра и со
// случайной задержкой первого тика — иначе все копии двигаются в такт.
//
// light (опционально, см. lighting/lightModel.js): { filter, layers }.
// Слои света рисуются поверх спрайта и обрезаются его альфой через mask-image
// с тем же кадром атласа, поэтому свет ложится только на силуэт.
const joinFilters = (...filters) => filters.filter(Boolean).join(' ') || undefined;

const AtlasSprite = React.memo(({ sprite, assetUrl, alt = '', hue, sat, light }) => {
  const [frame, setFrame] = useState(() => Math.floor(Math.random() * (sprite?.frameCount ?? 1)));
  useEffect(() => {
    if (!sprite) return;
    const fps = sprite.fps || 10;
    const period = 1000 / fps;
    let intervalId;
    const phaseId = setTimeout(() => {
      setFrame(f => (f + 1) % sprite.frameCount);
      intervalId = setInterval(() => setFrame(f => (f + 1) % sprite.frameCount), period);
    }, Math.random() * period);
    return () => { clearTimeout(phaseId); clearInterval(intervalId); };
  }, [sprite]);

  const colorize = hue != null ? spriteColorizeFilter(hue, sat) : null;

  if (!sprite) {
    const img = (
      <img
        src={assetUrl}
        alt={alt}
        draggable={false}
        className="w-auto h-full block select-none"
        style={{
          imageRendering: 'pixelated',
          ...(!light && colorize ? { filter: colorize } : {}),
        }}
        onError={(e) => { e.currentTarget.style.opacity = 0; }}
      />
    );
    if (!light) return img;
    return (
      <div className="relative inline-block align-top h-full" style={{ filter: joinFilters(colorize, light.filter) }}>
        {img}
        <LightLayers layers={light.layers} url={assetUrl} maskSize="100% 100%" maskPosition={[0, 0]} />
      </div>
    );
  }
  const col = frame % sprite.cols;
  const row = Math.floor(frame / sprite.cols);
  const filter = joinFilters(colorize, light?.filter);
  return (
    <div
      className="h-full aspect-square overflow-hidden relative"
      style={filter ? { filter } : undefined}
    >
      <img
        src={sprite.url}
        alt={alt}
        draggable={false}
        className="block max-w-none absolute top-0 left-0 select-none"
        style={{
          height: `${sprite.rows * 100}%`,
          width: `${sprite.cols * 100}%`,
          transform: `translate(${-col * (100 / sprite.cols)}%, ${-row * (100 / sprite.rows)}%)`,
          imageRendering: 'pixelated',
        }}
        onError={(e) => { e.currentTarget.style.opacity = 0; }}
      />
      {light && (
        <LightLayers
          layers={light.layers}
          url={sprite.url}
          maskSize={`${sprite.cols * 100}% ${sprite.rows * 100}%`}
          maskPosition={[
            sprite.cols > 1 ? (col / (sprite.cols - 1)) * 100 : 0,
            sprite.rows > 1 ? (row / (sprite.rows - 1)) * 100 : 0,
          ]}
        />
      )}
    </div>
  );
});

export default AtlasSprite;
