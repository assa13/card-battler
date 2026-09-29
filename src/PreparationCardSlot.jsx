import SmallIconText from './ui/SmallIconText';
import { CARD_RARITY_GLOW } from './cardRarity';
import { getCardIconUrl } from './config/cardIcons';
import './ui/kitControls.css';

const PreparationCardSlot = ({
  card,
  level = 1,
  locked = false,
  isNew = false,
  isHover = false,
  className = '',
  children,
}) => {
  if (!card) {
    return (
      <div className={`kit-card-slot relative w-16 h-20 flex items-center justify-center ${className}`}>
        {children || (
          locked
            ? <span className="text-2xl"><SmallIconText>🔒</SmallIconText></span>
            : <span className="text-slate-700 text-xl font-black"><SmallIconText>+</SmallIconText></span>
        )}
      </div>
    );
  }

  const glow = CARD_RARITY_GLOW[card.rarity] || '#64748b';
  return (
    <div
      className={`kit-card-slot relative group w-16 h-20 flex flex-col items-center justify-center gap-0.5 transition-transform duration-150 ${isNew ? 'animate-bounce' : ''} ${isHover ? 'scale-110 z-10' : ''} ${locked ? 'opacity-40 grayscale' : ''} ${className}`}
      style={{ outline: isHover ? '2px solid #e1c381' : undefined }}
    >
      {isNew && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap shadow-lg pointer-events-none">Новая</div>
      )}
      {locked ? <span className="text-xl"><SmallIconText>🔒</SmallIconText></span>
        : getCardIconUrl(card) ? <img src={getCardIconUrl(card)} alt="" draggable={false} className="w-10 h-10 object-contain" />
          : <span className="text-2xl"><SmallIconText>{String(card.icon)}</SmallIconText></span>}
      <span className="text-[9px] font-black uppercase" style={{ color: glow }}>ур.{String(level)}</span>
      {children}
    </div>
  );
};

export default PreparationCardSlot;
