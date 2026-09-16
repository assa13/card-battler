import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ITEM_RARITIES, sortItemsByRarity } from './itemSystem';

const PAGE_SIZE = 12;

const ItemIcon = ({ item }) => item ? (
  <img src={`./icons/${item.icon}`} alt={item.name} draggable={false} className="h-full w-full object-cover" />
) : <span className="text-lg text-slate-600">+</span>;

const EquipmentTooltip = ({ item, inventory, onSwap, onUnequip, onItemHover, onItemLeave, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(inventory.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const sortedInventory = useMemo(() => sortItemsByRarity(inventory), [inventory]);
  const slots = useMemo(() => {
    const visible = sortedInventory.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
    return [...visible, ...Array(Math.max(0, PAGE_SIZE - visible.length)).fill(null)];
  }, [sortedInventory, safePage]);

  return (
    <div className={`relative ${className}`} style={{ fontFamily: "'Greybeard', sans-serif", fontSize: '11px' }}>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        onMouseEnter={(event) => item && onItemHover?.(item, event)}
        onMouseLeave={() => onItemLeave?.()}
        className={`group relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg border-2 bg-slate-950/90 transition hover:brightness-125 ${item ? ITEM_RARITIES[item.rarity]?.border || 'border-slate-500' : 'border-dashed border-slate-600'}`}
        title="Сменить экипировку героя"
      >
        <ItemIcon item={item} />
      </button>

      {isOpen && createPortal(
        <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="relative flex flex-col items-center" onClick={(event) => event.stopPropagation()}>
            <p className="mb-6 font-black uppercase tracking-[0.3em] text-slate-300">Общак</p>
            <div className="grid grid-cols-4 gap-2">
            {slots.map((available, index) => (
              <button
                key={available?.uid || `empty-${index}`}
                type="button"
                disabled={!available}
                onClick={() => { if (available) onSwap?.(available.uid); setIsOpen(false); }}
                onMouseEnter={(event) => available && onItemHover?.(available, event)}
                onMouseLeave={() => onItemLeave?.()}
                className={`h-12 w-12 rounded-xl border-2 flex items-center justify-center overflow-hidden transition-all ${available ? `${ITEM_RARITIES[available.rarity]?.border || 'border-slate-500'} bg-slate-950 cursor-pointer hover:brightness-125` : 'border-slate-500 border-dashed bg-slate-950/60'}`}
              >
                {available ? <ItemIcon item={available} /> : <span className="text-slate-600 text-2xl font-black">+</span>}
              </button>
            ))}
            </div>
            <div className="mt-4 flex items-center gap-4 text-slate-300">
              <button type="button" disabled={safePage <= 0} onClick={() => setPage(value => Math.max(0, value - 1))} className="disabled:opacity-25">◀</button>
              <span>{String(safePage + 1)} / {String(pageCount)}</span>
              <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} className="disabled:opacity-25">▶</button>
            </div>
            {item && (
              <button type="button" onClick={() => { onUnequip?.(); setIsOpen(false); }} className="mt-4 rounded-lg border border-slate-500 bg-slate-800 px-4 py-2 text-xs font-black uppercase">
                Снять в общак
              </button>
            )}
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default EquipmentTooltip;
