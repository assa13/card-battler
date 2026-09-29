import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import NineSlice from './NineSlice';
import useStageSpace from './useStageSpace';

/**
 * Базовое модальное окно игры. Макет — Figma 517:5425 (modal_window), файл
 * zG9zihyiBTJFjR5dVta74Z, все размеры ниже в пикселях холста 3200×1800.
 *
 * Окно не коробка по центру, а лента во всю ширину экрана: рамка примыкает
 * боками к его кромкам, поэтому ширина считается не из макета, а из текущего
 * окна браузера (`useStageSpace`). По вертикали лента живёт по правилам сцены —
 * центр на 918 пикселях холста, дальше всё едет вместе с масштабом.
 *
 * Высота собирается из содержимого: отступы рамки постоянные, растёт только
 * блок текста между заголовком и кнопками.
 *
 * Дальше это окно — основа для всех модалок: снаружи задаются заголовок, текст
 * и набор кнопок, геометрия внутри одна на всех.
 */

// Вертикальный ритм ленты, от верхней кромки рамки вниз.
const PAD_TOP = 252; // до первой строки текста
const GAP_BEFORE_BUTTONS = 150; // от текста до кнопок
const PAD_BOTTOM = 150; // от кнопок до нижней кромки
const CENTER_Y = 918; // центр ленты на холсте
const MIN_HEIGHT = 787; // рамка из макета; ниже у location_frame не остаётся центра

// Лента уходит за кромки экрана: край рамки срезан, а не упирается в него.
const OVERHANG = 100;

const DEFAULT_CONTENT_WIDTH = 1399;
const CONTENT_MIN_HEIGHT = 105; // одна-две строки текста из макета
const PLATE_TOP = 42; // card_bg утоплен под верхнюю кромку рамки

const BUTTON = { width: 594, height: 130, gap: 38 };

// Плашка заголовка в атласе 444×95, а в макете нарисована крупнее. Множитель
// округлён до 1.6 (95 → 152 вместо 148.44): нецелые доли пикселя в пиксель-арте
// съедают кромку, а разница в три с половиной пикселя на глаз не видна.
// Растягивается плашка по тексту: центр у неё 16×3, поэтому 9-slice рисуется в
// родном размере атласа и увеличивается целиком — иначе острия по краям
// остались бы мелкими.
const HEADER = { scale: 1.6, native: 95, padX: 362, rise: 28 };
const HEADER_MIN_WIDTH = 710;

// Размытие фона из макета (22 px холста). Подложка лежит в экранных пикселях,
// поэтому радиус приводится к ним масштабом сцены.
const BACKDROP_BLUR = 22;

const FONT = "'Greybeard', sans-serif";
const TEXT_COLOR = '#fffdcc';

// Тексты привязаны к центру своего бокса, а не к верхней кромке: Figma отдаёт
// координаты обрезанными по cap-height, и привязка за верх уехала бы на разницу
// метрик шрифта.
const TITLE = { fontSize: 88, fontWeight: 700, textShadow: '0px 6.25px 0px black' };
const MESSAGE = { fontSize: 66, fontWeight: 500, textShadow: '0px 7.656px 0px black' };
const LABEL = { fontSize: 66, fontWeight: 700, textShadow: '0px 7.656px 0px black' };

/** Размер элемента в пикселях макета: он внутри scale(), offset* его не видит. */
const useMeasure = (ref, read, fallback) => {
  const [value, setValue] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const measure = () => setValue(read(node));
    measure();
    // Шрифт догружается после первой отрисовки — наблюдатель поймает и это.
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, read]);
  return value;
};

const readWidth = (node) => node.offsetWidth;
const readHeight = (node) => node.offsetHeight;

/** Кнопка ряда. kind: 'default' | 'red' — две плашки из атласа. */
const ModalButton = ({ button, left, top }) => (
  <button
    type="button"
    onClick={button.onClick}
    disabled={button.disabled}
    title={button.title}
    className={`absolute block transition-transform ${button.disabled ? 'cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
    style={{
      left,
      top,
      width: BUTTON.width,
      height: BUTTON.height,
      // Выключенного состояния в макете нет: гасим плашку целиком, чтобы она
      // читалась как недоступная, но оставалась на своём месте в ряду.
      opacity: button.disabled ? 0.45 : 1,
    }}
  >
    <NineSlice
      name={button.kind === 'red' ? 'button_red' : 'button_default'}
      width={BUTTON.width}
      height={BUTTON.height}
      style={{ position: 'absolute', left: 0, top: 0 }}
    />
    {/* 62 — центр капители надписи: она стоит выше середины кнопки, потому что
        низ плашки толще верха. */}
    <p
      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center"
      style={{ top: 62, color: TEXT_COLOR, ...LABEL }}
    >
      {button.label}
    </p>
  </button>
);

const ModalWindow = ({
  title,
  message,
  children,
  buttons = [],
  onDismiss,
  contentWidth = DEFAULT_CONTENT_WIDTH,
  zIndex = 9600,
}) => {
  const space = useStageSpace();
  const titleRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    if (!onDismiss) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  // Лента во всю ширину окна плюс свес за обе кромки, в пикселях холста.
  const bandWidth = space.canvasSize(space.width + space.left * 2) + OVERHANG * 2;

  const measuredContent = useMeasure(contentRef, readHeight, CONTENT_MIN_HEIGHT);
  const contentHeight = Math.max(measuredContent, CONTENT_MIN_HEIGHT);
  // Без кнопок (выбор делается самим содержимым) ряд не занимает места.
  const buttonsBlock = buttons.length ? GAP_BEFORE_BUTTONS + BUTTON.height : 0;
  const height = Math.max(PAD_TOP + contentHeight + buttonsBlock + PAD_BOTTOM, MIN_HEIGHT);
  const top = CENTER_Y - height / 2;

  // Ширина плашки — от длины заголовка: поля по бокам постоянные, как в макете.
  const titleWidth = useMeasure(titleRef, readWidth, 1144);
  const headerNative = Math.ceil(Math.max(titleWidth + HEADER.padX * 2, HEADER_MIN_WIDTH) / HEADER.scale);
  const headerWidth = headerNative * HEADER.scale;
  const headerHeight = HEADER.native * HEADER.scale;

  const buttonsTop = PAD_TOP + contentHeight + GAP_BEFORE_BUTTONS;
  const rowWidth = buttons.length * BUTTON.width + Math.max(0, buttons.length - 1) * BUTTON.gap;
  const rowLeft = (bandWidth - rowWidth) / 2;

  return (
    <>
      {/* Подложка ловит клик мимо окна и размывает экран целиком, включая поля
          letterbox: окно ведь тоже идёт от кромки до кромки. */}
      <div
        className="fixed inset-0 animate-in fade-in duration-200"
        style={{
          zIndex,
          backdropFilter: `blur(${BACKDROP_BLUR * space.scale}px)`,
          WebkitBackdropFilter: `blur(${BACKDROP_BLUR * space.scale}px)`,
        }}
        onClick={onDismiss}
      />

      <div
        className="fixed animate-in fade-in duration-200"
        style={{
          left: -space.size(OVERHANG),
          right: -space.size(OVERHANG),
          top: space.y(top),
          height: space.size(height),
          zIndex: zIndex + 1,
          pointerEvents: 'none',
        }}
      >
        {/* Содержимое ленты живёт в пикселях холста и ужимается одним scale —
            вместе с кеглем шрифта и границами 9-slice (см. StageBox). */}
        <div
          className="relative"
          style={{
            width: bandWidth,
            height,
            transformOrigin: 'top left',
            transform: `scale(${space.scale})`,
            fontFamily: FONT,
            pointerEvents: 'auto',
          }}
          data-widget="modal-window"
        >
          <NineSlice
            name="card_bg"
            width={bandWidth}
            height={height - PLATE_TOP}
            style={{ position: 'absolute', left: 0, top: PLATE_TOP }}
          />
          <NineSlice
            name="location_frame"
            width={bandWidth}
            height={height}
            style={{ position: 'absolute', left: 0, top: 0 }}
          />

          <div
            className="absolute"
            style={{
              left: (bandWidth - headerWidth) / 2,
              top: -HEADER.rise,
              width: headerWidth,
              height: headerHeight,
            }}
          >
            <div style={{ transformOrigin: 'top left', transform: `scale(${HEADER.scale})` }}>
              <NineSlice name="header" width={headerNative} height={HEADER.native} />
            </div>
            <p
              ref={titleRef}
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
              style={{ top: headerHeight / 2, color: TEXT_COLOR, ...TITLE }}
            >
              {title}
            </p>
          </div>

          <div
            ref={contentRef}
            className="absolute text-center"
            style={{ left: (bandWidth - contentWidth) / 2, top: PAD_TOP, width: contentWidth }}
          >
            {message && <p style={{ opacity: 0.8, color: TEXT_COLOR, ...MESSAGE }}>{message}</p>}
            {children}
          </div>

          {buttons.map((button, index) => (
            <ModalButton
              key={button.id ?? button.label}
              button={button}
              left={rowLeft + index * (BUTTON.width + BUTTON.gap)}
              top={buttonsTop}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default ModalWindow;
