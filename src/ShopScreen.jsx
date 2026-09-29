import './TavernScreens.css';
import SmallIconText from './ui/SmallIconText';
import GameIcon from './ui/GameIcon';
import useStageSpace from './ui/useStageSpace';
import { useMemo, useState } from 'react';
import ScreenStage from './ScreenStage';
import StageBox from './ui/StageBox';
import AtlasSprite from './AtlasSprite';
import NineSlice from './ui/NineSlice';
import UiSprite from './ui/UiSprite';
import RarityWash from './ui/RarityWash';
import { BASE_ASPECT } from './screenScale';
import { TAVERN_ENTITIES, TAVERN_STAGE_RATIO } from './TavernSceneConfig';
import {
  EMBER_JUNK_THRESHOLD,
  ITEM_RARITIES,
  getItemBuyPrice,
  getItemIconUrl,
  getItemJunkPoints,
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
// Бармен — та же поза, что npc_bartender в таверне, крупнее. Прилавок стоит
// относительно него так же, как в таверне: размер и смещение берутся из
// TAVERN_ENTITIES и умножаются на то, во сколько раз бармен здесь крупнее.
// Смещение по X в таверне считается от её сцены 1024/529, здесь — от 16∶9.
const BARKEEP = { left: '28%', top: '42%', scale: 0.74, zIndex: 10 };
const COUNTER = (() => {
  const barman = TAVERN_ENTITIES.find((e) => e.id === 'npc_bartender');
  const counter = TAVERN_ENTITIES.find((e) => e.id === 'bar_counter');
  const k = BARKEEP.scale / barman.scale;
  const dx = (parseFloat(counter.pos.left) - parseFloat(barman.pos.left)) * TAVERN_STAGE_RATIO * k;
  const dy = (parseFloat(counter.pos.top) - parseFloat(barman.pos.top)) * k;
  return {
    left: `${parseFloat(BARKEEP.left) + dx / BASE_ASPECT}%`,
    top: `${parseFloat(BARKEEP.top) + dy}%`,
    scale: counter.scale * k,
    zIndex: 20,
  };
})();

// Панель: правые две пятых холста. Контент центрируется внутри панели:
// боковые отступы симметричны (IN.left == IN.right), сетка — по центру
// внутренней ширины, по вертикали — по центру свободного места между
// вкладками и низом (см. gridTopFor).
const PANEL = { x: 1813, y: 198, width: 1235, height: 1404, zIndex: 30 };
const IN = { left: 125, right: 125, top: 116 };
const INNER_WIDTH = PANEL.width - IN.left - IN.right; // 985
const HEADER = { top: -47.5, height: 95, titleSize: 68, closeSize: 44 };
const TABS = { top: 116, height: 166, gap: 16 };
const CAULDRON = { top: 364, height: 74 };
// 5 × 160 с шагом 192: место для крупных иконок, цены и воздуха между слотами.
const GRID = { cols: 5, rows: 3, top: 408, slotSize: 160, step: 192, iconInset: 14 };
const FOOTER = { button: { width: 560, height: 156 } };
const PB_TRACK = { left: 18, right: 17 };

// Котёл сдвигает сетку на 80px. Итог выбора всегда остаётся над кнопкой действия.
const gridTopFor = (tab) => (tab === 'cauldron' ? GRID.top + CAULDRON.height + 6 : GRID.top);

const PAGE_SIZE = GRID.cols * GRID.rows;

const BARTENDER_SPRITE = {
  url: './assets/tavern/barman.webp',
  cols: 4,
  rows: 4,
  frameCount: 16,
  fps: 4,
};

// Гнездо, заливка редкости, целая иконка с прозрачностью и постоянная цена.
const ItemCell = ({ item, selected, caption, affordable, onClick, onHover, onLeave }) => (
  <button
    type="button"
    disabled={!item}
    onClick={onClick}
    onMouseEnter={onHover}
    onMouseLeave={onLeave}
    onFocus={onHover}
    onBlur={onLeave}
    aria-label={item ? `${item.name}. ${caption}` : 'Пустой слот'}
    aria-pressed={selected}
    className={`relative block transition-transform ${
      !item ? 'pointer-events-none' : ''
    } ${selected ? 'scale-105' : !item ? '' : 'hover:scale-105'}`}
    style={{
      filter: selected
        ? 'brightness(1.15) drop-shadow(0 0 6px #e9bf72)'
        : undefined,
    }}
  >
    <UiSprite name="item_slot" width={GRID.slotSize} height={GRID.slotSize}>
      {item && (
        <>
          <RarityWash color={(ITEM_RARITIES[item.rarity] || ITEM_RARITIES.COMMON).color} inset={10} radius={12} />
          <div
            className="absolute overflow-hidden"
            style={{ left: GRID.iconInset, top: GRID.iconInset, right: GRID.iconInset, bottom: 34 }}
          >
            <img
              src={getItemIconUrl(item.icon)}
              alt={item.name || ''}
              draggable={false}
              className="h-full w-full select-none object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
          <span className="shop-slot-caption" style={{ color: affordable === false ? '#de8979' : '#fffdcc' }}>{caption}</span>
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
  soulProgress,
  onBuy,
  onSell,
  onConvert,
  onClose,
  renderItemTooltip,
}) {
  const space = useStageSpace();
  const headerTop = HEADER.top + space.canvasSize(10);
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
    const rect = event.currentTarget.getBoundingClientRect();
    setHovered({ item, x: event.clientX ?? rect.right, y: event.clientY ?? rect.top });
  };

  const gridTop = gridTopFor(tab);
  const selectionTop = gridTop + (GRID.rows - 1) * GRID.step + GRID.slotSize + 24;
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

  return (
    <div className="tavern-ui fixed inset-0 z-[9450]" style={{ backgroundColor: '#000' }} onPointerDown={(event) => event.stopPropagation()}>
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
            {/* Отступы — как у окна арены в той же рамке: вровень с краем подложка вылезла бы за фигурные углы. */}
            <div style={{ position: 'absolute', left: 43, top: 46, right: 42, bottom: 46, background: '#000' }} />
            <NineSlice name="location_frame" width={PANEL.width} height={PANEL.height} style={{ position: 'absolute', inset: 0 }} />

            {/* Заголовок на верхней кромке; баланс — в глобальном кошельке. */}
            <NineSlice name="header" width={INNER_WIDTH} height={HEADER.height} style={{ position: 'absolute', left: IN.left, top: headerTop }} />
            <Counter style={{ left: PANEL.width / 2, top: headerTop + HEADER.height / 2, fontSize: HEADER.titleSize }}>
              Магазин
            </Counter>
            <button
              type="button"
              onClick={onClose}
              className="absolute flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{ left: PANEL.width - 106, top: 65, width: HEADER.closeSize, height: HEADER.closeSize }}
              aria-label="Закрыть магазин"
            >
              <Counter style={{ left: '50%', top: '50%', fontSize: 44 }}><SmallIconText>✕</SmallIconText></Counter>
            </button>

            {/* Вкладки */}
            {[['buy', 'КУПИТЬ'], ['sell', 'ПРОДАТЬ'], ['cauldron', 'КОТЁЛ']].map(([id, label], index) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchTab(id)}
                  aria-pressed={active}
                  className="absolute block transition-transform hover:scale-[1.03] active:scale-95"
                  style={{ left: IN.left + index * (tabWidth + TABS.gap), top: TABS.top, width: tabWidth, height: TABS.height }}
                >
                  <NineSlice name={active ? "button_red" : "button_default"} width={tabWidth} height={TABS.height} style={active ? undefined : { filter: 'brightness(0.55)' }} />
                  <Counter style={{ left: tabWidth / 2, top: TABS.height / 2, fontSize: 40, opacity: active ? 1 : 0.7 }}>
                    {label}
                  </Counter>
                </button>
              );
            })}

            <p className="tavern-muted" style={{ position: 'absolute', left: IN.left, top: 301, width: INNER_WIDTH, fontSize: 30, lineHeight: 1.25 }}>
              {tab === 'buy' ? 'Снаряжение для следующего похода. Выберите предмет.'
                : tab === 'sell' ? 'Освободите сумку и получите золото.'
                  : 'Выберите ненужные вещи. Котёл превратит их в огоньки.'}
            </p>
            {/* Котёл: дорожка PB_empty + живое заполнение PB */}
            {tab === 'cauldron' && (
              <div className="absolute" style={{ left: IN.left, top: CAULDRON.top }}>
                <NineSlice name="PB_empty" width={INNER_WIDTH} height={38}>
                  {fillWidth > 0 && (
                    <NineSlice name="PB" width={fillWidth} height={16} style={{ position: 'absolute', left: PB_TRACK.left, top: 11 }} />
                  )}
                </NineSlice>
                <Counter style={{ left: INNER_WIDTH / 2, top: 57, fontSize: 26 }}>
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
                    caption={item ? tab === 'cauldron' ? `+${getItemJunkPoints(item)} пыли`
                      : `${tab === 'buy' ? getItemBuyPrice(item) : getItemSellPrice(item)} зол.` : ''}
                    affordable={tab !== 'buy' || !item || gold >= getItemBuyPrice(item)}
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

            {source.length === 0 && <p className="shop-empty">
              {tab === 'buy' ? 'Всё раскуплено. Новые товары появятся после ночлега.' : 'В сумке пока нет предметов. Загляните в подземелье.'}
            </p>}
            <div className="shop-selection" style={{ top: selectionTop }} aria-live="polite">
              {tab === 'cauldron' ? <>
                <strong>{`Выбрано: ${cauldronItems.length} · Огоньков: +${Math.floor(totalProgress / EMBER_JUNK_THRESHOLD)}`}</strong>
                <span className="tavern-muted">{cauldronItems.length ? 'Выбранные предметы будут потрачены.' : '11 пыли = 1 огонёк. Остаток сохраняется.'}</span>
              </> : selectedItem ? <>
                <strong style={{ color: (ITEM_RARITIES[selectedItem.rarity] || ITEM_RARITIES.COMMON).color }}>{selectedItem.name}</strong>
                <span className="tavern-muted">{tab === 'buy' && gold < getItemBuyPrice(selectedItem)
                  ? `Не хватает ${getItemBuyPrice(selectedItem) - gold} золота`
                  : tab === 'buy' ? 'После покупки предмет появится в сумке.' : 'Продажа уберёт предмет из сумки.'}</span>
              </> : <span className="tavern-muted">Выберите предмет в ячейке. Характеристики — при наведении.</span>}
            </div>
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
                <Counter style={{ left: '50%', top: '50%', fontSize: 40 }}><SmallIconText>◀</SmallIconText></Counter>
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
                <Counter style={{ left: '50%', top: '50%', fontSize: 40 }}><SmallIconText>▶</SmallIconText></Counter>
              </button>
            </div>
            <div className="absolute" style={{ right: IN.right, top: footerTop }}>
              {tab === 'buy' && (
                <ActionButton
                  disabled={!selectedItem || gold < getItemBuyPrice(selectedItem)}
                  onClick={() => { if (onBuy(selectedItem)) setSelectedUid(null); }}
                >
                  КУПИТЬ {selectedItem && <>· {getItemBuyPrice(selectedItem)} <GameIcon name="coin" /></>}
                </ActionButton>
              )}
              {tab === 'sell' && (
                <ActionButton
                  disabled={!selectedItem}
                  onClick={() => { if (onSell(selectedItem.uid)) setSelectedUid(null); }}
                >
                  ПРОДАТЬ {selectedItem && <>· {getItemSellPrice(selectedItem)} <GameIcon name="coin" /></>}
                </ActionButton>
              )}
              {tab === 'cauldron' && (
                <ActionButton
                  disabled={!canConvert}
                  onClick={() => { if (onConvert(cauldronUids)) setCauldronUids([]); }}
                >
                  {`ПЕРЕПЛАВИТЬ · +${Math.floor(totalProgress / EMBER_JUNK_THRESHOLD)}`}
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
