const UpgradePopup = ({ card, level, cost, gold, onConfirm, onClose }) => {
  if (!card) return null;
  const isMaxLevel = level >= 5;
  const canAfford = gold >= cost;

  return (
    <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm" style={{ fontFamily: "'Greybeard', sans-serif", fontSize: '11px' }}>
      <div className="w-full max-w-md rounded-[28px] border border-amber-500/50 bg-slate-950 p-6 shadow-[0_0_60px_rgba(245,158,11,0.2)]">
        <div className="mb-1 font-black uppercase tracking-[0.28em] text-amber-300">Улучшение карты</div>
        <h2 className="font-black uppercase text-white">{card.name}</h2>
        <div className="my-5 flex items-center justify-between rounded-2xl border border-slate-700 bg-black/40 p-4">
          <div>
            <div className="uppercase tracking-widest text-slate-500">Уровень</div>
            <div className="font-black text-white">{level} {isMaxLevel ? '· Предел' : `→ ${level + 1}`}</div>
          </div>
          <div className="text-right">
            <div className="uppercase tracking-widest text-slate-500">Сила карты</div>
            <div className="font-black text-amber-300">×{2 ** (level - 1)} {!isMaxLevel && `→ ×${2 ** level}`}</div>
          </div>
        </div>
        {isMaxLevel ? (
          <div className="rounded-xl border border-violet-500/40 bg-violet-950/30 p-3 text-violet-200">
            Дальнейшее возвышение потребует ресурс «Осколок возвышения». Пока он недоступен.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 text-slate-300">
            Стоимость: <span className="font-black text-yellow-300">{cost} золота</span>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-600 px-4 py-2 font-black uppercase text-slate-300 hover:bg-slate-800">Отмена</button>
          <button
            type="button"
            disabled={isMaxLevel || !canAfford}
            onClick={onConfirm}
            className="rounded-xl bg-amber-500 px-4 py-2 font-black uppercase text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
          >
            Улучшить
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePopup;
