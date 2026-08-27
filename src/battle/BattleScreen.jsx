import { useEffect } from 'react';
import ScreenStage from '../ScreenStage';
import StageBox from '../ui/StageBox';
import NineSlice from '../ui/NineSlice';
import UiSprite from '../ui/UiSprite';
import CharSprite from '../CharSprite';
import TiltWrapper from '../ui/TiltWrapper';
import EnemyHpBar from '../ui/EnemyHpBar';
import RarityWash from '../ui/RarityWash';
import { useCardTilt } from '../ui/cardTilt';
import useStageScale from '../ui/useStageScale';
import HeroSlot from '../widgets/HeroSlot';
import { HERO_SLOT_ARTEFACT } from '../widgets/heroSlotLayout';
import MagicCard from '../widgets/MagicCard';
import { spriteColorizeFilter } from '../spriteColorize';
import { useBattleView } from './battleView';
import {
  BATTLE_LAYOUT,
  BOSS_SCALE,
  CARD_DECKS,
  DECOR,
  ENEMY_FORMATIONS,
  FIELD_ART,
  HERO_SLOTS,
  HERO_UNITS,
  ITEM_SLOTS,
  MAP_PANEL,
  MAP_PANEL_DESIGN,
  MERGE_PANEL,
  MERGE_PANEL_CLIP,
  MERGE_PANEL_HIDDEN_Y,
  MERGE_PANEL_OFFSET_Y,
} from './battleLayout';

// Боевой экран на холсте 3200×1800.
//
// Состояние остаётся в App.jsx и приходит снимком через battleView: здесь только
// раскладка по координатам макета и отрисовка. Мелкие элементы, которые в макет
// не переносились (прицел, реплики), приходят готовыми функциями отрисовки — их
// владелец по-прежнему App. Значки эффектов и полоска HP рисуются здесь: они
// живут в пикселях сцены и обязаны масштабироваться вместе с ней.
//
// Без снимка (dev-роут #battle открыт напрямую) рисуется демо-каркас: пустое
// поле и три слота без карт, чтобы вёрстку можно было смотреть, не запуская бой.
const DEMO = {
  mana: 0,
  drawCount: 0,
  discardCount: 0,
  heroes: [
    { id: 'p1', name: 'Воин', hp: 50, maxHp: 50 },
    { id: 'p2', name: 'Разбойник', hp: 35, maxHp: 35 },
    { id: 'p3', name: 'Маг', hp: 25, maxHp: 25 },
  ],
  enemies: [],
  items: [],
  render: {},
};

const { fieldBackground, locationFrame, inventoryBg, mergeButton, manaCounter, buttonRed } = BATTLE_LAYOUT;

const CARD_BODY = { width: 374, height: 434 };

// Карта сектора приходит в своей старой пиксельной вёрстке и приводится к боксу
// сцены одним scale. Внешний бокс обязан быть position: relative — внутри
// StageBox содержимое статично, а карта позиционируется absolute и иначе
// зацепилась бы за сам StageBox и получила его масштаб вторым слоем.
const MAP_PANEL_SCALE = MAP_PANEL.width / MAP_PANEL_DESIGN.width;

const MapPanelFrame = ({ children }) => (
  <div style={{ position: 'relative', width: MAP_PANEL.width, height: MAP_PANEL.height }}>
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: MAP_PANEL_DESIGN.width,
        height: MAP_PANEL_DESIGN.height,
        transform: `scale(${MAP_PANEL_SCALE})`,
        transformOrigin: 'top left',
      }}
    >
      {children}
    </div>
  </div>
);

// Крупный спрайт врага на холсте отматывает кадры заметно суетливее мелкого на
// старом экране, поэтому idle врагов крутится вдвое медленнее паспортного fps.
const ENEMY_IDLE_SPEED = 0.5;

// Насколько босс опущен относительно подъёма под свой размер.
const BOSS_DROP = 100;

// Сдвиг стартового кадра по id врага: одинаковые атласы иначе дышат синхронно и
// строй читается одним механизмом. 997 — просто большое простое, кадр берётся по
// остатку от длины атласа уже внутри спрайта.
const idleStartFrame = (id) => {
  const key = String(id);
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) % 997;
  return hash;
};

// Локация пока одна; когда их станет несколько, арт будет выбирать бой.
const fieldArt = FIELD_ART.fight;

const noop = () => {};

// Числа поверх арта. В атласе цифр больше нет — на их месте в макете остались
// скрытые текстовые слои, и числа садятся в центр их боксов. Кегль считается от
// высоты бокса: Figma отдаёт её обрезанной по cap-height, а у этого шрифта
// капитель — 0.625 кегля (сверено по «999/999 HP» в слоте героя).
const Counter = ({ children, style }) => (
  <p
    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center"
    style={{
      fontFamily: "'Greybeard', sans-serif",
      fontWeight: 700,
      color: '#fffdcc',
      textShadow: '0px 4px 0px black',
      ...style,
    }}
  >
    {children}
  </p>
);

// Значки эффектов над бойцом: броня и цепочка у героев, дебаффы у врагов.
// Свёрстаны в пикселях холста и уменьшаются вместе со сценой — спрайт бойца
// здесь вчетверо крупнее, чем на старом экране, и значок экранного размера
// рядом с ним теряется. Расшифровку показывает подсказка у курсора.
const BADGE_TONES = {
  armor: { border: 'rgba(56,189,248,0.7)', text: '#bae6fd', glow: 'rgba(56,189,248,0.45)' },
  chain: { border: 'rgba(245,158,11,0.7)', text: '#fde68a', glow: 'rgba(251,191,36,0.45)' },
  status: { border: 'rgba(100,116,139,0.9)', text: '#ffffff', glow: 'rgba(0,0,0,0.55)' },
};

// Полоска HP врага в пикселях сцены. Раньше она ехала в экранном слое вместе с
// репликами, и обратный масштаб сносил её далеко под бойца: слой считается от
// верхней кромки, поэтому нижняя уезжала вниз во столько же раз, во сколько
// сцена меньше холста. Заодно бар был вчетверо мельче спрайта.
const HP_BAR = { width: 128, height: 16, bottom: -16, borderWidth: 4 };

const FieldBadges = ({ badges, column, onTipShow, onTipHide }) => {
  if (!badges?.length) return null;
  return (
    <div
      className={`absolute left-1/2 flex -translate-x-1/2 ${column ? 'flex-col items-center' : 'items-start'}`}
      style={{ top: -48, gap: 12, zIndex: 80, pointerEvents: 'auto' }}
      onMouseEnter={(event) => onTipShow?.(badges, event)}
      onMouseMove={(event) => onTipShow?.(badges, event)}
      onMouseLeave={onTipHide}
    >
      {badges.map((badge) => {
        const tone = BADGE_TONES[badge.tone] || BADGE_TONES.status;
        return (
          <div
            key={badge.id}
            className="flex items-center whitespace-nowrap"
            style={{
              gap: 8,
              padding: '10px 18px',
              borderRadius: 36,
              border: `6px solid ${tone.border}`,
              background: 'rgba(2,6,23,0.92)',
              boxShadow: `0 0 44px ${tone.glow}`,
            }}
          >
            <span style={{ fontSize: 52, lineHeight: 1 }}>{badge.icon}</span>
            {badge.text && (
              <span style={{ fontSize: 44, lineHeight: 1, fontWeight: 900, color: tone.text }}>{badge.text}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** Сколько панель слияния уезжает. Столько же держится поднятый инвентарь. */
const MERGE_HIDE_MS = 240;

// Панель слияния артефактов.
//
// Живёт в обрезающем боксе и выезжает из него сдвигом: закрытая панель стоит
// выше кромки обрезки и целиком срезана, открытая опускается на место. Поэтому
// бокс смонтирован всегда — иначе выезжать было бы нечему, — и мышь ловит
// только когда панель открыта.
//
// data-merge-keep — метка «клик сюда панель не закрывает», её читает слушатель
// на документе.
const MergePanel = ({ open, slots = [], warning, onSlotClick, onConfirm, onTipShow, onTipHide }) => (
  <StageBox
    {...MERGE_PANEL_CLIP}
    zIndex={60}
    style={{ overflow: 'hidden', pointerEvents: open ? 'auto' : 'none' }}
  >
    <div style={{ position: 'relative', width: MERGE_PANEL_CLIP.width, height: MERGE_PANEL_CLIP.height }}>
      <div
        data-merge-keep=""
        style={{
          position: 'absolute',
          left: 0,
          top: MERGE_PANEL_OFFSET_Y,
          width: MERGE_PANEL.width,
          height: MERGE_PANEL.height,
          transform: open ? 'translateY(0)' : `translateY(${MERGE_PANEL_HIDDEN_Y}px)`,
          // Выезжает с перелётом и отыгрывает назад, уезжает ровно: отскок на
          // закрытии читался бы как заедание.
          transition: open
            ? 'transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)'
            : `transform ${MERGE_HIDE_MS}ms ease-in`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: MERGE_PANEL.bg.left,
            top: MERGE_PANEL.bg.top,
            width: MERGE_PANEL.bg.width,
            height: MERGE_PANEL.bg.height,
            background: MERGE_PANEL.bg.color,
          }}
        />
        {/* Та же рамка, что у арены, но нарисованная целиком, а не разрезом:
            панель меньше суммы её границ (1058×756), и 9-slice свёл бы её углы
            внахлёст. Уменьшение рамке не вредит — тянуть нечего. */}
        <UiSprite
          name="location_frame"
          width={MERGE_PANEL.width}
          height={MERGE_PANEL.height}
          style={{ position: 'absolute', left: 0, top: 0 }}
        />

        {MERGE_PANEL.slotLefts.map((left, index) => {
          const item = slots[index];
          const { size, radius } = MERGE_PANEL.slotIcon;
          return (
            <div
              key={`merge-slot-${index}`}
              style={{
                position: 'absolute',
                left,
                top: MERGE_PANEL.slotTop,
                width: MERGE_PANEL.slotSize,
                height: MERGE_PANEL.slotSize,
                cursor: item ? 'pointer' : 'default',
              }}
              onClick={() => item && onSlotClick?.(index)}
              onMouseEnter={(event) => item && onTipShow?.(item, event)}
              onMouseMove={(event) => item && onTipShow?.(item, event)}
              onMouseLeave={onTipHide}
            >
              <UiSprite name="item_slot" width={MERGE_PANEL.slotSize} height={MERGE_PANEL.slotSize}>
                {item ? (
                  <>
                    <RarityWash color={item.rarityColor} inset={12} radius={radius} />
                    <img
                      src={item.iconUrl}
                      alt=""
                      draggable={false}
                      className="absolute -translate-x-1/2 -translate-y-1/2 select-none object-cover"
                      style={{ left: '50%', top: '50%', width: size, height: size, borderRadius: radius, imageRendering: 'pixelated' }}
                    />
                    {/* Отметка «предмет на месте». В атласе своей картинки под неё
                        пока нет, поэтому знак набран тем же шрифтом, что и плюс в
                        пустом гнезде. */}
                    <Counter style={{ left: '50%', top: '84%', fontSize: 64 }}>✓</Counter>
                  </>
                ) : (
                  <Counter style={{ left: '50%', top: '50%', fontSize: 119.842, opacity: 0.4, textShadow: '0px 4.993px 0px black' }}>+</Counter>
                )}
              </UiSprite>
            </div>
          );
        })}

        <button
          type="button"
          onClick={onConfirm}
          className="absolute block transition-transform hover:scale-105 active:scale-95"
          style={{
            left: MERGE_PANEL.button.left,
            top: MERGE_PANEL.button.top,
            width: MERGE_PANEL.button.width,
            height: MERGE_PANEL.button.height,
          }}
        >
          <NineSlice name="button_red" width={MERGE_PANEL.button.width} height={MERGE_PANEL.button.height} />
          <Counter style={{ left: MERGE_PANEL.button.width / 2, top: MERGE_PANEL.button.height / 2, fontSize: 36 }}>
            MERGE
          </Counter>
        </button>

        {/* Отказ слияния объясняется здесь же, под кнопкой: не хватает предметов,
            редкости разные, вечное не улучшить. Ключ по тексту перезапускает
            всплытие — иначе новая причина появлялась бы беззвучно. */}
        {warning && (
          <p
            key={warning}
            className="absolute w-full text-center"
            style={{
              left: 0,
              top: MERGE_PANEL.button.top + MERGE_PANEL.button.height + 6,
              fontFamily: "'Greybeard', sans-serif",
              fontWeight: 700,
              fontSize: 34,
              color: '#ff6b6b',
              textShadow: '0px 4px 0px black',
              animation: 'mergeWarnPop 260ms cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            {warning}
          </p>
        )}
        <style>{`
          @keyframes mergeWarnPop {
            0% { opacity: 0; transform: translateY(-10px) scale(0.92); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </div>
    </div>
  </StageBox>
);

// Боец на поле. Внешний бокс двигается (прыжок, ховер, тряска) с переходом,
// внутренний отвечает за вспышки и свечение — ровно как на старом экране,
// иначе зеркало врага дёргалось бы вместе с движением.
//
// position: relative на внешнем боксе обязателен. Без него абсолютные слои
// цепляются за бокс StageBox — тот, что снаружи transform: scale(), — и внутри
// масштаба ужимаются ещё раз: оверлей выходит меньше бойца и уезжает влево.
// Трансформ движения такой якорь создаёт сам, поэтому в покое и в прыжке
// раскладка была разной.
const FieldUnit = ({ unit, moveTransform, transitionClass, transitionStyle, outerClass, innerClass, innerStyle, mirrored, nodeRef, dataAttrs, badges, overlay, overlayScale = 1, children }) => (
  <StageBox x={unit.x} y={unit.y} width={unit.size} height={unit.size} zIndex={26} style={{ overflow: 'visible' }}>
    <div
      ref={nodeRef}
      className={`${transitionClass} ${outerClass}`}
      style={{ position: 'relative', width: unit.size, height: unit.size, transform: moveTransform, ...transitionStyle }}
      {...dataAttrs}
    >
      <div className="relative" style={mirrored ? { transform: 'scaleX(-1)' } : undefined}>
        <div className={`relative ${innerClass}`} style={innerStyle}>
          {children}
        </div>
      </div>
      {/* Реплики и прицел живут снаружи зеркала — внутри него текст читался бы
          задом наперёд. Свёрстаны они в экранных пикселях, поэтому компенсируем
          масштаб сцены, иначе выходят мельче задуманного. Обратная сторона: слой
          растёт от верхней кромки, и всё, что цепляется за нижнюю, уезжает вниз
          — такому здесь не место, его рисуют в пикселях сцены рядом со
          значками. */}
      {overlay && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ transform: `scale(${overlayScale})`, transformOrigin: 'top center' }}
        >
          {overlay}
        </div>
      )}
      {badges}
    </div>
  </StageBox>
);

// Слот героя на холсте.
//
// Мышь ловят два плоских слоя поверх слота, а не сама вёрстка карточки. Внутри
// TiltWrapper живёт 3D-контекст (perspective + preserve-3d), и вместе с общим
// transform: scale() сцены попадание курсора в это поддерево считается неверно:
// слот отзывался только на текст и на нижнюю кромку. Слои лежат в обычных 2D
// координатах бокса, поэтому нажимается весь слот целиком.
//
// Верхний слой — сама карточка, нижний — гнездо артефакта: у него своя роль
// (приём предмета перетаскиванием и снятие кликом), поэтому он перехватывает
// мышь у карточки.
const HeroSlotBox = ({
  box,
  hero,
  index,
  nudge,
  shake,
  isDraggingItem,
  onPlayCard,
  onCardHover,
  onCardHoverEnd,
  setSlotRef,
  onEquipDragOver,
  onEquipDragLeave,
  onEquipDrop,
  onUnequip,
  onItemTipShow,
  onItemTipHide,
  children,
}) => {
  const { tilt, tiltHandlers } = useCardTilt(hero.isDisabled);
  const showArtefact = !hero.isDead;
  // Ловец накрывает и гнездо артефакта, которое свисает ниже кромки слота:
  // гнездо лежит внутри него, поэтому переход курсора на гнездо не считается
  // уходом со слота и наклон не сбрасывается.
  const hitHeight = showArtefact
    ? HERO_SLOT_ARTEFACT.top + HERO_SLOT_ARTEFACT.height
    : box.height;

  return (
    <div style={{ position: 'relative', width: box.width, height: box.height }}>
      <div className={`card-nudge-wrap ${nudge}`} style={{ width: box.width, height: box.height }}>
        <TiltWrapper
          isDisabled={hero.isDisabled}
          globalShake={shake}
          tilt={tilt}
          className={`rounded-[24px] transition-shadow duration-300 ${hero.comboGlow ? 'shadow-[0_0_34px_8px_rgba(250,204,21,0.65)] animate-pulse' : ''}`}
        >
          <div
            style={{
              opacity: hero.isDead ? 0.4 : 1,
              filter: hero.isDead ? 'grayscale(1)' : undefined,
            }}
          >
            <HeroSlot
              heroName={hero.name}
              hp={hero.hp}
              maxHp={hero.maxHp}
              showArtefactSlot={showArtefact}
              artefact={{
                item: hero.equipment,
                isDragActive: isDraggingItem,
                isDropTarget: hero.isDropTarget,
              }}
            >
              {children}
            </HeroSlot>
          </div>
        </TiltWrapper>
      </div>

      {/* Ловцы лежат выше поднятого слота: на ховере TiltWrapper уходит на z-50,
          и слой пониже он бы накрыл сам — курсор терял бы его сразу после входа,
          а слот мигал бы между обычным и поднятым состоянием. */}
      <div
        ref={(el) => setSlotRef?.(hero.id, el)}
        className="absolute"
        style={{
          left: 0,
          top: 0,
          width: box.width,
          height: hitHeight,
          zIndex: 60,
          cursor: hero.canPlay ? 'pointer' : 'default',
        }}
        onClick={() => hero.canPlay && onPlayCard?.(index, hero.card?.source)}
        onMouseEnter={() => { tiltHandlers.onMouseEnter(); onCardHover?.(index); }}
        onMouseLeave={() => { tiltHandlers.onMouseLeave(); onCardHoverEnd?.(); }}
        onMouseMove={tiltHandlers.onMouseMove}
      >
        {/* Гнездо артефакта: приём предмета, снятие кликом и подсказка за
            курсором. Клик не должен всплыть на слот — иначе снятие артефакта
            заодно разыграет карту. */}
        {showArtefact && (
          <div
            className="absolute"
            style={{
              left: HERO_SLOT_ARTEFACT.left,
              top: HERO_SLOT_ARTEFACT.top,
              width: HERO_SLOT_ARTEFACT.width,
              height: HERO_SLOT_ARTEFACT.height,
              cursor: hero.equipment ? 'pointer' : 'default',
            }}
            onDragOver={onEquipDragOver?.(hero.id)}
            onDragLeave={onEquipDragLeave}
            onDrop={onEquipDrop?.(hero.id)}
            onClick={(event) => {
              event.stopPropagation();
              if (hero.equipment) onUnequip?.(hero.id);
            }}
            onMouseEnter={(event) => onItemTipShow?.(hero.equipment, event)}
            onMouseMove={(event) => onItemTipShow?.(hero.equipment, event)}
            onMouseLeave={onItemTipHide}
          />
        )}
      </div>
    </div>
  );
};

const BattleScreen = ({ zIndex }) => {
  // Снимок разбирается на локальные значения целиком: узлы приходят функциями
  // ref, а eslint считает ref-объектом любой контейнер, через который такую
  // функцию передали, и ругается на каждое чтение его полей в рендере.
  const {
    heroes = [],
    enemies = [],
    items = [],
    render = {},
    shake = { x: 0, y: 0, rot: 0 },
    flashingTargets = [],
    animatingTargetIds = [],
    hoveredTargetIds = [],
    enemyHitStopIds = [],
    heroHitStopIds = [],
    defenseWindowFlashIds = [],
    attackAnims = {},
    attackTranslate = { dx: 0, dy: 0 },
    enemyAttackTranslate = { dx: 0, dy: 0 },
    turnState,
    background,
    mana,
    drawCount,
    discardCount,
    isAnimating,
    animatingPlayerId,
    animatingEnemyId,
    hoveredPlayerId,
    qteHeroId,
    speakingEnemy,
    enemyAttackDurationMs,
    enemyAttackEasing,
    endTurnLabel,
    canEndTurn,
    setAvatarRef,
    setEnemyRef,
    setSlotRef,
    setDeckNode,
    setDiscardNode,
    setInventoryNode,
    setEnemyZoneNode,
    onPlayCard,
    onCardHover,
    onCardHoverEnd,
    onEndTurn,
    onOpenDeck,
    onOpenCraft,
    onItemDragStart,
    onItemClick,
    onItemTipShow,
    onItemTipHide,
    merge = {},
    onMergeSlotClick,
    onMergeConfirm,
    onMergeClose,
    onAttackAnimCycle,
    isDraggingItem,
    onEquipDragOver,
    onEquipDragLeave,
    onEquipDrop,
    onUnequip,
    onEffectTipShow,
    onEffectTipHide,
    mapPanelMounted,
    arenaVeilVisible,
  } = useBattleView() ?? DEMO;

  const hidden = turnState === 'map';
  const mergeOpen = Boolean(merge.open);
  const enemyFormation = ENEMY_FORMATIONS[enemies.length] || ENEMY_FORMATIONS[3];

  // Клик мимо панели слияния её закрывает. Ловим его на документе, а не
  // подложкой поверх сцены: подложка съела бы клики по инвентарю, из которого в
  // панель и кладут предметы. Исключения помечены data-merge-keep — сама панель,
  // гнёзда инвентаря и кнопка слияния (она закрывает панель своим обработчиком,
  // и второй вызов вернул бы предметы в инвентарь дважды).
  useEffect(() => {
    if (!mergeOpen) return undefined;
    const onPointerDown = (event) => {
      if (event.target.closest?.('[data-merge-keep]')) return;
      onMergeClose?.();
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [mergeOpen, onMergeClose]);

  // Слот на ховере вырастает и заезжает верхней кромкой в полосу инвентаря.
  // Инвентарь при этом лежит выше — над панелью слияния, — поэтому на время
  // ховера вся нижняя группа поднимается над ним. Панели это не мешает: пока она
  // открыта, слоты мышь не принимают и ховера там быть не может.
  const heroHovered = heroes.some((hero) => hero.isHovered);

  // Векторы прыжков боевой код считает по getBoundingClientRect, то есть в
  // пикселях экрана, а применяются они внутри StageBox, где сцена уже ужата.
  // Без обратного пересчёта атакующий не долетает до цели ровно во столько раз,
  // во сколько сцена меньше холста.
  // Гаснущие панели HUD растянуты на всю сцену и перекрывали бы друг друга,
  // поэтому мышь ловят не они, а сами боксы внутри.
  //
  // Пока открыта панель слияния, бой замирает: клик по слоту или кнопке хода
  // считается кликом мимо и просто закрывает панель. Инвентарь и кнопка слияния
  // живут по своему правилу — из них панель и наполняют.
  const hudPointer = hidden || mergeOpen ? 'none' : 'auto';
  const inventoryPointer = hidden ? 'none' : 'auto';

  // Слияние приглушает всё, кроме арены: бой продолжает читаться, а панель
  // остаётся единственным ярким пятном в нижней половине экрана.
  const hudOpacity = (hidden ? 0 : 1) * (mergeOpen ? 0.4 : 1);

  const stageScale = useStageScale();
  const toStage = ({ dx, dy }) => ({ dx: dx / stageScale, dy: dy / stageScale });
  const heroLeap = toStage(attackTranslate);
  const enemyLeap = toStage(enemyAttackTranslate);

  // Сцена прозрачная насквозь: и letterbox, и холст. Под ней остаётся общий
  // шейдерный фон приложения, как это было на старом экране. Тень по кромке
  // холста при этом выключается: на прозрачной сцене она читается градиентной
  // рамкой вокруг всего окна.
  return (
    <ScreenStage zIndex={zIndex} backgroundColor="transparent" shadow={false} stageStyle={{ backgroundColor: 'transparent' }}>
      <StageBox {...fieldBackground} zIndex={10} style={{ overflow: 'hidden' }}>
        <img
          src={fieldArt.url}
          alt=""
          draggable={false}
          className="max-w-none absolute select-none"
          style={{
            left: fieldArt.x,
            top: fieldArt.y,
            width: fieldArt.size,
            height: fieldArt.size,
            imageRendering: 'pixelated',
            filter: background?.hue != null
              ? spriteColorizeFilter(background.hue, background.sat)
              : undefined,
          }}
        />
      </StageBox>

      {heroes.map((hero, index) => {
        const unit = HERO_UNITS[index];
        if (!unit) return null;
        const isAttacking = animatingPlayerId === hero.id;
        const isHovered = hoveredPlayerId === hero.id;
        const isBeingAttacked = animatingTargetIds.includes(hero.id);
        const isQteHero = qteHeroId === hero.id;
        const isDefenseFlash = defenseWindowFlashIds.includes(hero.id) || heroHitStopIds.includes(hero.id);
        const anim = attackAnims[hero.id];

        let moveTransform = '';
        let transitionClass = 'transition-all duration-600 ease-out';
        if (isAttacking) {
          // duration-300 совпадает с impactDelay — прыжок долетает точно в момент удара.
          moveTransform = `translate(${heroLeap.dx}px, ${heroLeap.dy}px) scale(1.15)`;
          transitionClass = 'transition-all duration-300 ease-out';
        } else if (isHovered && !isAnimating) {
          moveTransform = 'translate(16px, 0)';
        } else if (isBeingAttacked && shake.x !== 0) {
          moveTransform = `translate(${shake.x * 0.5}px, ${shake.y * 0.5}px) rotate(${shake.rot * 0.5}deg) scale(1.1)`;
          transitionClass = 'transition-none';
        } else if (isBeingAttacked) {
          moveTransform = 'scale(1.1)';
        }

        return (
          <FieldUnit
            key={`hero-${hero.id}`}
            unit={unit}
            nodeRef={(el) => setAvatarRef?.(hero.id, el)}
            badges={<FieldBadges badges={hero.badges} column onTipShow={onEffectTipShow} onTipHide={onEffectTipHide} />}
            moveTransform={moveTransform}
            transitionClass={transitionClass}
            outerClass={[
              hero.isDead ? 'opacity-30 grayscale scale-75' : '',
              isAttacking ? 'z-50 drop-shadow-[0_0_40px_rgba(59,130,246,1)]' : '',
              isBeingAttacked && shake.x === 0 ? 'brightness-150 animate-pulse' : '',
            ].join(' ')}
            innerClass={[
              isHovered && !isAnimating ? 'drop-shadow-[0_0_25px_rgba(59,130,246,0.4)]' : '',
              flashingTargets.includes(hero.id) ? 'brightness-0 invert drop-shadow-[0_0_40px_white] scale-150 -translate-y-4 z-[2000]' : '',
              isDefenseFlash ? 'brightness-0 invert scale-150 z-[2000]' : '',
            ].join(' ')}
            innerStyle={{
              transition: isDefenseFlash
                ? 'filter 80ms ease-out, transform 100ms ease-out'
                : 'filter 240ms ease-in, transform 240ms cubic-bezier(0.34, 1.2, 0.64, 1)',
              ...(isQteHero ? {
                transform: isDefenseFlash ? 'scale(1.2)' : 'scale(1.1)',
                filter: isDefenseFlash
                  ? 'brightness(0) invert(1)'
                  : `drop-shadow(0 0 14px ${hero.qteGlow}) drop-shadow(0 0 36px ${hero.qteGlow})`,
              } : {}),
            }}
          >
            {/* Замах играет один цикл и замирает; key с play-счётчиком ремоунтит
                спрайт, чтобы каждое звено ритм-серии стартовало с нулевого кадра. */}
            {hero.atlas ? (
              anim && hero.attackAtlas
                ? (
                  <CharSprite
                    key={`attack-${anim.play}`}
                    atlas={hero.attackAtlas}
                    size={unit.size}
                    gameTime
                    once
                    holdAtFrame={anim.phase === 'windup' ? anim.holdAtFrame : null}
                    speed={anim.phase === 'fastFinish' ? 3 : (anim.speed || 1)}
                    ignoreSlowMo={anim.realTime || anim.phase !== 'windup'}
                    onCycle={() => onAttackAnimCycle?.(hero.id)}
                    {...hero.colorize}
                  />
                )
                : <CharSprite key="idle" atlas={hero.atlas} size={unit.size} {...hero.colorize} />
            ) : (
              <span style={{ fontSize: unit.size * 0.4 }}>{hero.icon}</span>
            )}
          </FieldUnit>
        );
      })}

      {/* Зона врагов для QTE — правая половина окна локации, как на старом экране.
          Табун лошадей берёт разгон по родителю этого узла, поэтому им должен быть
          бокс во всё окно: от его высоты считается размер лошади. */}
      <StageBox {...fieldBackground} zIndex={14} style={{ pointerEvents: 'none' }}>
        <div
          ref={setEnemyZoneNode}
          className="absolute"
          style={{
            left: fieldBackground.width / 2,
            top: 0,
            width: fieldBackground.width / 2,
            height: fieldBackground.height,
          }}
        />
      </StageBox>

      {enemies.map((enemy, index) => {
        const slot = enemyFormation[index] || enemyFormation[enemyFormation.length - 1];
        if (!slot) return null;
        const size = enemy.isBoss ? Math.round(slot.size * BOSS_SCALE) : slot.size;
        // Босс крупнее и оттого сидит ниже — приподнимаем, как на старом экране,
        // но не так высоко: на холсте он отрывался от линии строя.
        const unit = {
          x: slot.x - (size - slot.size) / 2,
          y: slot.y - (size - slot.size) + (enemy.isBoss ? BOSS_DROP : 0),
          size,
        };

        const isAttacking = animatingEnemyId === enemy.id;
        const isHoveredTarget = hoveredTargetIds.includes(enemy.id);
        const isBeingAttacked = animatingTargetIds.includes(enemy.id);
        const isHitStopped = enemyHitStopIds.includes(enemy.id);
        const isSpeaking = speakingEnemy?.id === enemy.id && !enemy.isDead;
        const lowHp = !enemy.isDead && enemy.hp / enemy.maxHp < 0.3;

        let moveTransform = '';
        let transitionClass = 'transition-all duration-600 ease-out';
        let transitionStyle;
        if (isAttacking) {
          const leaps = enemy.attackStyle === 'melee' || !enemy.attackStyle;
          moveTransform = leaps
            ? `translate(${enemyLeap.dx}px, ${enemyLeap.dy}px) scale(1.15)`
            : 'scale(1.15)';
          transitionClass = 'transition-all ease-out';
          transitionStyle = {
            transitionDuration: `${enemyAttackDurationMs}ms`,
            transitionTimingFunction: enemyAttackEasing,
          };
        } else if (isHoveredTarget && !isAnimating) {
          moveTransform = 'translate(-16px, 0)';
        } else if (isBeingAttacked && shake.x !== 0) {
          moveTransform = `translate(${shake.x * 0.5}px, ${shake.y * 0.5}px) rotate(${shake.rot * 0.5}deg) scale(1.1)`;
          transitionClass = 'transition-none';
        } else if (isBeingAttacked) {
          moveTransform = 'scale(1.1)';
        }

        return (
          <FieldUnit
            key={`enemy-${enemy.id}`}
            unit={unit}
            mirrored
            badges={(
              <>
                <FieldBadges badges={enemy.badges} onTipShow={onEffectTipShow} onTipHide={onEffectTipHide} />
                {!enemy.isDead && <EnemyHpBar hp={enemy.hp} maxHp={enemy.maxHp} {...HP_BAR} />}
              </>
            )}
            overlay={render.enemyOverlay?.(enemy, { isHoveredTarget, isBeingAttacked })}
            overlayScale={1 / stageScale}
            nodeRef={(el) => setEnemyRef?.(enemy.id, el)}
            dataAttrs={{
              'data-qte-realtime': isAttacking && (enemy.attackStyle === 'melee' || !enemy.attackStyle) ? 'true' : undefined,
            }}
            moveTransform={moveTransform}
            transitionClass={transitionClass}
            transitionStyle={transitionStyle}
            outerClass={[
              enemy.isDead ? 'opacity-20 grayscale scale-75' : '',
              isAttacking ? 'z-50 drop-shadow-[0_0_40px_rgba(239,68,68,1)]' : '',
              isBeingAttacked && shake.x === 0 ? 'brightness-150 animate-pulse' : '',
            ].join(' ')}
            innerClass={[
              isHoveredTarget || isBeingAttacked ? 'drop-shadow-[0_0_25px_rgba(239,68,68,0.4)]' : '',
              flashingTargets.includes(enemy.id) && !isHitStopped ? 'brightness-0 invert drop-shadow-[0_0_40px_white] scale-150 -translate-y-4 z-[2000]' : '',
              isHitStopped ? 'brightness-0 invert drop-shadow-[0_0_70px_white] scale-[1.4] z-[2000]' : '',
            ].join(' ')}
            innerStyle={{
              animation: isHitStopped
                ? 'enemyHitStopImpact 700ms linear both'
                : isSpeaking && !isBeingAttacked && !isAttacking
                  ? 'speechWobble 0.4s ease-in-out infinite'
                  : lowHp && !isBeingAttacked && !isAttacking && !flashingTargets.includes(enemy.id)
                    ? 'lowHpPulse 0.9s ease-in-out infinite'
                    : 'none',
              transition: isHitStopped ? 'none' : 'all 0.15s ease-out',
              transformOrigin: 'center',
            }}
          >
            {enemy.atlas
              ? (
                <CharSprite
                  atlas={enemy.atlas}
                  size={size}
                  speed={ENEMY_IDLE_SPEED}
                  startFrame={idleStartFrame(enemy.id)}
                  paused={isHitStopped}
                />
              )
              : <span style={{ fontSize: size * 0.4 }}>{enemy.icon}</span>}
          </FieldUnit>
        );
      })}

      <StageBox {...locationFrame} zIndex={20}>
        <NineSlice name="location_frame" width={locationFrame.width} height={locationFrame.height} />
      </StageBox>

      {DECOR.map((decor) => (
        <StageBox
          key={decor.id}
          x={decor.x}
          y={decor.y}
          width={decor.size}
          height={decor.size}
          zIndex={25}
          className="transition-opacity duration-200"
          style={{ opacity: mergeOpen ? 0.4 : 1 }}
        >
          <div style={{ width: decor.size, height: decor.size, transform: decor.flip ? 'scaleX(-1)' : undefined }}>
            <UiSprite name="decor" width={decor.size} height={decor.size} />
          </div>
        </StageBox>
      ))}

      {/* Инвентарь с крафтом уходит вместе с остальным боевым HUD: на карте
          сектора его место занимает сама карта. Узел инвентаря остаётся
          смонтированным — от него FxLayer считает, куда летит лут.

          Инвентарь лежит выше панели слияния и не гаснет вместе с остальным HUD:
          из него в панель кладут предметы, и по макету она выезжает и уезжает
          именно из-под него. Порядок слоёв постоянный — иначе на закрытии они
          менялись бы местами в первом же кадре и панель пряталась бы поверх
          интерфейса. */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ opacity: hidden ? 0 : 1, pointerEvents: 'none', zIndex: 61 }}
      >
      <StageBox {...inventoryBg} zIndex={30}>
        <NineSlice name="items_inventory_bg" width={inventoryBg.width} height={inventoryBg.height} />
      </StageBox>

      {Array.from({ length: ITEM_SLOTS.count }, (_, index) => {
        const item = items[index];
        return (
          <StageBox
            key={`item-slot-${index}`}
            x={ITEM_SLOTS.x + index * ITEM_SLOTS.step}
            y={ITEM_SLOTS.y}
            width={ITEM_SLOTS.size}
            height={ITEM_SLOTS.size}
            zIndex={35}
            style={{ pointerEvents: inventoryPointer }}
          >
            <div
              data-merge-keep=""
              draggable={Boolean(item)}
              onDragStart={item ? onItemDragStart?.(index) : undefined}
              onClick={item ? onItemClick?.(index) : undefined}
              onMouseEnter={(event) => onItemTipShow?.(item, event)}
              onMouseMove={(event) => onItemTipShow?.(item, event)}
              onMouseLeave={onItemTipHide}
              style={{ cursor: item ? (mergeOpen ? 'pointer' : 'grab') : 'default' }}
            >
              <UiSprite name="item_slot">
                {item && (
                  <>
                    <RarityWash color={item.rarityColor} inset={6} radius={8} />
                    <img
                      src={item.iconUrl}
                      alt=""
                      draggable={false}
                      className="absolute inset-0 h-full w-full select-none object-contain p-1"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </>
                )}
              </UiSprite>
            </div>
          </StageBox>
        );
      })}

      <StageBox {...mergeButton} zIndex={35} style={{ pointerEvents: inventoryPointer }}>
        <button data-merge-keep="" type="button" onClick={onOpenCraft ?? noop} title="Крафт" className="block transition-transform hover:scale-105 active:scale-95">
          <UiSprite name="merge_button" />
        </button>
      </StageBox>
      </div>

      {/* Нижняя панель гаснет на карте сектора, но остаётся смонтированной:
          от её узлов VFX считают точки вылета карт. */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ opacity: hudOpacity, pointerEvents: 'none', zIndex: heroHovered ? 62 : 30 }}
      >
        <StageBox {...manaCounter} zIndex={30}>
          <UiSprite name="mana_counter">
            <Counter style={{ left: 128, top: 128, fontSize: 117 }}>{mana}</Counter>
          </UiSprite>
        </StageBox>

        <StageBox {...buttonRed} zIndex={30} style={{ pointerEvents: hudPointer }}>
          <button
            type="button"
            onClick={onEndTurn ?? noop}
            disabled={!canEndTurn}
            className="relative block w-full transition-transform enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-60"
          >
            <NineSlice name="button_red" width={buttonRed.width} height={buttonRed.height} />
            <Counter style={{ left: buttonRed.width / 2, top: buttonRed.height / 2, fontSize: 44 }}>
              {endTurnLabel}
            </Counter>
          </button>
        </StageBox>

        {CARD_DECKS.map((deck, index) => {
          const isDraw = index === 0;
          return (
            <StageBox key={deck.id} x={deck.x} y={deck.y} width={deck.width} height={deck.height} zIndex={30} style={{ pointerEvents: hudPointer }}>
              <div
                ref={isDraw ? setDeckNode : setDiscardNode}
                onClick={isDraw ? onOpenDeck : undefined}
                style={{
                  width: deck.width,
                  height: deck.height,
                  transform: `rotate(${deck.rotate}deg)`,
                  cursor: isDraw && onOpenDeck ? 'help' : 'default',
                }}
              >
                <UiSprite name="cards_deck">
                  <Counter style={{ left: 58, top: 80, fontSize: 62 }}>
                    {isDraw ? drawCount : discardCount}
                  </Counter>
                </UiSprite>
              </div>
            </StageBox>
          );
        })}

        {HERO_SLOTS.map((box, index) => {
          const hero = heroes[index];
          if (!hero) return null;
          const hoveredIndex = heroes.findIndex((other) => other.isHovered);
          // Соседи расступаются перед поднятым слотом — анимация из старой вёрстки,
          // её keyframes живут в глобальном <style> в App.
          const nudge = hoveredIndex !== -1 && !hero.isHovered && !hero.isDead
            ? (index < hoveredIndex ? 'slot-push-left' : 'slot-push-right')
            : '';
          return (
            <StageBox key={`slot-${hero.id}`} {...box} zIndex={hero.isHovered ? 45 : nudge ? 38 : 40} style={{ overflow: 'visible', pointerEvents: hudPointer }}>
              <HeroSlotBox
                box={box}
                hero={hero}
                index={index}
                nudge={nudge}
                shake={shake}
                isDraggingItem={isDraggingItem}
                onPlayCard={onPlayCard}
                onCardHover={onCardHover}
                onCardHoverEnd={onCardHoverEnd}
                setSlotRef={setSlotRef}
                onEquipDragOver={onEquipDragOver}
                onEquipDragLeave={onEquipDragLeave}
                onEquipDrop={onEquipDrop}
                onUnequip={onUnequip}
                onItemTipShow={onItemTipShow}
                onItemTipHide={onItemTipHide}
              >
                {hero.card
                  ? <MagicCard {...hero.card} />
                  : (
                    <div
                      className="flex items-center justify-center"
                      style={{ ...CARD_BODY, fontFamily: "'Greybeard', sans-serif", fontSize: 28, color: 'rgba(255,253,204,0.35)' }}
                    >
                      {hero.isDead ? 'Павший' : hero.hasActed ? 'Ход завершён' : ''}
                    </div>
                  )}
              </HeroSlotBox>
            </StageBox>
          );
        })}
      </div>

      {/* Инвентарь целиком в одном узле: от него FxLayer считает, куда летит лут. */}
      <div ref={setInventoryNode} className="pointer-events-none absolute" style={{
        left: `${(ITEM_SLOTS.x / 3200) * 100}%`,
        top: `${(ITEM_SLOTS.y / 1800) * 100}%`,
        width: `${((ITEM_SLOTS.step * ITEM_SLOTS.count) / 3200) * 100}%`,
        height: `${(ITEM_SLOTS.size / 1800) * 100}%`,
      }} />

      {/* Карта сектора и её дизолв-веил. Внутри они пока свёрстаны в старых
          пикселях (MAP_PANEL_DESIGN), поэтому бокс сцены только даёт им место, а
          масштаб до него доводит вложенный scale — до редизайна содержимое карты
          не трогаем. Веил ниже карты по слою: он проявляет HUD уже после того,
          как карта растворилась. */}
      {arenaVeilVisible && (
        <StageBox {...MAP_PANEL} zIndex={50} style={{ pointerEvents: 'none' }}>
          <MapPanelFrame>{render.arenaVeil?.()}</MapPanelFrame>
        </StageBox>
      )}

      {mapPanelMounted && (
        <StageBox {...MAP_PANEL} zIndex={55} style={{ pointerEvents: 'none' }}>
          <MapPanelFrame>{render.mapPanel?.()}</MapPanelFrame>
        </StageBox>
      )}

      <MergePanel
        open={mergeOpen}
        slots={merge.slots}
        warning={merge.warning}
        onSlotClick={onMergeSlotClick}
        onConfirm={onMergeConfirm}
        onTipShow={onItemTipShow}
        onTipHide={onItemTipHide}
      />

      {render.combo?.()}
    </ScreenStage>
  );
};

export default BattleScreen;
