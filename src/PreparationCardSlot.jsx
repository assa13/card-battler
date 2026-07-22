const RARITY_GLOW = { COMMON: '#64748b', RARE: '#0ea5e9', EPIC: '#9333ea', LEGENDARY: '#f59e0b' };

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
      <div className={`relative w-16 h-20 rounded-xl border-2 border-dashed border-slate-700 bg-slate-800/30 flex items-center justify-center ${className}`}>
        {children || (
          locked
            ? <span className="text-2xl">🔒</span>
            : <span className="text-slate-700 text-xl font-black">+</span>
        )}
      </div>
    );
  }

  const glow = RARITY_GLOW[card.rarity] || '#64748b';
  return (
    <div
      className={`relative group w-16 h-20 rounded-xl border-2 bg-slate-800 flex flex-col items-center justify-center gap-0.5 transition-transform duration-150 ${isNew ? 'animate-bounce' : ''} ${isHover ? 'scale-110 z-10' : ''} ${locked ? 'opacity-40 grayscale' : ''} ${className}`}
      style={{ borderColor: isHover ? '#ffffff' : glow, boxShadow: isNew || isHover ? `0 0 25px ${glow}` : `inset 0 0 12px ${glow}33` }}
    >
      {isNew && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 bg-amber-500 text-black text-[8px] font-black px-2 py-0.5 rounded-full uppercase whitespace-nowrap shadow-lg pointer-events-none">Новая</div>
      )}
      <span className="text-2xl drop-shadow-lg">{locked ? '🔒' : String(card.icon)}</span>
      <span className="text-[9px] font-black uppercase" style={{ color: glow }}>ур.{String(level)}</span>
      {children}
    </div>
  );
};

export default PreparationCardSlot;
