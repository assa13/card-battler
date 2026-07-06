import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import SpeechBubble from './SpeechBubble';

// Экран-агностик оверлей диалогов.
//
// Не знает координат Таверны (или любого другого экрана): по speakerId ищет
// DOM-якорь ([data-entity-id=...] либо #sprite-...) и через getBoundingClientRect
// вешает пузырь НАД ним. Якорение — за нижнюю кромку (bottom), поэтому при
// длинном тексте пузырь растёт вверх, а хвостик остаётся у головы спикера.
//
// Взаимодействие — невидимый полноэкранный клик-катчер (fixed inset-0 z-999):
//   клик во время печати  → ускорение тайпрайтера x4;
//   клик после печати     → следующая реплика или закрытие.
//
// Если DOM-узел спикера не найден (спикер скрыт/экран сменился) — реплика
// молча пропускается, следующая по цепочке. Позиция трекается на rAF, чтобы
// пузырь не отклеивался при ресайзе/анимациях сцены.

const findSpeakerEl = (speakerId) =>
  document.querySelector(`[data-entity-id="${speakerId}"]`) ||
  document.getElementById(`sprite-${speakerId}`);

const DialogueOverlay = ({ lines, onComplete }) => {
  const [lineIdx, setLineIdx] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [anchor, setAnchor] = useState(null); // { x, bottomY } в координатах viewport
  const bubbleRef = useRef(null);

  const line = lines?.[lineIdx] ?? null;

  // Трекинг позиции якоря на rAF: дешёво (одна rect-выборка за кадр) и
  // переживает ресайз окна, ленивую загрузку ассетов и анимации сцены.
  useLayoutEffect(() => {
    if (!line) return;
    let rafId;
    const track = () => {
      const el = findSpeakerEl(line.speakerId);
      if (el) {
        const r = el.getBoundingClientRect();
        // Точка над «головой»: центр по X. +24px вниз от верха bbox — спрайты
        // имеют воздух сверху, пузырь садится ближе к макушке персонажа.
        setAnchor({ x: r.left + r.width / 2, bottomY: r.top + 24 });
      } else {
        setAnchor(null);
      }
      rafId = requestAnimationFrame(track);
    };
    rafId = requestAnimationFrame(track);
    return () => cancelAnimationFrame(rafId);
  }, [line]);

  const advance = useCallback(() => {
    setTypingDone(false);
    setSpeedMult(1);
    if (lineIdx + 1 >= (lines?.length ?? 0)) { onComplete?.(); return; }
    setLineIdx(lineIdx + 1);
  }, [lineIdx, lines, onComplete]);

  // Спикер так и не нашёлся в DOM — пропускаем реплику (через микро-таймаут,
  // чтобы дать сцене шанс домонтироваться после первого кадра).
  useEffect(() => {
    if (!line) return;
    const t = setTimeout(() => {
      if (!findSpeakerEl(line.speakerId)) advance();
    }, 350);
    return () => clearTimeout(t);
  }, [line, advance]);

  const handleCatcherClick = useCallback((e) => {
    e.stopPropagation();
    if (!typingDone) { setSpeedMult(4); return; } // State 1: ускоряем печать
    advance();                                     // State 2: дальше / закрыть
  }, [typingDone, advance]);

  if (!line) return null;

  return (
    <>
      {/* Невидимый полноэкранный клик-катчер — НЕ трогает нижние слои визуально */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9990, cursor: 'pointer' }}
        onClick={handleCatcherClick}
      />
      {/* Пузырь: fixed-позиционирование за НИЖНЮЮ кромку (растёт вверх) */}
      {anchor && (
        <div
          ref={bubbleRef}
          style={{
            position: 'fixed',
            left: anchor.x,
            top: anchor.bottomY,
            transform: 'translate(-50%, -100%)',
            zIndex: 9991,
            pointerEvents: 'none',
          }}
        >
          <SpeechBubble
            key={`${lineIdx}-${line.speakerId}`}
            text={line.text}
            name={line.name}
            speedMult={speedMult}
            onTypingDone={() => setTypingDone(true)}
          />
        </div>
      )}
    </>
  );
};

export default DialogueOverlay;
