import { useMemo, useState } from 'react';
import AtlasSprite from './AtlasSprite';
import {
  EMBER_JUNK_THRESHOLD,
  ITEM_RARITIES,
  RARITY_TINT,
  getItemBuyPrice,
  getItemIconUrl,
  getItemSellPrice,
  sortItemsByRarity,
  sumJunkPoints,
} from './itemSystem';

const ItemIcon = ({ item }) => {
  if (!item) return null;
  const tint = item.tinted ? RARITY_TINT[item.rarity] : null;
  return (
    <div className="relative h-full w-full">
      <img src={getItemIconUrl(item.icon)} alt={item.name || ''} className="h-full w-full object-cover" draggable={false} />
      {tint && (
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: tint, opacity: 0.5 }} />
      )}
    </div>
  );
};

const PAGE_SIZE = 35;
const BARTENDER_SPRITE = {
  url: './assets/tavern/barman.webp',
  cols: 4,
  rows: 4,
  frameCount: 16,
  fps: 4,
};

const ItemCell = ({ item, selected, onClick, onHover, onLeave }) => {
  const rarity = ITEM_RARITIES[item?.rarity];
  return (
    <button
      type="button"
      disabled={!item}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`relative flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-xl border-2 bg-slate-900 transition ${
        selected ? 'scale-105 brightness-150' : 'hover:brightness-125'
      } ${item ? rarity?.border || 'border-slate-600' : 'border-dashed border-slate-700'}`}
      style={item ? { boxShadow: selected ? `0 0 18px ${rarity?.color || '#fff'}` : undefined } : undefined}
    >
      {item && <ItemIcon item={item} />}
    </button>
  );
};

export default function ShopScreen({
  stock,
  inventory,
  gold,
  soulEmbers,
  soulProgress,
  onBuy,
  onSell,
  onConvert,
  onClose,
  renderItemTooltip,
}) {
  const [tab, setTab] = useState('buy');
  const [page, setPage] = useState(0);
  const [selectedUid, setSelectedUid] = useState(null);
  const [cauldronUids, setCauldronUids] = useState([]);
  const [hovered, setHovered] = useState(null);

  const sortedStock = useMemo(() => sortItemsByRarity(stock), [stock]);
  const sortedInventory = useMemo(() => sortItemsByRarity(inventory), [inventory]);
  const source = tab === 'buy' ? sortedStock : sortedInventory;
  const pageCount = Math.max(1, Math.ceil(source.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = source.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const slots = [...visible, ...Array(Math.max(0, PAGE_SIZE - visible.length)).fill(null)];
  const selectedItem = source.find(item => item.uid === selectedUid) || null;
  const cauldronItems = useMemo(
    () => inventory.filter(item => cauldronUids.includes(item.uid)),
    [inventory, cauldronUids],
  );
  const cauldronPoints = sumJunkPoints(cauldronItems);
  const totalProgress = soulProgress + cauldronPoints;
  const canConvert = cauldronItems.length > 0 && totalProgress >= EMBER_JUNK_THRESHOLD;

  const switchTab = (next) => {
    setTab(next);
    setPage(0);
    setSelectedUid(null);
    setHovered(null);
  };
  const toggleCauldron = (uid) => {
    setCauldronUids(previous => previous.includes(uid)
      ? previous.filter(entry => entry !== uid)
      : [...previous, uid]);
  };
  const showTooltip = (item, event) => {
    if (!item) return;
    setHovered({ item, x: event.clientX, y: event.clientY });
  };

  return (
    <div className="fixed inset-0 z-[9450] bg-black" onPointerDown={(event) => event.stopPropagation()}>
      <div className="pointer-events-none absolute bottom-0 left-0 h-full w-[60%] overflow-hidden">
        <div className="absolute inset-0 origin-bottom" style={{ animation: 'shopBarkeepFocus 480ms cubic-bezier(0.16, 1, 0.3, 1) both' }}>
          <div className="absolute bottom-[25%] left-[43%] z-[1] h-[63%] -translate-x-1/2">
            <AtlasSprite sprite={BARTENDER_SPRITE} alt="Бармен" />
          </div>
          <img
            src="./assets/tavern/bar_counter.webp"
            alt=""
            draggable={false}
            className="absolute bottom-[5%] left-1/2 z-[2] w-[96%] -translate-x-1/2 select-none object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
        <style>{`
          @keyframes shopBarkeepFocus {
            from { opacity: 0; transform: scale(0.72) translateY(8%); }
            to { opacity: 1; transform: scale(1.18) translateY(0); }
          }
        `}</style>
      </div>
      <section
        className="absolute right-[6.8%] top-1/2 z-10 flex h-[78%] w-[38.6%] -translate-y-1/2 flex-col gap-4 rounded-[18px] border-[5px] border-[#d4a359] bg-[#0b0a09] p-7 text-[#e8dcd0] shadow-[14px_18px_20px_rgba(0,0,0,0.75)]"
        style={{ fontFamily: "'Greybeard', 'Geist Mono', monospace" }}
      >
        <header className="flex items-center justify-between">
          <h1 className="text-4xl font-black text-[#f1b82d]">Магазин</h1>
          <button type="button" onClick={onClose} className="text-2xl text-[#8c7a70] hover:text-white">✕</button>
        </header>

        <nav className="grid grid-cols-3 gap-2">
          {[
            ['buy', 'КУПИТЬ'],
            ['sell', 'ПРОДАТЬ'],
            ['cauldron', 'КОТЁЛ'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => switchTab(id)}
              className={`rounded-lg border-2 px-2 py-3 text-sm font-black ${
                tab === id ? 'border-[#d4a359] bg-[#120f0d] text-[#f1b82d]' : 'border-[#8c7a70] text-[#8c7a70] opacity-70'
              }`}
            >
              {tab === id ? `[ ${label} ]` : label}
            </button>
          ))}
        </nav>

        {tab === 'cauldron' && (
          <div className="relative flex h-32 items-center justify-center overflow-hidden rounded-xl border-2 border-[#805b2e] bg-gradient-to-b from-[#17100d] to-black">
            <div className="absolute bottom-[-42px] h-28 w-44 rounded-[50%] border-4 border-[#805b2e] bg-[#171311] shadow-[0_0_35px_rgba(139,92,246,0.45)]" />
            <div className="absolute bottom-7 text-5xl drop-shadow-[0_0_20px_rgba(96,165,250,0.9)]">♨</div>
            <div className="absolute left-5 right-5 top-4">
              <div className="mb-1 flex justify-between text-[10px] text-[#8c7a70]">
                <span>ОГОНЁК ДУШИ</span>
                <span>{String(totalProgress)} / {String(EMBER_JUNK_THRESHOLD)}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-[#805b2e] bg-black">
                <div className="h-full bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500" style={{ width: `${Math.min(100, totalProgress / EMBER_JUNK_THRESHOLD * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-7 content-start justify-items-center gap-2 overflow-hidden rounded-xl border-2 border-[#805b2e] bg-[#120f0d] p-3">
          {slots.map((item, index) => {
            const selected = tab === 'cauldron'
              ? Boolean(item && cauldronUids.includes(item.uid))
              : item?.uid === selectedUid;
            return (
              <ItemCell
                key={item?.uid || `empty-${index}`}
                item={item}
                selected={selected}
                onClick={() => {
                  if (!item) return;
                  if (tab === 'cauldron') toggleCauldron(item.uid);
                  else setSelectedUid(item.uid);
                }}
                onHover={(event) => showTooltip(item, event)}
                onLeave={() => setHovered(null)}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#8c7a70]">ВАШ БАЛАНС:</p>
            <p className="text-2xl font-black text-[#f1b82d]">🪙 {String(gold)} <span className="ml-3 text-sky-300">🔥 {String(soulEmbers)}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" disabled={safePage <= 0} onClick={() => setPage(value => Math.max(0, value - 1))} className="disabled:opacity-20">◀</button>
            <span className="text-sm">{String(safePage + 1)} / {String(pageCount)}</span>
            <button type="button" disabled={safePage >= pageCount - 1} onClick={() => setPage(value => Math.min(pageCount - 1, value + 1))} className="disabled:opacity-20">▶</button>
            {tab === 'buy' && (
              <button
                type="button"
                disabled={!selectedItem || gold < getItemBuyPrice(selectedItem)}
                onClick={() => { if (onBuy(selectedItem)) setSelectedUid(null); }}
                className="rounded-lg border-4 border-[#245339] bg-[#3b7a57] px-6 py-3 font-black disabled:opacity-35"
              >
                КУПИТЬ {selectedItem ? `· ${getItemBuyPrice(selectedItem)} 🪙` : ''}
              </button>
            )}
            {tab === 'sell' && (
              <button
                type="button"
                disabled={!selectedItem}
                onClick={() => { if (onSell(selectedItem.uid)) setSelectedUid(null); }}
                className="rounded-lg border-4 border-[#6b321f] bg-[#8c3f28] px-6 py-3 font-black disabled:opacity-35"
              >
                ПРОДАТЬ {selectedItem ? `· ${getItemSellPrice(selectedItem)} 🪙` : ''}
              </button>
            )}
            {tab === 'cauldron' && (
              <button
                type="button"
                disabled={!canConvert}
                onClick={() => {
                  if (onConvert(cauldronUids)) setCauldronUids([]);
                }}
                className="rounded-lg border-4 border-violet-900 bg-violet-700 px-6 py-3 font-black disabled:opacity-35"
              >
                ПРЕОБРАЗОВАТЬ
              </button>
            )}
          </div>
        </div>
      </section>
      {hovered && renderItemTooltip?.(hovered)}
    </div>
  );
}
