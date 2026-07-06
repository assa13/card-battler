import { useCallback, useEffect, useRef, useState } from 'react';

// Ночной сплеш (фаза NIGHT_SPLASH ночного события в Таверне).
//
// Поведение:
//  1. Медленный атмосферный fade-in (~1.8s ease-in) — нагнетание.
//  2. Нарратив печатается тайпрайтером (та же механика, что SpeechBubble):
//     клик ВО ВРЕМЯ печати лишь ускоряет её x4 — пропустить сплеш нельзя.
//  3. Подсказка «Нажмите любую кнопку...» появляется ТОЛЬКО после 100% текста;
//     с этого момента клик или любая клавиша вызывают onComplete.

const NIGHT_TEXT = 'В ночи нас посетил таинственный посетитель...\nКто-то настойчиво стучит в дверь таверны.';
const TYPE_MS_PER_CHAR = 55; // медленнее пузырей — кинематографический ритм

const NightSplashOverlay = ({ text = NIGHT_TEXT, onComplete }) => {
  const [visibleChars, setVisibleChars] = useState(0);
  const [speedMult, setSpeedMult] = useState(1);
  const speedRef = useRef(speedMult);
  useEffect(() => { speedRef.current = speedMult; }, [speedMult]);

  const finished = visibleChars >= text.length;
  const finishedRef = useRef(false);
  useEffect(() => { finishedRef.current = finished; }, [finished]);

  // Тайпрайтер стартует после fade-in подложки (задержка ~1.2s),
  // чтобы текст не печатался по ещё невидимому экрану.
  useEffect(() => {
    let i = 0;
    let timer;
    const tick = () => {
      i += 1;
      setVisibleChars(i);
      if (i >= text.length) return;
      timer = setTimeout(tick, TYPE_MS_PER_CHAR / speedRef.current);
    };
    timer = setTimeout(tick, 1200);
    return () => clearTimeout(timer);
  }, [text]);

  const handleAdvance = useCallback(() => {
    // Строгая блокировка: пока текст не допечатан — только ускорение, не выход.
    if (!finishedRef.current) { setSpeedMult(4); return; }
    onComplete?.();
  }, [onComplete]);

  // «Любая кнопка» — честно слушаем и клавиатуру, не только клик.
  useEffect(() => {
    const onKey = () => handleAdvance();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAdvance]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center cursor-pointer select-none"
      style={{ zIndex: 9650, animation: 'nightSplashFadeIn 1.8s ease-in both' }}
      onClick={handleAdvance}
    >
      {/* Арт ночной таверны снаружи + виньетка, чтобы текст читался */}
      <div className="absolute inset-0 bg-black" />
      <img
        src="./bg/locations/night_tavern.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover select-none"
        style={{ imageRendering: 'pixelated' }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.9) 85%)' }}
      />

      {/* Текст прижат к нижней трети — не перекрывает дом с фигурой у двери */}
      <div className="relative w-full h-full flex flex-col items-center justify-end gap-6 px-10 pb-[7vh] text-center">
        <p
          className="max-w-3xl text-slate-300 font-serif italic text-2xl leading-relaxed tracking-wide whitespace-pre-wrap drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
          style={{ minHeight: '4.5em' }}
        >
          {text.slice(0, visibleChars)}
          {!finished && visibleChars > 0 && <span className="animate-pulse">▌</span>}
        </p>
        {/* Подсказка проявляется ТОЛЬКО после полного текста */}
        <div
          className="text-slate-500 text-[11px] uppercase tracking-[0.4em]"
          style={{
            opacity: 0,
            animation: finished ? 'nightSplashHintIn 1s ease-in 0.3s forwards' : 'none',
          }}
        >
          Нажмите любую кнопку, чтобы продолжить
        </div>
      </div>

      <style>{`
        @keyframes nightSplashFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nightSplashHintIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default NightSplashOverlay;
