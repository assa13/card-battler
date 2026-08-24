import React, { useEffect, useRef, useState } from 'react';
import { qteSlowMo } from './qteTimeScale';
import { spriteColorizeFilter } from './spriteColorize';

// Анимированный спрайт из атласа. Покраска — CSS filter на видимый кадр, без оверлея поверх.
// gameTime: кадры листаются rAF-циклом в ИГРОВОМ времени (dt × qteSlowMo.scale) —
// анимация атаки замедляется под bullet-time QTE синхронно с миром. Idle остаётся
// на setInterval (реальное время, дешевле).
// ФАЗЫ QTE-ЗАМАХА (управляются пропсами, эффект перезапускается БЕЗ сброса кадра):
//  - holdAtFrame: замах доходит до кадра перед ударом и ЖДЁТ на нём — анимация
//    не завершается сама, только по вердикту кольца (клик или miss);
//  - speed + ignoreSlowMo: быстрый доигрыш до конца в реальном времени (клик);
//  - once: цикл играется один раз, затем заморозка на последнем кадре (без лупа).
// onCycle — завершение полного прохода кадров; родитель решает, вернуть ли idle.
// При смене key компонент ремоунтится — кадр стартует с 0.
const CharSprite = React.memo(({ atlas, size = 110, className = '', style = {}, hue, sat, gameTime = false, ignoreSlowMo = false, speed = 1, holdAtFrame = null, once = false, paused = false, onCycle }) => {
  const [frame, setFrame] = useState(0);
  const onCycleRef = useRef(onCycle);
  useEffect(() => { onCycleRef.current = onCycle; }, [onCycle]);
  // Кадр/аккумулятор в рефах: смена фазы (holdAtFrame/speed) перезапускает эффект,
  // но анимация продолжается с текущего кадра, а не начинается заново.
  const frameRef = useRef(0);
  const accRef = useRef(0);
  const doneRef = useRef(false);
  useEffect(() => {
    if (!atlas || paused) return;
    const frameMs = 1000 / (atlas.fps || 12);
    if (!gameTime) {
      const id = setInterval(() => {
        setFrame((f) => (f + 1) % atlas.frameCount);
      }, frameMs);
      return () => clearInterval(id);
    }
    if (doneRef.current) return; // once: цикл доигран, стоим на последнем кадре
    let rafId = 0;
    let last = performance.now();
    const tick = (ts) => {
      const dt = Math.min(100, ts - last);
      last = ts;
      accRef.current += dt * (ignoreSlowMo ? 1 : qteSlowMo.scale) * speed;
      if (accRef.current >= frameMs) {
        const adv = Math.floor(accRef.current / frameMs);
        accRef.current -= adv * frameMs;
        let next = frameRef.current + adv;
        if (holdAtFrame != null && next >= holdAtFrame) {
          next = holdAtFrame; // холд: ждём вердикта QTE на кадре перед ударом
        } else if (next >= atlas.frameCount) {
          if (once) { next = atlas.frameCount - 1; doneRef.current = true; }
          else next %= atlas.frameCount;
          onCycleRef.current?.();
        }
        if (next !== frameRef.current) { frameRef.current = next; setFrame(next); }
        if (doneRef.current) return; // стоп rAF: заморожены на последнем кадре
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [atlas, gameTime, ignoreSlowMo, speed, holdAtFrame, once, paused]);
  if (!atlas) return null;
  const col = frame % atlas.cols;
  const row = Math.floor(frame / atlas.cols);
  const sheetW = atlas.cols * size;
  const sheetH = atlas.rows * size;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        overflow: 'hidden',
        ...(hue != null ? { filter: spriteColorizeFilter(hue, sat) } : {}),
        ...style,
      }}
    >
      <img
        src={atlas.url}
        alt=""
        draggable={false}
        className="block max-w-none select-none"
        style={{
          width: sheetW,
          height: sheetH,
          marginLeft: -col * size,
          marginTop: -row * size,
          imageRendering: 'pixelated',
        }}
      />
    </div>
  );
});

export default CharSprite;
