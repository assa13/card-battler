import NineSlice from '../ui/NineSlice';
import UiSprite from '../ui/UiSprite';
import { getMinSize, getSlice } from '../ui/uiAtlas';

// Слот героя: рамка, шапка с именем и HP, полоса здоровья, гнездо под карточку
// и слот артефакта снизу. Геометрия — фрейм hero_slot (Figma 150:1665, файл
// zG9zihyiBTJFjR5dVta74Z), координаты сняты через get_metadata.
//
// Карточка приходит через children и ложится в card_body — ровно тот бокс,
// который в макете занимает MagicCard.
const SLOT_SIZE = { width: 421, height: 573 };
const CARD_BODY = { left: 23, top: 108, width: 374, height: 434 };

const FONT = "'Greybeard', sans-serif";
const TEXT_COLOR = '#fffdcc';
const HP_COLOR = '#ff777a';
const TEXT_SHADOW = '0px 4px 0px black';

// Дорожка внутри PB_empty: её отступы не тянутся вместе с рамкой, поэтому это
// те же 18 и 17 пикселей, что и в атласе.
const BAR_WIDTH = 414;
const TRACK_LEFT = 18;
const TRACK_WIDTH = BAR_WIDTH - TRACK_LEFT - 17;

const HeroSlot = ({
  heroName = 'Warrior',
  hp = 0,
  maxHp = 0,
  showArtefactSlot = true,
  className = '',
  children,
}) => {
  const hpFraction = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  // Уже суммы своих границ 9-slice не рисуется, поэтому живой герой с почти
  // пустой полосой всё равно показывает минимальный огрызок заполнения.
  const fillMinWidth = getMinSize(getSlice('PB')).width;
  const fillWidth = hpFraction > 0 ? Math.max(fillMinWidth, Math.round(TRACK_WIDTH * hpFraction)) : 0;

  return (
    <div
      className={`relative ${className}`}
      style={{ ...SLOT_SIZE, fontFamily: FONT }}
      data-widget="hero-slot"
    >
      <NineSlice name="card_slot_bg" width={420} height={568} style={{ position: 'absolute', left: 0, top: 0 }} />

      <NineSlice
        name="Hero_slot_header_bg"
        width={BAR_WIDTH}
        height={71}
        style={{ position: 'absolute', left: 3, top: 0 }}
      >
        <p
          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap"
          style={{ left: 31, fontSize: 36, fontWeight: 700, color: TEXT_COLOR, textShadow: TEXT_SHADOW }}
        >
          {heroName}
        </p>
        <p
          className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-right"
          style={{ right: 24, fontSize: 32, fontWeight: 700, color: HP_COLOR, textShadow: TEXT_SHADOW }}
        >
          {hp}/{maxHp} HP
        </p>
      </NineSlice>

      <NineSlice name="PB_empty" width={BAR_WIDTH} height={38} style={{ position: 'absolute', left: 3, top: 70 }}>
        {fillWidth > 0 && (
          <NineSlice
            name="PB"
            width={fillWidth}
            height={16}
            style={{ position: 'absolute', left: TRACK_LEFT, top: 11 }}
          />
        )}
      </NineSlice>

      <div className="absolute" style={CARD_BODY}>
        {children}
      </div>

      {showArtefactSlot && (
        <UiSprite
          name="artefact_slot"
          width={311}
          height={163.01}
          style={{ position: 'absolute', left: 57, top: 544.99 }}
        >
          <p
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: 156, top: 83.5, fontSize: 86.05, fontWeight: 500, lineHeight: 1, color: '#ffffff' }}
          >
            +
          </p>
        </UiSprite>
      )}
    </div>
  );
};

export default HeroSlot;
