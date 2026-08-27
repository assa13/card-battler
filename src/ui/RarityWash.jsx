/**
 * Редкость предмета — мягкой заливкой под иконкой, а не рамкой: рамку гнезда
 * рисует атлас, вторая спорила бы с ней. Цвет приходит готовым (`rarityColor` в
 * снимке боя), таблицу редкостей виджеты не знают.
 *
 * Кладётся внутрь гнезда до иконки: слой абсолютный, порядок в разметке и решает,
 * что под чем.
 */
const RarityWash = ({ color, inset = 0, radius = 0, style }) => {
  if (!color) return null;
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: inset,
        top: inset,
        right: inset,
        bottom: inset,
        borderRadius: radius,
        background: `radial-gradient(circle at 50% 45%, ${color} 0%, transparent 72%)`,
        opacity: 0.34,
        // Гнездо артефакта шире своей иконки — там заливку задают боксом.
        ...style,
      }}
    />
  );
};

export default RarityWash;
