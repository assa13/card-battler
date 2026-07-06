import { useEffect, useRef, useState } from 'react';

// Пиксель-арт пузырь реплики (техника codepen ZEZWyeM):
// рамка собирается из ДВУХ наложенных прямоугольников-слоёв —
//   слой A: отступ слева/справа на 1 юнит, бордеры сверху/снизу;
//   слой B: отступ сверху/снизу на 1 юнит, бордеры слева/справа.
// Их объединение даёт прямоугольник со «срезанными» угловыми пикселями
// и ступенчатым контуром — классический 8-битный скруглённый угол.
//
// Размер НЕ растёт во время печати: невидимый span с ПОЛНЫМ текстом
// резервирует финальные габариты сразу, тайпрайтер печатает поверх.
// Рост вверх обеспечивает родитель (DialogueOverlay, анкер за низ).

const PX = 4;                 // юнит «пикселя» рамки
const PAPER = '#f8f1e0';      // бумага
const INK = '#241c14';        // контур/текст

const TYPE_MS_PER_CHAR = 34;

const SpeechBubble = ({ text, name, speedMult = 1, onTypingDone }) => {
  // key проставляется родителем на каждую реплику — компонент монтируется заново,
  // поэтому visibleChars честно стартует с 0 без сбросов в эффекте.
  const [visibleChars, setVisibleChars] = useState(0);
  const doneRef = useRef(false);
  const speedRef = useRef(speedMult);
  useEffect(() => { speedRef.current = speedMult; }, [speedMult]);

  useEffect(() => {
    let i = 0;
    let timer;
    const tick = () => {
      i += 1;
      setVisibleChars(i);
      if (i >= text.length) {
        if (!doneRef.current) { doneRef.current = true; onTypingDone?.(); }
        return;
      }
      timer = setTimeout(tick, TYPE_MS_PER_CHAR / speedRef.current);
    };
    timer = setTimeout(tick, TYPE_MS_PER_CHAR / speedRef.current);
    return () => clearTimeout(timer);
    // Перезапуск ТОЛЬКО при смене текста — скорость меняется на лету через ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const finished = visibleChars >= text.length;

  const textStyle = {
    fontFamily: '"Courier New", monospace',
    fontSize: 14,
    lineHeight: 1.3,
    fontWeight: 700,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  };

  return (
    <div className="flex flex-col items-center" style={{ imageRendering: 'pixelated' }}>
      <div className="relative select-none" style={{ maxWidth: 200 }}>
        {/* Пиксельное скругление радиуса 2: три слоя, у каждого — бумага + свои бордеры.
            Белая часть СТУПЕНЧАТАЯ вместе с контуром (угол: пусто → диагональный
            иньк-пиксель → бумага), иначе скругление не читается как пиксель-арт. */}
        {/* Слой A: центральная колонна, бордеры сверху/снизу, срез углов по X на 2 юнита */}
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: PX * 2, right: PX * 2, background: PAPER, borderTop: `${PX}px solid ${INK}`, borderBottom: `${PX}px solid ${INK}`, boxSizing: 'border-box' }} />
        {/* Слой B: рамка-кольцо со всех сторон на 1 юнит внутрь — даёт диагональный пиксель угла */}
        <div style={{ position: 'absolute', top: PX, bottom: PX, left: PX, right: PX, background: PAPER, border: `${PX}px solid ${INK}`, boxSizing: 'border-box' }} />
        {/* Слой C: центральная полоса, бордеры слева/справа, срез углов по Y на 2 юнита */}
        <div style={{ position: 'absolute', top: PX * 2, bottom: PX * 2, left: 0, right: 0, background: PAPER, borderLeft: `${PX}px solid ${INK}`, borderRight: `${PX}px solid ${INK}`, boxSizing: 'border-box' }} />

        {/* Контент: невидимый полный текст держит ФИНАЛЬНЫЙ размер с первого кадра */}
        <div className="relative" style={{ padding: `${PX * 2.5}px ${PX * 3}px`, color: INK }}>
          {name && (
            <div className="uppercase tracking-wider" style={{ fontSize: 11, fontWeight: 900, color: '#8a6d3b', marginBottom: PX, fontFamily: '"Courier New", monospace' }}>
              {name}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <span style={{ ...textStyle, visibility: 'hidden' }}>{text}</span>
            <span style={{ ...textStyle, position: 'absolute', inset: 0 }}>
              {text.slice(0, visibleChars)}
              {!finished && <span className="animate-pulse">▌</span>}
            </span>
          </div>
          {finished && (
            <span className="absolute animate-bounce" style={{ right: PX * 2, bottom: PX / 2, fontSize: 11, color: '#8a6d3b' }}>▼</span>
          )}
        </div>
      </div>
      {/* Хвостик: два убывающих пиксель-прямоугольника, всегда снизу по центру */}
      <div style={{ width: PX * 4, height: PX, background: PAPER, boxShadow: `${-PX}px 0 0 0 ${INK}, ${PX}px 0 0 0 ${INK}` }} />
      <div style={{ width: PX * 2, height: PX, background: PAPER, boxShadow: `${-PX}px 0 0 0 ${INK}, ${PX}px 0 0 0 ${INK}, 0 ${PX}px 0 0 ${INK}` }} />
    </div>
  );
};

export default SpeechBubble;
