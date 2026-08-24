import ScreenStage from '../ScreenStage';
import StageBox from '../ui/StageBox';
import NineSlice from '../ui/NineSlice';
import UiSprite from '../ui/UiSprite';
import CharSprite from '../CharSprite';
import HeroSlot from '../widgets/HeroSlot';
import MagicCard from '../widgets/MagicCard';
import { spriteColorizeFilter } from '../spriteColorize';
import { useBattleView } from './battleView';
import {
  BATTLE_LAYOUT,
  BOSS_SCALE,
  CARD_DECKS,
  DECOR,
  ENEMY_FORMATIONS,
  HERO_SLOTS,
  HERO_UNITS,
  ITEM_SLOTS,
} from './battleLayout';

// Боевой экран на холсте 3200×1800.
//
// Состояние остаётся в App.jsx и приходит снимком через battleView: здесь только
// раскладка по координатам макета и отрисовка. Мелкие элементы, которые в макет
// не переносились (значки брони, полоска HP врага, прицел, реплики), приходят
// готовыми функциями отрисовки — их владелец по-прежнему App.
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

const noop = () => {};

// Числа поверх арта. В атласе у счётчика маны и стопок карт текст пока запечён в
// картинку, поэтому живое значение налезает на нарисованное — числа стоят по
// центру своих боксов, а точная посадка будет после переэкспорта регионов без
// текста (docs/battle-migration.md).
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

// Боец на поле. Внешний бокс двигается (прыжок, ховер, тряска) с переходом,
// внутренний отвечает за вспышки и свечение — ровно как на старом экране,
// иначе зеркало врага дёргалось бы вместе с движением.
const FieldUnit = ({ unit, moveTransform, transitionClass, transitionStyle, outerClass, innerClass, innerStyle, mirrored, nodeRef, dataAttrs, children }) => (
  <StageBox x={unit.x} y={unit.y} width={unit.size} height={unit.size} zIndex={15} style={{ overflow: 'visible' }}>
    <div
      ref={nodeRef}
      className={`${transitionClass} ${outerClass}`}
      style={{ width: unit.size, height: unit.size, transform: moveTransform, ...transitionStyle }}
      {...dataAttrs}
    >
      <div className="relative" style={mirrored ? { transform: 'scaleX(-1)' } : undefined}>
        <div className={`relative ${innerClass}`} style={innerStyle}>
          {children}
        </div>
      </div>
    </div>
  </StageBox>
);

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
    onItemTipShow,
    onItemTipHide,
    onAttackAnimCycle,
  } = useBattleView() ?? DEMO;

  const hidden = turnState === 'map';
  const enemyFormation = ENEMY_FORMATIONS[enemies.length] || ENEMY_FORMATIONS[3];

  return (
    <ScreenStage zIndex={zIndex}>
      <StageBox {...fieldBackground} zIndex={10} style={{ overflow: 'hidden' }}>
        {background?.url && (
          <img
            src={background.url}
            alt=""
            draggable={false}
            className="h-full w-full select-none object-cover"
            style={{
              width: fieldBackground.width,
              height: fieldBackground.height,
              filter: background.hue != null
                ? spriteColorizeFilter(background.hue, background.sat)
                : undefined,
            }}
          />
        )}
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
          moveTransform = `translate(${attackTranslate.dx}px, ${attackTranslate.dy}px) scale(1.15)`;
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
            {render.heroBadges?.(hero)}
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

      <div ref={setEnemyZoneNode} className="absolute inset-0" style={{ pointerEvents: 'none', zIndex: 14 }} />

      {enemies.map((enemy, index) => {
        const slot = enemyFormation[index] || enemyFormation[enemyFormation.length - 1];
        if (!slot) return null;
        const size = enemy.isBoss ? Math.round(slot.size * BOSS_SCALE) : slot.size;
        // Босс крупнее и оттого сидит ниже — приподнимаем, как на старом экране.
        const unit = { x: slot.x - (size - slot.size) / 2, y: slot.y - (size - slot.size), size };

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
            ? `translate(${enemyAttackTranslate.dx}px, ${enemyAttackTranslate.dy}px) scale(1.15)`
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
              ? <CharSprite atlas={enemy.atlas} size={size} paused={isHitStopped} />
              : <span style={{ fontSize: size * 0.4 }}>{enemy.icon}</span>}
            {render.enemyOverlay?.(enemy, { isHoveredTarget, isBeingAttacked })}
          </FieldUnit>
        );
      })}

      <StageBox {...locationFrame} zIndex={20}>
        <NineSlice name="location_frame" width={locationFrame.width} height={locationFrame.height} />
      </StageBox>

      {DECOR.map((decor) => (
        <StageBox key={decor.id} x={decor.x} y={decor.y} width={decor.size} height={decor.size} zIndex={25}>
          <div style={{ width: decor.size, height: decor.size, transform: decor.flip ? 'scaleX(-1)' : undefined }}>
            <UiSprite name="decor" width={decor.size} height={decor.size} />
          </div>
        </StageBox>
      ))}

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
          >
            <div
              draggable={Boolean(item)}
              onDragStart={item ? onItemDragStart?.(index) : undefined}
              onMouseEnter={(event) => onItemTipShow?.(item, event)}
              onMouseLeave={onItemTipHide}
              style={{ cursor: item ? 'grab' : 'default' }}
            >
              <UiSprite name="item_slot">
                {item && (
                  <img
                    src={item.iconUrl}
                    alt=""
                    draggable={false}
                    className="absolute inset-0 h-full w-full select-none object-contain p-1"
                    style={{ imageRendering: 'pixelated' }}
                  />
                )}
              </UiSprite>
            </div>
          </StageBox>
        );
      })}

      <StageBox {...mergeButton} zIndex={35}>
        <button type="button" onClick={onOpenCraft ?? noop} title="Крафт" className="block transition-transform hover:scale-105 active:scale-95">
          <UiSprite name="merge_button" />
        </button>
      </StageBox>

      {/* Нижняя панель гаснет на карте сектора, но остаётся смонтированной:
          от её узлов VFX считают точки вылета карт. */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ opacity: hidden ? 0 : 1, pointerEvents: hidden ? 'none' : undefined, zIndex: 30 }}
      >
        <StageBox {...manaCounter} zIndex={30}>
          <UiSprite name="mana_counter">
            <Counter style={{ left: 128, top: 128, fontSize: 64 }}>{mana}</Counter>
          </UiSprite>
        </StageBox>

        <StageBox {...buttonRed} zIndex={30}>
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
            <StageBox key={deck.id} x={deck.x} y={deck.y} width={deck.width} height={deck.height} zIndex={30}>
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
                  <Counter style={{ left: 62, top: 86, fontSize: 40 }}>
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
          return (
            <StageBox key={`slot-${hero.id}`} {...box} zIndex={hero.isHovered ? 45 : 40} style={{ overflow: 'visible' }}>
              <div
                ref={(el) => setSlotRef?.(hero.id, el)}
                onClick={() => hero.canPlay && onPlayCard?.(index, hero.card?.source)}
                onMouseEnter={() => onCardHover?.(index)}
                onMouseLeave={onCardHoverEnd}
                className="transition-transform duration-200"
                style={{
                  opacity: hero.isDead ? 0.4 : 1,
                  filter: hero.isDead ? 'grayscale(1)' : undefined,
                  cursor: hero.canPlay ? 'pointer' : 'default',
                  transform: hero.isHovered && hero.canPlay ? 'translateY(-24px) scale(1.04)' : undefined,
                }}
              >
                <HeroSlot heroName={hero.name} hp={hero.hp} maxHp={hero.maxHp} showArtefactSlot={!hero.isDead}>
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
                </HeroSlot>
              </div>
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

      {render.combo?.()}
    </ScreenStage>
  );
};

export default BattleScreen;
