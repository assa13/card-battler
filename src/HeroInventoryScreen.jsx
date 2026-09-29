import SmallIconText from './ui/SmallIconText';
import { useEffect, useMemo, useState } from 'react';
import HeroCarousel from './HeroCarousel';
import EquipmentTooltip from './EquipmentTooltip';
import UpgradePopup from './UpgradePopup';
import PreparationCardSlot from './PreparationCardSlot';
import GameIcon from './ui/GameIcon';
import {
  DEFAULT_UNLOCKED_SLOTS,
  getCardLevel,
  getUpgradeCost,
  getCardUnlockGoldCost,
  MAX_CARD_LEVEL,
  HERO_CARD_LOADOUT_SIZE,
} from './heroCardInventory';

const RARITY_ORDER = { LEGENDARY: 0, EPIC: 1, RARE: 2, COMMON: 3 };
const EMPTY_IDS = Object.freeze([]);
// Native MagicCard dimensions. Scale the complete battle component uniformly.
const CARD_ART = { width: 374, height: 434 };

const ScaledCard = ({ card, level, heroId, renderCardPreview, width, animated = false }) => (
  <div style={{ width, height: CARD_ART.height * width / CARD_ART.width, pointerEvents: 'none' }}>
    <div style={{ ...CARD_ART, transformOrigin: 'top left', transform: `scale(${width / CARD_ART.width})` }}>
      {renderCardPreview?.({ ...card, level }, heroId, { animated })}
    </div>
  </div>
);

const CardInspection = ({ tooltip, heroId, renderCardPreview }) => {
  if (!tooltip || !renderCardPreview) return null;
  const TIP_W = 232;
  const TIP_H = CARD_ART.height * TIP_W / CARD_ART.width;
  const PAD = 8;
  const placeAbove = tooltip.top - TIP_H - PAD >= 0;
  const top = Math.max(PAD, Math.min(placeAbove ? tooltip.top - TIP_H - PAD : tooltip.bottom + PAD, window.innerHeight - TIP_H - PAD));
  const left = Math.max(PAD, Math.min(tooltip.x - TIP_W / 2, window.innerWidth - TIP_W - PAD));
  return (
    <div className="fixed z-[9500] pointer-events-none animate-in fade-in zoom-in-95 duration-150" style={{ left, top, width: TIP_W, height: TIP_H }}>
      <ScaledCard card={tooltip.card} level={tooltip.level} heroId={heroId}
        renderCardPreview={renderCardPreview} width={TIP_W} animated />
    </div>
  );
};

const InventoryCardSlot = ({ card, level = 1, locked = false, isHover = false, heroId, renderCardPreview, className = '', children }) => (
  <div className={`relative h-[104px] w-20 shrink-0 ${className}`}>
    {card ? <>
      <div className={`transition-transform ${isHover ? 'scale-105' : ''} ${locked ? 'opacity-50 grayscale' : ''}`}>
        <ScaledCard card={card} level={level} heroId={heroId} renderCardPreview={renderCardPreview} width={80} />
      </div>
      {locked && <span className="absolute left-1 top-1 text-[10px] pointer-events-none"><SmallIconText>🔒</SmallIconText></span>}
      {children}
    </> : <PreparationCardSlot locked={locked} className="origin-top-left scale-125">{children}</PreparationCardSlot>}
  </div>
);

// Кнопка разблокировки слота за огоньки — тот же bbox, что у InventoryCardSlot / prep-экран.
const EmberUnlockSlot = ({ cost, balance, canBuy, onClick, title }) => (
  <div className="relative h-[104px] w-20 shrink-0">
    <button
      type="button"
      onClick={onClick}
      disabled={!canBuy}
      title={title}
      className={`kit-card-slot origin-top-left scale-125 relative w-16 h-20 flex flex-col items-center justify-center gap-1 transition-transform ${
        canBuy
          ? 'hover:brightness-125 cursor-pointer'
          : 'cursor-not-allowed'
      }`}
    >
      <GameIcon name="ember" size={30} />
      <span className={`text-[12px] font-black ${canBuy ? 'text-green-400' : 'text-red-400'}`}>
        {String(balance)}/{String(cost)}
      </span>
    </button>
  </div>
);

const HeroInventoryScreen = ({
  heroes,
  initialHeroId,
  abilities,
  permanentlyUnlockedCards,
  cardLoadouts,
  cardProgression,
  slotsUnlocked = {},
  slotUnlockCost = 3,
  inventory,
  equipped,
  gold,
  soulEmbers,
  onClose,
  onAssign,
  onReorder,
  onRemove,
  onUnlock,
  onUnlockSlot,
  onUpgrade,
  onEquip,
  onUnequip,
  onHire,
  renderBackground,
  renderCardPreview,
  renderItemTooltip,
}) => {
  const [selectedHeroId, setSelectedHeroId] = useState(initialHeroId || heroes[0]?.id);
  const [dragSource, setDragSource] = useState(null);
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [upgradeCard, setUpgradeCard] = useState(null);
  const [notice, setNotice] = useState('');
  const selectedHero = heroes.find((hero) => hero.id === selectedHeroId) || heroes[0];
  const heroAbilities = abilities[selectedHero?.id] || { basic: null, skills: [] };
  const unlockedIds = permanentlyUnlockedCards[selectedHero?.id] || [];
  const activeIds = cardLoadouts[selectedHero?.id] || EMPTY_IDS;
  const unlockedSlotCount = Math.max(
    DEFAULT_UNLOCKED_SLOTS,
    slotsUnlocked[selectedHero?.id] ?? DEFAULT_UNLOCKED_SLOTS,
  );

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 3600);
    return () => clearTimeout(timer);
  }, [notice]);

  const collectionCards = useMemo(() => (
    [...(heroAbilities.skills || [])].sort((a, b) => (
      (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99)
      || a.name.localeCompare(b.name, 'ru')
    ))
  ), [heroAbilities.skills]);

  const packedLoadout = useMemo(() => (
    activeIds
      .slice(0, unlockedSlotCount)
      .map((id, slotIndex) => ({
        slotIndex,
        card: id ? collectionCards.find((entry) => entry.id === id) || null : null,
      }))
      .filter((entry) => entry.card)
  ), [activeIds, unlockedSlotCount, collectionCards]);

  const getLevel = (card) => getCardLevel(cardProgression, selectedHero.id, card.id);
  const showCard = (card, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredCard({
      card,
      level: getLevel(card),
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
    });
  };
  const hideCard = () => setHoveredCard(null);
  const isCardHovered = (card) => Boolean(card && hoveredCard?.card.id === card.id);
  const showItem = (item, event) => item && setHoveredItem({ item, x: event.clientX, y: event.clientY });
  const hideItem = () => setHoveredItem(null);
  const beginUpgrade = (card) => {
    const level = getLevel(card);
    if (level >= MAX_CARD_LEVEL) {
      setUpgradeCard(card);
      return;
    }
    if (gold < getUpgradeCost(level)) {
      setNotice('Не хватает золота. Заработать можно, беседуя с посетителями или продавая вещи.');
      return;
    }
    setUpgradeCard(card);
  };
  const assignCard = (cardId, targetIndex = null) => onAssign?.(selectedHero.id, cardId, targetIndex);
  const handleDrop = (slotIndex) => (event) => {
    event.preventDefault();
    if (!dragSource) return;
    if (slotIndex >= unlockedSlotCount) return;
    if (dragSource.kind === 'collection') assignCard(dragSource.cardId, slotIndex);
    if (dragSource.kind === 'slot') onReorder?.(selectedHero.id, dragSource.index, slotIndex);
    setDragSource(null);
  };
  const tryUnlockSlot = () => {
    if (onUnlockSlot?.(selectedHero.id)) return;
    if (soulEmbers < slotUnlockCost) {
      setNotice(`Нужно ${String(slotUnlockCost)} огоньков души для слота.`);
    }
  };
  const tryHire = (targetHeroId) => {
    const cost = selectedHero.hire?.cost ?? 0;
    if (onHire?.(targetHeroId)) return;
    if (gold < cost) setNotice(`Нужно ${String(cost)} золота для найма.`);
    else setNotice('Не удалось нанять наёмника.');
  };

  if (!selectedHero) return null;

  const hireInfo = selectedHero.hire;
  const hireReady = hireInfo?.available;

  return (
    <div className="fixed inset-0 z-[9400] overflow-hidden bg-slate-950">
      <div className="absolute inset-0 grayscale">{renderBackground?.()}</div>
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative h-full w-full">
        <HeroCarousel heroes={heroes} selectedHeroId={selectedHero.id} onSelect={setSelectedHeroId} />
        <button type="button" onClick={onClose} className="absolute left-[2.06%] top-[2.55%] z-40 flex h-[8%] w-[5%] items-center justify-center" aria-label="Назад">
          <span className="text-4xl text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.95)]"><SmallIconText>◀</SmallIconText></span>
        </button>
        <h1 className="absolute left-[8.31%] top-[2.65%] z-20 text-white" style={{ fontFamily: "'Greybeard', sans-serif", fontSize: 'clamp(21px, 3.75vw, 66px)' }}>Герои</h1>
        {/* Баланс — глобальный WalletHUD в App (правый верхний угол) */}
        <main className="absolute left-[30.6875%] top-[4.65%] z-20 flex h-[75%] w-[69.3125%] flex-col items-center justify-center text-white" style={{ fontFamily: "'Greybeard', sans-serif" }}>
          {selectedHero.locked ? (
            <section className="flex flex-col items-center gap-5 text-center max-w-lg">
              <span className="text-8xl drop-shadow-[0_0_20px_rgba(0,0,0,0.9)]"><SmallIconText>{hireReady ? '⚔' : '🔒'}</SmallIconText></span>
              <h2 style={{ fontSize: 'clamp(21px, 3vw, 54px)' }}>{selectedHero.name}</h2>
              <p className="text-amber-300/90" style={{ fontSize: 'clamp(13px, 1.3vw, 24px)' }}>
                {selectedHero.lockHint || 'Заблокировано'}
              </p>
              {hireReady ? (
                <>
                  <p className={`font-black ${gold >= (hireInfo.cost ?? 0) ? 'text-amber-200' : 'text-red-400'}`} style={{ fontSize: 'clamp(18px, 2vw, 36px)' }}>
                    <GameIcon name="coin" /> {String(hireInfo.cost)}
                  </p>
                  <p className="opacity-60" style={{ fontSize: 'clamp(11px, 1vw, 18px)' }}>
                    Заменит одного из героев в отряде. Класс и карты останутся у выбранного слота.
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-3">
                    {(hireInfo.options || []).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => tryHire(option.id)}
                        className="kit-button"
                      >
                        Заменить {option.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="max-w-md opacity-60" style={{ fontSize: 'clamp(11px, 1vw, 18px)' }}>
                  Наёмник ждёт своего часа. Его клинок продаётся за золото —
                  но цену он назовёт только в пыточных.
                </p>
              )}
            </section>
          ) : (
          <>
          <section className="w-fit">
            <h2 className="mb-[4.2%] opacity-80" style={{ fontSize: 'clamp(18px, 2.9vw, 52px)' }}>Ammunition</h2>
            <div className="flex gap-1">
              <div
                onClick={() => beginUpgrade(heroAbilities.basic)}
                onMouseEnter={(event) => showCard(heroAbilities.basic, event)}
                onMouseLeave={hideCard}
                className="relative"
              >
                <InventoryCardSlot
                  card={heroAbilities.basic}
                  heroId={selectedHero.id}
                  renderCardPreview={renderCardPreview}
                  level={getLevel(heroAbilities.basic)}
                  isHover={isCardHovered(heroAbilities.basic)}
                />
              </div>
              {Array.from({ length: HERO_CARD_LOADOUT_SIZE }).map((_, visualIndex) => {
                const canUnlockMore = unlockedSlotCount < HERO_CARD_LOADOUT_SIZE;
                const canBuy = soulEmbers >= slotUnlockCost;
                const emberTitle = canBuy
                  ? `Разблокировать слот за ${String(slotUnlockCost)} огоньков души`
                  : `Нужно ${String(slotUnlockCost)} огоньков души`;

                if (visualIndex < packedLoadout.length) {
                  const { slotIndex, card } = packedLoadout[visualIndex];
                  return (
                    <div
                      key={`loadout-card-${slotIndex}`}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', card.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDragSource({ kind: 'slot', index: slotIndex });
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={handleDrop(slotIndex)}
                      onClick={() => onRemove?.(selectedHero.id, card.id)}
                      onMouseEnter={(event) => showCard(card, event)}
                      onMouseLeave={hideCard}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <InventoryCardSlot
                        card={card}
                        heroId={selectedHero.id}
                        renderCardPreview={renderCardPreview}
                        level={getLevel(card)}
                        isHover={isCardHovered(card)}
                      />
                    </div>
                  );
                }

                if (visualIndex < unlockedSlotCount) {
                  return (
                    <div
                      key={`loadout-empty-${visualIndex}`}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={handleDrop(visualIndex)}
                    >
                      <InventoryCardSlot />
                    </div>
                  );
                }

                // Каждый из двух слотов покупается отдельно: кнопка цены занимает
                // следующий слот строго после уже разблокированных.
                if (visualIndex === unlockedSlotCount && canUnlockMore) {
                  return (
                    <EmberUnlockSlot
                      key={`unlock-slot-${visualIndex}`}
                      cost={slotUnlockCost}
                      balance={soulEmbers}
                      canBuy={canBuy}
                      onClick={tryUnlockSlot}
                      title={emberTitle}
                    />
                  );
                }

                return <InventoryCardSlot key={`loadout-locked-${visualIndex}`} locked />;
              })}
              <InventoryCardSlot>
                <EquipmentTooltip
                  item={equipped[selectedHero.id]}
                  inventory={inventory}
                  onSwap={(itemUid) => onEquip?.(selectedHero.id, itemUid)}
                  onUnequip={() => onUnequip?.(selectedHero.id)}
                  onItemHover={showItem}
                  onItemLeave={hideItem}
                />
              </InventoryCardSlot>
            </div>
          </section>
          <section className="mt-12 w-fit">
            <h2 className="mb-[5.2%] opacity-80" style={{ fontSize: 'clamp(18px, 2.9vw, 52px)' }}>Collection</h2>
            <div className="grid grid-cols-4 gap-x-1 gap-y-2">
              {[...collectionCards, ...Array(Math.max(0, 8 - collectionCards.length)).fill(null)].slice(0, 8).map((card, index) => {
                if (!card) return <InventoryCardSlot key={`placeholder-${index}`} locked />;
                const isUnlocked = unlockedIds.includes(card.id);
                const isActive = activeIds.includes(card.id);
                const cardGoldCost = getCardUnlockGoldCost(card.rarity);
                return (
                  <div
                    key={card.id}
                    draggable={isUnlocked}
                    onDragStart={(event) => {
                      if (!isUnlocked) return;
                      event.dataTransfer.setData('text/plain', card.id);
                      event.dataTransfer.effectAllowed = 'move';
                      setDragSource({ kind: 'collection', cardId: card.id });
                    }}
                    onClick={() => {
                      if (!isUnlocked) {
                        if (!onUnlock?.(selectedHero.id, card.id)) {
                          setNotice(`Нужно ${String(cardGoldCost)} золота для разблокировки.`);
                        }
                        return;
                      }
                      if (isActive) beginUpgrade(card);
                      else assignCard(card.id);
                    }}
                    onMouseEnter={(event) => showCard(card, event)}
                    onMouseLeave={hideCard}
                    className={`${isUnlocked ? 'cursor-pointer' : 'cursor-not-allowed'} ${isActive ? 'rounded-xl ring-2 ring-amber-300' : ''}`}
                  >
                    <InventoryCardSlot
                      card={card}
                      heroId={selectedHero.id}
                      renderCardPreview={renderCardPreview}
                      level={getLevel(card)}
                      locked={!isUnlocked}
                      isHover={isCardHovered(card)}
                    >
                      {!isUnlocked && (
                        <span className="pointer-events-none absolute bottom-1 rounded bg-black/75 px-1 text-[9px] font-black text-amber-300">
                          <GameIcon name="coin" /> {String(cardGoldCost)}
                        </span>
                      )}
                    </InventoryCardSlot>
                  </div>
                );
              })}
            </div>
          </section>
          </>
          )}
        </main>
        {notice && <div className="absolute bottom-[13%] left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-red-400/60 bg-red-950/95 px-4 py-3 text-center font-bold text-red-100 shadow-2xl" style={{ fontFamily: "'Greybeard', sans-serif", fontSize: '11px' }}>{notice}</div>}
      </div>

      <CardInspection
        tooltip={hoveredCard}
        heroId={selectedHero.id}
        renderCardPreview={renderCardPreview}
      />
      {hoveredItem && renderItemTooltip?.(hoveredItem)}
      <UpgradePopup
        card={upgradeCard}
        level={upgradeCard ? getLevel(upgradeCard) : 1}
        cost={upgradeCard ? getUpgradeCost(getLevel(upgradeCard)) : 0}
        gold={gold}
        onClose={() => setUpgradeCard(null)}
        onConfirm={() => {
          onUpgrade?.(selectedHero.id, upgradeCard.id);
          setUpgradeCard(null);
        }}
      />
    </div>
  );
};

export default HeroInventoryScreen;
