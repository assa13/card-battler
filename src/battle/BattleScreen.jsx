import ScreenStage from '../ScreenStage';
import StageBox from '../ui/StageBox';
import NineSlice from '../ui/NineSlice';
import UiSprite from '../ui/UiSprite';
import HeroSlot from '../widgets/HeroSlot';
import MagicCard from '../widgets/MagicCard';
import { useBattleView } from './battleView';
import {
  BATTLE_FIGMA,
  BATTLE_LAYOUT,
  CARD_DECKS,
  DECOR,
  FIELD_UNITS,
  HERO_SLOTS,
  ITEM_SLOTS,
} from './battleLayout';

// Боевой экран на холсте 3200×1800.
//
// Пока только чтение: экран показывает настоящее состояние боя, но не
// принимает кликов — интерактив подключается следующим шагом. Живой бой идёт
// на старом экране в App.jsx, этот открывается поверх по F9.
//
// Данные приходят снимком через BattleViewContext. Без провайдера (dev-роут
// #battle открыт напрямую) экран рисует демо-данные ниже, чтобы вёрстку можно
// было смотреть, не запуская бой.
const DEMO = {
  mana: 2,
  maxMana: 5,
  drawCount: 99,
  discardCount: 99,
  heroes: [
    {
      id: 'p1',
      name: 'Warrior',
      hp: 34,
      maxHp: 40,
      card: { name: 'Удар щитом', description: 'Бьёт и ставит броню', cost: 2, rarity: 'COMMON', icon: '🛡️' },
    },
    {
      id: 'p2',
      name: 'Rogue',
      hp: 21,
      maxHp: 28,
      card: { name: 'Кинжал', description: 'Два быстрых удара', cost: 1, rarity: 'RARE', icon: '🗡️' },
    },
    {
      id: 'p3',
      name: 'Mage',
      hp: 18,
      maxHp: 24,
      card: { name: 'Огненный шар', description: 'Бьёт по всем врагам', cost: 3, rarity: 'EPIC', icon: '☄️' },
    },
  ],
  enemies: [],
  items: [],
};

// Пунктирная рамка для того, чего ещё нет: картинка локации и спрайты бойцов
// приходят не из атласа.
const Placeholder = ({ label, round = false }) => (
  <div
    className={`flex h-full w-full items-center justify-center border-2 border-dashed border-sky-400/30 bg-sky-400/[0.05] ${round ? 'rounded-full' : ''}`}
    style={{ fontSize: 28, color: 'rgba(125,211,252,0.55)' }}
  >
    {label}
  </div>
);

// Числа поверх арта. В атласе у счётчика маны и стопок карт текст пока запечён
// в картинку, поэтому живое значение налезает на нарисованное — числа стоят по
// центру своих боксов, а точная посадка будет после переэкспорта регионов без
// текста (docs/battle-migration.md).
const Counter = ({ children, style }) => (
  <p
    className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-center"
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

const { fieldBackground, locationFrame, inventoryBg, mergeButton, manaCounter, buttonRed } = BATTLE_LAYOUT;

const BattleScreen = ({ zIndex }) => {
  const view = useBattleView() ?? DEMO;
  const heroes = view.heroes ?? [];

  return (
    <ScreenStage zIndex={zIndex}>
      <StageBox {...fieldBackground} zIndex={10}>
        <Placeholder label="фон локации" />
      </StageBox>

      {FIELD_UNITS.map((unit, index) => (
        <StageBox key={unit.id} x={unit.x} y={unit.y} width={unit.size} height={unit.size} zIndex={15}>
          <Placeholder label={heroes[index]?.name ?? unit.id} round />
        </StageBox>
      ))}

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

      {Array.from({ length: ITEM_SLOTS.count }, (_, index) => (
        <StageBox
          key={`item-slot-${index}`}
          x={ITEM_SLOTS.x + index * ITEM_SLOTS.step}
          y={ITEM_SLOTS.y}
          width={ITEM_SLOTS.size}
          height={ITEM_SLOTS.size}
          zIndex={35}
        >
          <UiSprite name="item_slot">
            {view.items?.[index] && (
              <img
                src={view.items[index].iconUrl}
                alt=""
                draggable={false}
                className="absolute inset-0 h-full w-full object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
          </UiSprite>
        </StageBox>
      ))}

      <StageBox {...mergeButton} zIndex={35}>
        <UiSprite name="merge_button" />
      </StageBox>

      <StageBox {...manaCounter} zIndex={30}>
        <UiSprite name="mana_counter">
          <Counter style={{ left: 128, top: 128, fontSize: 64 }}>{view.mana}</Counter>
        </UiSprite>
      </StageBox>

      <StageBox {...buttonRed} zIndex={30}>
        <NineSlice name="button_red" width={buttonRed.width} height={buttonRed.height} />
      </StageBox>

      {CARD_DECKS.map((deck, index) => (
        <StageBox key={deck.id} x={deck.x} y={deck.y} width={deck.width} height={deck.height} zIndex={30}>
          <div style={{ width: deck.width, height: deck.height, transform: `rotate(${deck.rotate}deg)` }}>
            <UiSprite name="cards_deck">
              <Counter style={{ left: 62, top: 86, fontSize: 40 }}>
                {index === 0 ? view.drawCount : view.discardCount}
              </Counter>
            </UiSprite>
          </div>
        </StageBox>
      ))}

      {HERO_SLOTS.map((box, index) => {
        const hero = heroes[index];
        if (!hero) return null;
        return (
          <StageBox key={hero.id ?? `hero-slot-${box.x}`} {...box} zIndex={40}>
            <div style={{ opacity: hero.isDead ? 0.4 : 1, filter: hero.isDead ? 'grayscale(1)' : undefined }}>
              <HeroSlot heroName={hero.name} hp={hero.hp} maxHp={hero.maxHp}>
                {hero.card && <MagicCard {...hero.card} />}
              </HeroSlot>
            </div>
          </StageBox>
        );
      })}

      <a
        className="absolute bottom-2 left-3 text-[11px] text-slate-500 hover:text-slate-300"
        href={BATTLE_FIGMA.url}
        target="_blank"
        rel="noreferrer"
        style={{ zIndex: 100 }}
      >
        новый боевой экран · только чтение · макет {BATTLE_FIGMA.nodeId}
      </a>
    </ScreenStage>
  );
};

export default BattleScreen;
