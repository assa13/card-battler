const labels = {
  base: 'База', boss: 'Босс', combat_hard: 'Сложный бой',
  combat_medium: 'Средний бой', combat_easy: 'Лёгкий бой', event: 'Событие',
  exit: 'Выход', coin: 'Золото', ember: 'Угольки душ',
};

export default function GameIcon({ name, size = '1.5em', label, style, className = '' }) {
  if (!labels[name]) return null;
  return <img src={`${import.meta.env.BASE_URL}assets/ui/navigation/${name}.png`}
    alt={label ?? labels[name]} draggable={false} className={className}
    style={{ display: 'inline-block', width: size, height: size, objectFit: 'contain',
      flexShrink: 0, verticalAlign: 'middle', imageRendering: 'pixelated', ...style }} />;
}
