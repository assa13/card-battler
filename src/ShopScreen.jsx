import { useMemo, useState } from 'react';
import ScreenStage from './ScreenStage';
import StageBox from './ui/StageBox';
import AtlasSprite from './AtlasSprite';
import NineSlice from './ui/NineSlice';
import UiSprite from './ui/UiSprite';
import RarityWash from './ui/RarityWash';
import { BASE_ASPECT } from './screenScale';
import {
  EMBER_JUNK_THRESHOLD,
  ITEM_RARITIES,
  getItemBuyPrice,
  getItemIconUrl,
  getItemSellPrice,
  sortItemsByRarity,
  sumJunkPoints,
} from './itemSystem';

// Экран магазина на холсте 3200×1800.
//
// Сцена — внутри ScreenStage: бармен стоит процентами сцены, прилавок —
// широкой полосой перед ним (z выше, перекрывает снизу, как стойка бармена
// в таверне: npc z 10, bar_counter z 20). Панель — StageBox в пикселях макета
// с единым transform: scale(). Модальный фон, тултипы — снаружи сцены.
//
// UI Kit: панель — NineSlice location_frame (та же рамка, что у арены, режется
// по границам 529/529/378/378, центр 45×32 тянется); слоты — UiSprite item_slot
// + RarityWash; кнопки — NineSlice button_red; дорожка котла — PB_empty + PB.
// Текст поверх атласа — Counter: кегль = высота бокса / 0.625 (капитель
// шрифта), привязка к центру бокса — Figma отдаёт боксы обрезанными по
// cap-height.

// Текст поверх атласа (см. BattleScreen Counter).
const FONT = "'Greybeard', sans-serif";
const TEXT_COLOR = '#fffdcc';
const TEXT_SHADOW = '0px 4px 0px black';

const Counter = ({ children, style }) => (
  <p
    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center"
    style={{ fontFamily: FONT, fontWeight: 700, color: TEXT_COLOR, textShadow: TEXT_SHADOW, ...style }}
  >
    {children}
  </p>
);

// ─── Геометрия на холсте 3200×1800 ─────────────────────────────────────────
// Бармен — та же поза, что npc_bartender в таверне, крупнее. Прилавок перед
// ним: ширина — натуральная (w-auto по родному aspect картинки, без aspect-
// гаданий в конфиге), высота 32% сцены, верхняя кромка режет торс бармена.
const BARKEEP = { left: '28%', top: '42%', scale: 0.74, zIndex: 10 };
const COUNTER = { left: '24%', top: '68%', scale: 0.32, zIndex: 20 };

// Панель: правые две пятых холста. Контент центрируется внутри панели:
// боковые отступы симметричны (IN.left == IN.right), сетка — по центру
// внутренней ширины, по вертикали — по центру свободного места между
// вкладками и низом (см. gridTopFor).
const PANEL = { x: 1813, y: 198, width: 1235, height: 1404, zIndex: 30 };
const IN = { left: 125, right: 125, top: 116 };
const INNER_WIDTH = PANEL.width - IN.left - IN.right; // 985
const HEADER = { top: 116, height: 90, titleSize: 76, walletSize: 40, closeSize: 44 };
const TABS = { top: 226, height: 110, gap: 16 }; // высота >= минимума button_red 107
const CAULDRON = { top: 402, height: 118 };
// Сетка заполняет панель по ширине целиком: 5 × 184 с шагом 200 = 984 ≈ 985.
const GRID = { cols: 5, rows: 3, top: 464, slotSize: 184, step: 200, iconInset: 14 };
const FOOTER = { button: { width: 560, height: 113 } };
const PB_TRACK = { left: 18, right: 17 };

// Свободное место между вкладками (низ 336) и низом (верх кнопки 1175):
// 839px на сетку 584px — центрируем с полями ~128px. С котлом (118+6+584=708)
// сетка едет вниз на его высоту, котёл — по центру оставшегося.
const gridTopFor = (tab) => (tab === 'cauldron' ? GRID.top + CAULDRON.height + 6 : GRID.top);

const PAGE_SIZE = GRID.cols * GRID.rows;

const BARTENDER_SPRITE = {
  url: './assets/tavern/barman.webp',
  cols: 4,
  rows: 4,
  frameCount: 16,
  fps: 4,
};

// Слот предмета: гнездо из атласа, иконка — cover во внутренней рамке
// (заполняет плитку целиком, без letterbox-полей), заливка редкости под ней.
// Рамку рисует сам атлас.
const ItemCell = ({ item, selected, onClick, onHover, onLeave }) => (
  <button
    type="button"
    disabled={!item}
    onClick={onClick}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    className={`relative block transition-transform ${
      !item ? 'pointer-events-none' : ''
    } ${selected ? 'scale-105' : !item ? '' : 'hover:scale-105'}`}
    style={{
      filter: selected
        ? 'brightness(1.5) drop-shadow(0 0 18px rgba(255,255,255,0.65))'
        : undefined,
    }}
  >
    <UiSprite name="item_slot" width={GRID.slotSize} height={GRID.slotSize}>
      {item && (
        <>
          <RarityWash color={(ITEM_RARITIES[item.rarity] || ITEM_RARITIES.COMMON).color} inset={10} radius={12} />
          <div
            className="absolute overflow-hidden"
            style={{ left: GRID.iconInset, top: GRID.iconInset, right: GRID.iconInset, bottom: GRID.iconInset }}
          >
            <img
              src={getItemIconUrl(item.icon)}
              alt={item.name || ''}
              draggable={false}
              className="h-full w-full select-none object-cover"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        </>
      )}
    </UiSprite>
  </button>
);

// Кнопка: красная рамка атласа + живой текст по центру
// (запечённого текста в атласе нет — см. battle-migration).
const ActionButton = ({ disabled, onClick, children }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="relative block transition-transform enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-60"
    style={{ width: FOOTER.button.width, height: FOOTER.button.height }}
  >
    <NineSlice name="button_red" width={FOOTER.button.width} height={FOOTER.button.height} />
    <Counter style={{ left: FOOTER.button.width / 2, top: FOOTER.button.height / 2, fontSize: 36 }}>
      {children}
    </Counter>
  </button>
);

export default function ShopScreen({
  stock,
  inventory,
  gold,
  soulEmbers,
  soulProgress,
  onBuy,
  onSell,
  onConvert,
  onClose,
  renderItemTooltip,
}) {
  const [tab, setTab] = useState('buy');
  const [page, setPage] = useState(0);
  const [selectedUid, setSelectedUid] = useState(null);
  const [cauldronUids, setCauldronUids] = useState([]);
  const [hovered, setHovered] = useState(null);

  const sortedStock = useMemo(() => sortItemsByRarity(stock), [stock]);
  const sortedInventory = useMemo(() => sortItemsByRarity(inventory), [inventory]);
  const source = tab === 'buy' ? sortedStock : sortedInventory;
  const pageCount = Math.max(1, Math.ceil(source.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = source.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const slots = [...visible, ...Array(Math.max(0, PAGE_SIZE - visible.length)).fill(null)];
  const selectedItem = source.find(item => item.uid === selectedUid) || null;
  const cauldronItems = useMemo(
    () => inventory.filter(item => cauldronUids.includes(item.uid)),
    [inventory, cauldronUids],
  );
  const cauldronPoints = sumJunkPoints(cauldronItems);
  const totalProgress = soulProgress + cauldronPoints;
  const canConvert = cauldronItems.length > 0 && totalProgress >= EMBER_JUNK_THRESHOLD;

  const switchTab = (next) => {
    setTab(next);
    setPage(0);
    setSelectedUid(null);
    setHovered(null);
  };
  const toggleCauldron = (uid) => {
    setCauldronUids(previous => previous.includes(uid)
      ? previous.filter(entry => entry !== uid)
      : [...previous, uid]);
  };
  const showTooltip = (item, event) => {
    if (!item) return;
    setHovered({ item, x: event.clientX, y: event.clientY });
  };

  const gridTop = gridTopFor(tab);
  // Сетка — по центру внутренней ширины; низ — по центру (баланс слева,
  // действие справа симметричны: IN.left/IN.right одинаковы с обеих сторон).
  const gridWidth = (GRID.cols - 1) * GRID.step + GRID.slotSize;
  const gridLeft = IN.left + (INNER_WIDTH - gridWidth) / 2;
  const footerTop = PANEL.height - IN.top - FOOTER.button.height;
  const tabWidth = (INNER_WIDTH - TABS.gap * 2) / 3;
  const fillMin = 12;
  const fillWidth = totalProgress > 0
    ? Math.max(fillMin, Math.round((INNER_WIDTH - PB_TRACK.left - PB_TRACK.right) * Math.min(1, totalProgress / EMBER_JUNK_THRESHOLD)))
    : 0;
  // Шапка: заголовок и кошелёк — симметрично от краёв контента: заголовок
  // центрирован в левой половине, кошелёк — в правой, крестик в самом углу.
  const closeLeft = PANEL.width - IN.right - HEADER.closeSize;
  const titleCenter = IN.left + INNER_WIDTH / 4;
  const walletCenter = IN.left + (INNER_WIDTH * 3) / 4 - HEADER.closeSize / 2;

  return (
    <div className="fixed inset-0 z-[9450]" style={{ backgroundColor: '#000' }} onPointerDown={(event) => event.stopPropagation()}>
      <ScreenStage aspectRatio={BASE_ASPECT} backgroundColor="#000">
        {/* Бармен за прилавком */}
        <div
          className="absolute"
          style={{
            left: BARKEEP.left,
            top: BARKEEP.top,
            height: `${BARKEEP.scale * 100}%`,
            aspectRatio: '1',
            transform: 'translate(-50%, -50%)',
            zIndex: BARKEEP.zIndex,
          }}
        >
          <AtlasSprite sprite={BARTENDER_SPRITE} alt="Бармен" />
        </div>
        {/* Прилавок — перед барменом (z выше), ширина натуральная */}
        <div
          className="absolute"
          style={{
            left: COUNTER.left,
            top: COUNTER.top,
            height: `${COUNTER.scale * 100}%`,
            transform: 'translate(-50%, -50%)',
            zIndex: COUNTER.zIndex,
          }}
        >
          <img
            src="./assets/tavern/bar_counter.webp"
            alt=""
            draggable={false}
            className="block h-full w-auto select-none"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>

        {/* Панель: StageBox в пикселях макета, внутри — единый scale() */}
        <StageBox x={PANEL.x} y={PANEL.y} width={PANEL.width} height={PANEL.height} zIndex={PANEL.zIndex}>
          <div style={{ position: 'relative', width: PANEL.width, height: PANEL.height }}>
            <NineSlice name="location_frame" width={PANEL.width} height={PANEL.height} />

            {/* Заголовок слева, кошелёк справа, крестик в углу */}
            <Counter style={{ left: titleCenter, top: HEADER.top + HEADER.height / 2, fontSize: HEADER.titleSize }}>
              Магазин
            </Counter>
            <Counter style={{ left: walletCenter, top: HEADER.top + HEADER.height / 2, fontSize: HEADER.walletSize }}>
              {`🪙 ${gold}  🔥 ${soulEmbers}`}
            </Counter>
            <button
              type="button"
              onClick={onClose}
              className="absolute flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{ left: closeLeft, top: HEADER.top + (HEADER.height - HEADER.closeSize) / 2, width: HEADER.closeSize, height: HEADER.closeSize }}
              aria-label="Закрыть магазин"
            >
              <Counter style={{ left: '50%', top: '50%', fontSize: 44 }}>✕</Counter>
            </button>

            {/* Вкладки */}
            {[['buy', 'КУПИТЬ'], ['sell', 'ПРОДАТЬ'], ['cauldron', 'КОТЁЛ']].map(([id, label], index) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchTab(id)}
                  className="absolute block transition-transform hover:scale-[1.03] active:scale-95"
                  style={{ left: IN.left + index * (tabWidth + TABS.gap), top: TABS.top, width: tabWidth, height: TABS.height }}
                >
                  <NineSlice name="button_red" width={tabWidth} height={TABS.height} style={active ? undefined : { filter: 'brightness(0.55)' }} />
                  <Counter style={{ left: tabWidth / 2, top: TABS.height / 2, fontSize: 40, opacity: active ? 1 : 0.7 }}>
                    {label}
                  </Counter>
                </button>
              );
            })}

            {/* Котёл: дорожка PB_empty + живое заполнение PB */}
            {tab === 'cauldron' && (
              <div className="absolute" style={{ left: IN.left, top: CAULDRON.top }}>
                <NineSlice name="PB_empty" width={INNER_WIDTH} height={38}>
                  {fillWidth > 0 && (
                    <NineSlice name="PB" width={fillWidth} height={16} style={{ position: 'absolute', left: PB_TRACK.left, top: 11 }} />
                  )}
                </NineSlice>
                <Counter style={{ left: INNER_WIDTH / 2, top: 62, fontSize: 32 }}>
                  {`${totalProgress} / ${EMBER_JUNK_THRESHOLD}`}
                </Counter>
              </div>
            )}

            {/* Сетка слотов во всю ширину контента */}
            {slots.map((item, index) => {
              const row = Math.floor(index / GRID.cols);
              const col = index % GRID.cols;
              const selected = tab === 'cauldron'
                ? Boolean(item && cauldronUids.includes(item.uid))
                : item?.uid === selectedUid;
              return (
                <div
                  key={item?.uid || `empty-${index}`}
                  className="absolute"
                  style={{ left: gridLeft + col * GRID.step, top: gridTop + row * GRID.step }}
                >
                  <ItemCell
                    item={item}
                    selected={selected}
                    onClick={() => {
                      if (!item) return;
                      if (tab === 'cauldron') toggleCauldron(item.uid);
                      else setSelectedUid(item.uid);
                    }}
                    onHover={(event) => showTooltip(item, event)}
                    onLeave={() => setHovered(null)}
                  />
                </div>
              );
            })}

            {/* Низ: пагинация слева, действие справа */}
            <div className="absolute" style={{ left: IN.left, top: footerTop + (FOOTER.button.height - 56) / 2, width: 300, height: 56 }}>
              <button
                type="button"
                disabled={safePage <= 0}
                onClick={() => setPage(value => Math.max(0, value - 1))}
                className="absolute top-0 disabled:opacity-20"
                style={{ left: 0, position: 'absolute', width: 56, height: 56 }}
                aria-label="Назад"
              >
                <Counter style={{ left: '50%', top: '50%', fontSize: 40 }}>◀</Counter>
              </button>
              <Counter style={{ left: 150, top: 28, fontSize: 32 }}>{`${safePage + 1} / ${pageCount}`}</Counter>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))}
                className="absolute top-0 disabled:opacity-20"
                style={{ right: 0, position: 'absolute', width: 56, height: 56 }}
                aria-label="Вперёд"
              >
                <Counter style={{ left: '50%', top: '50%', fontSize: 40 }}>▶</Counter>
              </button>
            </div>
            <div className="absolute" style={{ right: IN.right, top: footerTop }}>
              {tab === 'buy' && (
                <ActionButton
                  disabled={!selectedItem || gold < getItemBuyPrice(selectedItem)}
                  onClick={() => { if (onBuy(selectedItem)) setSelectedUid(null); }}
                >
                  {selectedItem ? `КУПИТЬ · ${getItemBuyPrice(selectedItem)} 🪙` : 'КУПИТЬ'}
                </ActionButton>
              )}
              {tab === 'sell' && (
                <ActionButton
                  disabled={!selectedItem}
                  onClick={() => { if (onSell(selectedItem.uid)) setSelectedUid(null); }}
                >
                  {selectedItem ? `ПРОДАТЬ · ${getItemSellPrice(selectedItem)} 🪙` : 'ПРОДАТЬ'}
                </ActionButton>
              )}
              {tab === 'cauldron' && (
                <ActionButton
                  disabled={!canConvert}
                  onClick={() => { if (onConvert(cauldronUids)) setCauldronUids([]); }}
                >
                  ПРЕОБРАЗОВАТЬ
                </ActionButton>
              )}
            </div>
          </div>
        </StageBox>
      </ScreenStage>
      {hovered && renderItemTooltip?.(hovered)}
    </div>
  );
}
