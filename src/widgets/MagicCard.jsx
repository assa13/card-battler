import { useContext, useMemo } from 'react';
import NineSlice from '../ui/NineSlice';
import UiSprite from '../ui/UiSprite';
import RarityWaves from '../ui/RarityWaves';
import { CardTiltContext } from '../ui/cardTilt';
import { CARD_RARITIES, CARD_RARITY_GLOW } from '../cardRarity';

// Карточка умения. Геометрия — фрейм card_body (Figma 150:1667, файл
// zG9zihyiBTJFjR5dVta74Z), координаты сняты через get_metadata и оставлены в
// пикселях макета: внутри карточки всё абсолютно, поэтому размер фиксированный,
// а масштабируется она вместе со сценой 3200×1800.
//
// Тексты привязаны к центру своего бокса из Figma, а не к верхней кромке: Figma
// отдаёт координаты обрезанные по cap-height, и привязка за верх уехала бы на
// разницу метрик шрифта.
const CARD_SIZE = { width: 374, height: 434 };

const FONT = "'Greybeard', sans-serif";
const TEXT_COLOR = '#fffdcc';
const TEXT_SHADOW = '0px 4px 0px black';

// Иконка отъезжает против наклона слота и даёт глубину. На старом экране сдвиг
// был полградуса в пиксель при карточке в 208 px; здесь карточка в 1.8 раза
// шире, поэтому и ход иконки во столько же больше.
const ICON_PARALLAX = 0.9;

// Живой фон лежит глубже иконки, поэтому и ходит заметно меньше: одинаковый
// сдвиг у двух слоёв убил бы ощущение глубины.
const FIELD_PARALLAX = 0.35;

// Плоское поле внутри рамки icon_bg — единственное место, где живёт фон.
// Толщина рамки снята с атласа промером до однородной заливки (#211d1c): 11
// слева, 12 справа, 4 сверху, 10 снизу; взят лишний пиксель запаса, чтобы фон
// не наползал на кромку в углах, где рисунок рамки толще.
const ICON_FIELD = { left: 12, top: 5, width: 326, height: 198 };

/** Рисунок иконки занимает окно целиком — поля у него уже свои, из нарезки. */
const ICON_ART = 194.56;

/** Устойчивый разброс фазы фона по названию карты, в радианах. */
const namePhase = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return (hash / 997) * Math.PI * 2;
};

const MagicCard = ({
  name = 'Card_name',
  description = '',
  icon = null,
  iconUrl = null,
  cost = null,
  rarity = 'COMMON',
  animated = true,
  className = '',
}) => {
  const rarityLabel = CARD_RARITIES[rarity]?.name ?? rarity;
  const tilt = useContext(CardTiltContext);
  const iconShift = `translate3d(${tilt.y * ICON_PARALLAX}px, ${-tilt.x * ICON_PARALLAX}px, 0)`;
  const waveColor = CARD_RARITY_GLOW[rarity] ?? CARD_RARITY_GLOW.COMMON;
  // Фаза фона считается от названия: у трёх карт в руке она разная, но у одной
  // и той же карты постоянная — иначе фон дёргался бы на каждой перерисовке.
  const wavePhase = useMemo(() => namePhase(name), [name]);

  return (
    <div
      className={`relative ${className}`}
      style={{ ...CARD_SIZE, fontFamily: FONT }}
      data-widget="magic-card"
    >
      <NineSlice name="card_bg" width={373} height={434} style={{ position: 'absolute', left: 0, top: 0 }} />

      <p
        className="absolute -translate-y-1/2 whitespace-nowrap"
        style={{ left: 34, top: 34, fontSize: 28, fontWeight: 700, color: TEXT_COLOR, textShadow: TEXT_SHADOW }}
      >
        {name}
      </p>

      <NineSlice name="icon_bg" width={350} height={214} style={{ position: 'absolute', left: 12, top: 62 }}>
        <RarityWaves
          animated={animated}
          color={waveColor}
          width={ICON_FIELD.width}
          height={ICON_FIELD.height}
          shiftX={tilt.y * FIELD_PARALLAX}
          shiftY={-tilt.x * FIELD_PARALLAX}
          seed={wavePhase}
          style={{ left: ICON_FIELD.left, top: ICON_FIELD.top }}
        />

        {/* Окно иконки поднято на 10 px против макета — по решению дизайна.
            Поднимается именно окно вместе с обрезкой, иначе у иконки срезало бы
            верхушку. */}
        <div
          className="absolute flex items-center justify-center overflow-hidden"
          style={{ left: 78.16, top: -0.28, width: 194.56, height: 194.56 }}
          data-slot="card-icon"
        >
          {/* Параллакс без transition: сдвиг обязан идти кадр в кадр с наклоном,
              иначе иконка тянется за карточкой с задержкой. */}
          <div className="flex items-center justify-center" style={{ transform: iconShift, transition: 'none' }}>
            {iconUrl
              ? (
                <img
                  src={iconUrl}
                  alt=""
                  draggable={false}
                  className="block select-none object-contain"
                  style={{ width: ICON_ART, height: ICON_ART, filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.5))' }}
                />
              )
              : typeof icon === 'string'
                ? <span style={{ fontSize: 120, lineHeight: 1, filter: 'drop-shadow(0 4px 0 rgba(0,0,0,0.6))' }}>{icon}</span>
                : icon}
          </div>
        </div>

        <div className="absolute" style={{ left: 93.5, top: 181, width: 162, height: 50 }}>
          <UiSprite name="card_name_label" style={{ position: 'absolute', left: -1, top: 0 }} />
          <p
            className="absolute inset-0 flex items-center justify-center overflow-hidden whitespace-nowrap"
            style={{ fontSize: 22, fontWeight: 700, color: TEXT_COLOR }}
          >
            {rarityLabel}
          </p>
        </div>
      </NineSlice>

      <p
        className="absolute -translate-y-1/2 text-center"
        style={{
          left: 42,
          top: 354,
          width: 288,
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 'normal',
          color: TEXT_COLOR,
          textShadow: TEXT_SHADOW,
          wordBreak: 'break-word',
        }}
      >
        {description}
      </p>

      {cost != null && (
        <UiSprite name="PB_mana" style={{ position: 'absolute', left: 303, top: -2 }}>
          <p
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
            style={{ width: 40, fontSize: 36, fontWeight: 700, color: TEXT_COLOR, textShadow: TEXT_SHADOW }}
          >
            {cost}
          </p>
        </UiSprite>
      )}
    </div>
  );
};

export default MagicCard;
