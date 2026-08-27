import NineSlice from '../ui/NineSlice';
import UiSprite from '../ui/UiSprite';
import RarityWash from '../ui/RarityWash';
import { getMinSize, getSlice } from '../ui/uiAtlas';
import { HERO_SLOT_ARTEFACT, HERO_SLOT_CARD_BODY, HERO_SLOT_SIZE } from './heroSlotLayout';

// Слот героя: рамка, шапка с именем и HP, полоса здоровья, гнездо под карточку
// и слот артефакта снизу. Геометрия — фрейм hero_slot (Figma 150:1665, файл
// zG9zihyiBTJFjR5dVta74Z), координаты сняты через get_metadata.
//
// Карточка приходит через children и ложится в card_body — ровно тот бокс,
// который в макете занимает MagicCard.
const SLOT_SIZE = HERO_SLOT_SIZE;
const CARD_BODY = HERO_SLOT_CARD_BODY;

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
  // Надетый артефакт и подсветка гнезда: item — что лежит внутри,
  // isDragActive — по инвентарю тащат предмет (гнёзда зовут к себе),
  // isDropTarget — тащат прямо над этим гнездом.
  artefact = null,
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
        <div
          className={`absolute transition-transform duration-150 ${artefact?.isDragActive && !artefact?.isDropTarget ? 'animate-pulse' : ''}`}
          style={{
            left: HERO_SLOT_ARTEFACT.left,
            top: HERO_SLOT_ARTEFACT.top,
            transform: artefact?.isDropTarget ? 'scale(1.08)' : undefined,
            transformOrigin: 'center',
            filter: artefact?.isDropTarget
              ? 'drop-shadow(0 0 18px rgba(251,191,36,1)) drop-shadow(0 0 40px rgba(251,191,36,0.7))'
              : artefact?.isDragActive
                ? 'drop-shadow(0 0 12px rgba(251,191,36,0.65))'
                : undefined,
          }}
        >
          <UiSprite
            name="artefact_slot"
            width={HERO_SLOT_ARTEFACT.width}
            height={HERO_SLOT_ARTEFACT.height}
          >
            {artefact?.item ? (
              <>
                <RarityWash
                  color={artefact.item.rarityColor}
                  style={{
                    left: 156,
                    top: 83.5,
                    right: 'auto',
                    bottom: 'auto',
                    width: 132,
                    height: 132,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: 16,
                  }}
                />
                <img
                  src={artefact.item.iconUrl}
                  alt=""
                  draggable={false}
                  className="absolute -translate-x-1/2 -translate-y-1/2 select-none object-contain"
                  style={{ left: 156, top: 83.5, width: 120, height: 120, imageRendering: 'pixelated' }}
                />
              </>
            ) : (
              <p
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: 156, top: 83.5, fontSize: 86.05, fontWeight: 500, lineHeight: 1, color: '#ffffff' }}
              >
                +
              </p>
            )}
          </UiSprite>
        </div>
      )}
    </div>
  );
};

export default HeroSlot;
