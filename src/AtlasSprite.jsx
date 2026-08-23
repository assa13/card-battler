import React, { useEffect, useState } from 'react';
import { spriteColorizeFilter } from './spriteColorize';

// Общий рендерер анимированного атлас-спрайта (или статичного <img>, если атлас
// не задан). Раньше был приватной копией внутри TavernHubScreen — вынесен сюда,
// чтобы Таверна и другие сцены (ночная встреча и т.д.) анимировали персонажей
// ОДИНАКОВО, без рассинхрона поведения между копипастами.
//
// Рассинхрон массовки: каждый инстанс стартует со случайного кадра и со
// случайной задержкой первого тика — иначе все копии двигаются в такт.
const AtlasSprite = React.memo(({ sprite, assetUrl, alt = '', hue, sat }) => {
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

  if (!sprite) {
    return (
      <img
        src={assetUrl}
        alt={alt}
        draggable={false}
        className="w-auto h-full block select-none"
        style={{
          imageRendering: 'pixelated',
          ...(hue != null ? { filter: spriteColorizeFilter(hue, sat) } : {}),
        }}
        onError={(e) => { e.currentTarget.style.opacity = 0; }}
      />
    );
  }
  const col = frame % sprite.cols;
  const row = Math.floor(frame / sprite.cols);
  return (
    <div
      className="h-full aspect-square overflow-hidden relative"
      style={hue != null ? { filter: spriteColorizeFilter(hue, sat) } : undefined}
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
    </div>
  );
});

export default AtlasSprite;
