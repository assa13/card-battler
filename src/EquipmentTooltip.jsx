import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

const RARITY_BORDER = {
  COMMON: 'border-slate-500',
  RARE: 'border-sky-400',
  EPIC: 'border-purple-500',
  LEGENDARY: 'border-amber-400',
};

const ItemIcon = ({ item }) => item ? (
  <img src={`./icons/${item.icon}`} alt={item.name} draggable={false} className="h-full w-full object-cover" />
) : <span className="text-lg text-slate-600">+</span>;

const EquipmentTooltip = ({ item, inventory, onSwap, onItemHover, onItemLeave, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const slots = useMemo(() => [...inventory.slice(0, 9), ...Array(Math.max(0, 9 - inventory.length)).fill(null)], [inventory]);

  return (
    <div className={`relative ${className}`} style={{ fontFamily: "'Greybeard', sans-serif", fontSize: '11px' }}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        onMouseEnter={(event) => item && onItemHover?.(item, event)}
        onMouseLeave={() => onItemLeave?.()}
        className={`group relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border-2 bg-slate-950/90 transition hover:brightness-125 ${item ? RARITY_BORDER[item.rarity] || 'border-slate-500' : 'border-dashed border-slate-600'}`}
        title="Сменить экипировку героя"
      >
        <ItemIcon item={item} />
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="relative flex flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <p className="mb-6 font-black uppercase tracking-[0.3em] text-slate-300">Общак</p>
            <div className="grid grid-cols-3 gap-2">
            {slots.map((available, index) => (
              <button
                key={available?.uid || `empty-${index}`}
                type="button"
                disabled={!available}
                onClick={() => { if (available) onSwap?.(available.uid); setIsOpen(false); }}
                onMouseEnter={(event) => available && onItemHover?.(available, event)}
                onMouseLeave={() => onItemLeave?.()}
                className={`h-12 w-12 rounded-xl border-2 flex items-center justify-center overflow-hidden transition-all ${available ? `${RARITY_BORDER[available.rarity] || 'border-slate-500'} bg-slate-950 cursor-pointer hover:brightness-125` : 'border-slate-500 border-dashed bg-slate-950/60'}`}
              >
                {available ? <ItemIcon item={available} /> : <span className="text-slate-600 text-2xl font-black">+</span>}
              </button>
            ))}
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default EquipmentTooltip;
