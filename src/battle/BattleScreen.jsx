import ScreenStage from '../ScreenStage';
import StageBox from '../ui/StageBox';
import NineSlice from '../ui/NineSlice';
import UiSprite from '../ui/UiSprite';
import HeroSlot from '../widgets/HeroSlot';
import MagicCard from '../widgets/MagicCard';
import {
  BATTLE_FIGMA,
  BATTLE_LAYOUT,
  CARD_DECKS,
  DECOR,
  FIELD_UNITS,
  HERO_SLOTS,
  ITEM_SLOTS,
} from './battleLayout';

// Боевой экран на холсте 3200×1800. Пока каркас: элементы стоят по координатам
// макета, но к состоянию игры экран не подключён и данные ниже заглушечные.
// Открывается по хешу #battle и в production-бандл не попадает, старый бой в
// App.jsx работает как работал.
const PARTY = [
  {
    heroName: 'Warrior',
    hp: 34,
    maxHp: 40,
    card: { name: 'Удар щитом', description: 'Бьёт и ставит броню', cost: 2, rarity: 'COMMON', icon: '🛡️' },
  },
  {
    heroName: 'Rogue',
    hp: 21,
    maxHp: 28,
    card: { name: 'Кинжал', description: 'Два быстрых удара', cost: 1, rarity: 'RARE', icon: '🗡️' },
  },
  {
    heroName: 'Mage',
    hp: 18,
    maxHp: 24,
    card: { name: 'Огненный шар', description: 'Бьёт по всем врагам', cost: 3, rarity: 'EPIC', icon: '☄️' },
  },
];

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

const { fieldBackground, locationFrame, inventoryBg, mergeButton, manaCounter, buttonRed } = BATTLE_LAYOUT;

const BattleScreen = () => (
  <ScreenStage>
    <StageBox {...fieldBackground} zIndex={10}>
      <Placeholder label="фон локации" />
    </StageBox>

    {FIELD_UNITS.map((unit) => (
      <StageBox key={unit.id} x={unit.x} y={unit.y} width={unit.size} height={unit.size} zIndex={15}>
        <Placeholder label={unit.id} round />
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
        <UiSprite name="item_slot" />
      </StageBox>
    ))}

    <StageBox {...mergeButton} zIndex={35}>
      <UiSprite name="merge_button" />
    </StageBox>

    <StageBox {...manaCounter} zIndex={30}>
      <UiSprite name="mana_counter" />
    </StageBox>

    <StageBox {...buttonRed} zIndex={30}>
      <NineSlice name="button_red" width={buttonRed.width} height={buttonRed.height} />
    </StageBox>

    {CARD_DECKS.map((deck) => (
      <StageBox key={deck.id} x={deck.x} y={deck.y} width={deck.width} height={deck.height} zIndex={30}>
        <div style={{ width: deck.width, height: deck.height, transform: `rotate(${deck.rotate}deg)` }}>
          <UiSprite name="cards_deck" />
        </div>
      </StageBox>
    ))}

    {HERO_SLOTS.map((box, index) => {
      const hero = PARTY[index];
      return (
        <StageBox key={`hero-slot-${box.x}`} {...box} zIndex={40}>
          <HeroSlot heroName={hero.heroName} hp={hero.hp} maxHp={hero.maxHp}>
            <MagicCard {...hero.card} />
          </HeroSlot>
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
      каркас боевого экрана · координаты из макета {BATTLE_FIGMA.nodeId}
    </a>
  </ScreenStage>
);

export default BattleScreen;
