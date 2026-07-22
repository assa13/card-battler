import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import SpeechBubble from '../SpeechBubble';
import { createRunState, getVisibleChoices, runCommands } from './scriptRunner';
import { BASE_WIDTH, BASE_HEIGHT, computeStageRect } from '../screenScale';

const GREYBEARD = '"Greybeard", monospace';

// Раннер ветвящихся диалог-скриптов (см. scriptRunner.js и docs/dialogue-authoring.md).
//
// Два визуальных варианта (`variant` prop):
//   'bubble' (по умолчанию) — пиксель-арт SpeechBubble, якорится к DOM-узлу
//     спикера (data-entity-id), как DialogueOverlay.
//   'plate' — плашка текста + кнопки-«заклёпки» встроены В КОМПОЗИЦИЮ окна
//     (Figma frame `dialogue` 3721:13570), координаты — доля холста 3200×1800.
//     Использует computeStageRect() вместо DOM-измерений: позиция/масштаб
//     считаются из тех же формул, что и CSS-скейл ScreenStage — синхронно
//     с летербоксом без rAF-поллинга DOM.
//
// После последней реплики узла показывает панель ВЫБОРОВ (если они есть);
// выбор может выполнить команды и прыгнуть в следующий узел.
//
// Внешние команды скрипта (награды, завершение ночи, тосты...) НЕ исполняются
// здесь — они уходят в onCommand, диспетчер живёт на экране-хозяине.
//
// Отличие от DialogueOverlay: если DOM-якорь спикера не найден (variant='bubble'),
// реплика НЕ пропускается (в ветвящейся истории пропуск ломает сюжет) — пузырь
// встаёт в центр верхней трети экрана.

const PX = 4;
const PAPER = '#f8f1e0';
const INK = '#241c14';

const findSpeakerEl = (anchorEntityId) =>
  document.querySelector(`[data-entity-id="${anchorEntityId}"]`) ||
  document.getElementById(`sprite-${anchorEntityId}`);

// Figma frame dialogue 3721:13570 — литеральные px на холсте 3200×1800.
const PLATE_TEXT = { centerX: 1615, top: 1259, width: 2568 };
const PLATE_BTN = { leftA: 776, leftB: 1624, top: 1508, width: 800, height: 192 };

const useStageRect = () => {
  const [rect, setRect] = useState(() =>
    typeof window === 'undefined' ? { left: 0, top: 0, width: 0, height: 0, scale: 1 } : computeStageRect(window.innerWidth, window.innerHeight)
  );
  useEffect(() => {
    const update = () => setRect(computeStageRect(window.innerWidth, window.innerHeight));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return rect;
};

// Кнопка-«заклёпка»: фиксированный bbox, без отрицательных inset — иначе
// две соседние кнопки наезжают друг на друга при масштабе сцены.
const PlateButton = ({ children, onClick, style, scale }) => {
  const b = Math.max(1, Math.round(4 * scale));
  const padX = Math.round(20 * scale);
  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-transform hover:brightness-110 active:scale-[0.97]"
      style={{
        // position по умолчанию absolute (2-кнопочная раскладка передаёт left/top),
        // но flex-контейнер 3+ выборов переопределяет через style.position='static' —
        // поэтому спред style идёт ПОСЛЕ дефолта.
        position: 'absolute',
        margin: 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      <span
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          background: '#3d3d3e',
          borderTop: `${b}px solid #5c5c5c`,
          borderLeft: `${b}px solid #5c5c5c`,
          boxSizing: 'border-box',
          padding: b,
        }}
      >
        <span
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            background: '#1a1a1b',
            borderBottom: `${b}px solid #000`,
            borderRight: `${b}px solid #000`,
            boxSizing: 'border-box',
            padding: `0 ${padX}px`,
          }}
        >
          {[
            { left: 0, top: 0 }, { right: 0, top: 0 },
            { left: 0, bottom: 0 }, { right: 0, bottom: 0 },
          ].map((pos, i) => (
            <span key={i} style={{ position: 'absolute', width: b, height: b, background: '#5c5c5c', ...pos }} />
          ))}
          <span
            style={{
              fontFamily: GREYBEARD,
              fontWeight: 700,
              color: '#ededed',
              fontSize: `${Math.max(11, 55 * scale)}px`,
              letterSpacing: `${Math.max(0.3, 2 * scale)}px`,
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
          >
            {children}
          </span>
        </span>
      </span>
    </button>
  );
};

// Выделение ключевых слов в plate-реплике: `**слово**` → золотистый акцент
// (Figma text_block, сегмент #FFCD76). Разметка опциональна — обычный текст
// без `**` рендерится как один белый сегмент, ничего не меняется.
// Каждому сегменту сразу приписывается [start,end) в общей длине текста —
// иммутабельно через reduce, без мутации счётчика при рендере (см. правило
// react-hooks/purity: реассайн переменной внутри .map() в JSX запрещён).
const HIGHLIGHT_COLOR = '#ffcd76';
const parseHighlightSegments = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean)
    .map((part) => {
      const m = part.match(/^\*\*([^*]+)\*\*$/);
      return m ? { text: m[1], highlight: true } : { text: part, highlight: false };
    })
    .reduce((acc, seg) => {
      const start = acc.length ? acc[acc.length - 1].end : 0;
      return [...acc, { ...seg, start, end: start + seg.text.length }];
    }, []);

// Тайпрайтер для plate-текста (без пузыря/бумаги) — та же скорость печати,
// что и в SpeechBubble, но без рамки/имени спикера (Figma-плашка их не имеет).
// Печатает ПОСЛЕДОВАТЕЛЬНО по сегментам разметки — цвет не ломает тайминг.
const PLATE_TYPE_MS_PER_CHAR = 34;
const PlateTypedText = ({ text, speedMult = 1, onTypingDone }) => {
  const segments = useMemo(() => parseHighlightSegments(text), [text]);
  const totalLen = segments.length ? segments[segments.length - 1].end : 0;
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
      if (i >= totalLen) {
        if (!doneRef.current) { doneRef.current = true; onTypingDone?.(); }
        return;
      }
      timer = setTimeout(tick, PLATE_TYPE_MS_PER_CHAR / speedRef.current);
    };
    timer = setTimeout(tick, PLATE_TYPE_MS_PER_CHAR / speedRef.current);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <>
      {segments.map((seg, i) => {
        const shown = seg.text.slice(0, Math.max(0, Math.min(seg.text.length, visibleChars - seg.start)));
        if (!shown) return null;
        return <span key={i} style={seg.highlight ? { color: HIGHLIGHT_COLOR } : undefined}>{shown}</span>;
      })}
    </>
  );
};

const DialogueScriptOverlay = ({ script, onCommand, onComplete, variant = 'bubble' }) => {
  // visit.n — счётчик переходов: он ключует выполнение команд узла (повторный
  // вход в узел-хаб снова выполняет его команды, а StrictMode-дубль эффекта — нет)
  // и remount пузыря.
  const [visit, setVisit] = useState({ nodeId: script.start, n: 0 });
  const [lineIdx, setLineIdx] = useState(0);
  const [typingDone, setTypingDone] = useState(false);
  const [speedMult, setSpeedMult] = useState(1);
  const [anchor, setAnchor] = useState(null);
  // Видимые выборы текущего узла: вычисляются ОДИН раз на визит (после команд
  // узла), т.к. флаги меняются только командами — читать ref в рендере нельзя.
  const [nodeChoices, setNodeChoices] = useState([]);
  const stateRef = useRef(createRunState());
  const processedVisitRef = useRef(-1);
  const stageRect = useStageRect(); // нужен только variant='plate', но хук должен звать безусловно

  const node = script.nodes[visit.nodeId] ?? null;
  const speaker = node ? script.speakers?.[node.speaker] ?? null : null;
  const lines = node?.lines ?? [];
  const line = lines[lineIdx] ?? null;
  const atLastLine = lineIdx >= lines.length - 1;

  const goto = useCallback((nextId) => {
    setLineIdx(0);
    setTypingDone(false);
    setSpeedMult(1);
    setVisit(v => ({ nodeId: nextId, n: v.n + 1 }));
  }, []);

  // Вход в узел: выполнить команды (ровно один раз на визит), а логический
  // узел без реплик и выборов — сразу проскочить дальше.
  useEffect(() => {
    if (processedVisitRef.current === visit.n) return;
    processedVisitRef.current = visit.n;
    const cur = script.nodes[visit.nodeId] ?? null;
    if (!cur) { onComplete?.(); return; }
    runCommands(cur.commands, stateRef.current, onCommand);
    const visible = getVisibleChoices(cur, stateRef.current);
    setNodeChoices(visible);
    if (!cur.lines?.length && !visible.length) {
      goto(cur.next ?? null);
    }
  }, [visit, script, onCommand, onComplete, goto]);

  // Трекинг якоря спикера на rAF (как в DialogueOverlay) + центр-фоллбэк.
  // Актуально только для variant='bubble' — 'plate' считает позицию из
  // computeStageRect() и не нуждается в DOM-измерениях спикера.
  useLayoutEffect(() => {
    if (variant !== 'bubble' || !line) return;
    let rafId;
    const track = () => {
      const el = speaker?.anchorEntityId ? findSpeakerEl(speaker.anchorEntityId) : null;
      if (el) {
        const r = el.getBoundingClientRect();
        setAnchor({ x: r.left + r.width / 2, bottomY: r.top + 24 });
      } else {
        setAnchor({ x: window.innerWidth / 2, bottomY: window.innerHeight * 0.35 });
      }
      rafId = requestAnimationFrame(track);
    };
    rafId = requestAnimationFrame(track);
    return () => cancelAnimationFrame(rafId);
  }, [variant, line, speaker]);

  if (!node) return null;

  const choicesVisible = atLastLine && (line ? typingDone : true) && nodeChoices.length > 0
    ? nodeChoices
    : [];

  const handleCatcherClick = (e) => {
    e.stopPropagation();
    if (line && !typingDone) { setSpeedMult(4); return; }  // ускорить печать
    if (!atLastLine) {                                      // следующая реплика узла
      setLineIdx(i => i + 1);
      setTypingDone(false);
      setSpeedMult(1);
      return;
    }
    if (choicesVisible.length) return;                      // ждём клика по выбору
    goto(node.next ?? null);                                // дальше по графу / конец
  };

  const handleChoice = (choice) => {
    runCommands(choice.commands, stateRef.current, onCommand);
    goto(choice.next ?? null);
  };

  const catcher = (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9990, cursor: 'pointer' }}
      onClick={handleCatcherClick}
    />
  );

  if (variant === 'plate') {
    const { left, top, width, height, scale } = stageRect;
    const sx = width / BASE_WIDTH;
    const sy = height / BASE_HEIGHT;
    const textStyle = {
      position: 'fixed',
      left: left + PLATE_TEXT.centerX * sx,
      top: top + PLATE_TEXT.top * sy,
      width: PLATE_TEXT.width * sx,
      transform: 'translateX(-50%)',
      zIndex: 9991,
      pointerEvents: 'none',
      textAlign: 'center',
      color: '#fff',
      fontFamily: GREYBEARD,
      fontWeight: 500,
      fontSize: `${Math.max(13, 76 * scale)}px`,
      lineHeight: `${Math.max(18, 112 * scale)}px`,
      textShadow: `0 0 ${Math.max(8, 68 * scale)}px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.9)`,
      whiteSpace: 'pre-wrap',
    };
    const btnW = PLATE_BTN.width * sx;
    const btnH = PLATE_BTN.height * sy;
    const btnTop = top + PLATE_BTN.top * sy;
    const btnLeftA = left + PLATE_BTN.leftA * sx;
    const btnLeftB = left + PLATE_BTN.leftB * sx;

    return (
      <>
        {catcher}
        {line && (
          <div style={textStyle}>
            <PlateTypedText key={`${visit.n}-${lineIdx}`} text={line} speedMult={speedMult} onTypingDone={() => setTypingDone(true)} />
          </div>
        )}
        {choicesVisible.length === 2 ? (
          <>
            <PlateButton
              scale={scale}
              onClick={(e) => { e.stopPropagation(); handleChoice(choicesVisible[0]); }}
              style={{ left: btnLeftA, top: btnTop, width: btnW, height: btnH, zIndex: 9992 }}
            >
              {choicesVisible[0].text}
            </PlateButton>
            <PlateButton
              scale={scale}
              onClick={(e) => { e.stopPropagation(); handleChoice(choicesVisible[1]); }}
              style={{ left: btnLeftB, top: btnTop, width: btnW, height: btnH, zIndex: 9992 }}
            >
              {choicesVisible[1].text}
            </PlateButton>
          </>
        ) : choicesVisible.length > 0 ? (
          <div
            className="fixed flex flex-wrap items-stretch justify-center"
            style={{ left: left + width / 2, top: btnTop, transform: 'translateX(-50%)', width, gap: width * 0.015, zIndex: 9992 }}
          >
            {choicesVisible.map((choice, i) => (
              <PlateButton
                key={i}
                scale={scale}
                onClick={(e) => { e.stopPropagation(); handleChoice(choice); }}
                style={{ position: 'static', minWidth: btnW * 0.8, height: btnH }}
              >
                {choice.text}
              </PlateButton>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {catcher}

      {/* Пузырь текущей реплики */}
      {line && anchor && (
        <div
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
            key={`${visit.n}-${lineIdx}`}
            text={line}
            name={speaker?.name}
            speedMult={speedMult}
            onTypingDone={() => setTypingDone(true)}
          />
        </div>
      )}

      {/* Панель выборов: пиксель-стиль в тон пузырям, низ экрана по центру */}
      {choicesVisible.length > 0 && (
        <div
          className="fixed left-1/2 -translate-x-1/2 flex flex-col items-stretch"
          style={{ bottom: '9%', zIndex: 9992, gap: PX * 2, minWidth: 260, maxWidth: 420 }}
        >
          {choicesVisible.map((choice, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); handleChoice(choice); }}
              className="text-left transition-transform hover:scale-[1.03] active:scale-95"
              style={{
                fontFamily: '"Courier New", monospace',
                fontWeight: 700,
                fontSize: 14,
                color: INK,
                background: PAPER,
                border: `${PX}px solid ${INK}`,
                boxShadow: `${PX}px ${PX}px 0 0 rgba(0,0,0,0.55)`,
                padding: `${PX * 2}px ${PX * 3}px`,
                imageRendering: 'pixelated',
                cursor: 'pointer',
              }}
            >
              <span style={{ color: '#8a6d3b', marginRight: PX * 2 }}>▸</span>
              {choice.text}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default DialogueScriptOverlay;
