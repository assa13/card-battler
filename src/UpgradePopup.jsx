import SmallIconText from './ui/SmallIconText';
import GameIcon from './ui/GameIcon';
import './ui/kitControls.css';
const UpgradePopup = ({ card, level, cost, gold, onConfirm, onClose }) => {
  if (!card) return null;
  const isMaxLevel = level >= 5;
  const canAfford = gold >= cost;

  return (
    <div className="fixed inset-0 z-[9600] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm" style={{ fontFamily: "'Greybeard', sans-serif", fontSize: '11px' }}>
      <div className="kit-panel w-full max-w-lg text-[18px]">
        <div className="mb-1 font-black uppercase tracking-[0.28em] text-amber-300">Улучшение карты</div>
        <h2 className="font-black uppercase text-white">{card.name}</h2>
        <div className="my-5 flex items-center justify-between gap-5">
          <div>
            <div className="uppercase tracking-widest text-slate-500">Уровень</div>
            <div className="font-black text-white">{level} <SmallIconText>{isMaxLevel ? '· Предел' : `→ ${level + 1}`}</SmallIconText></div>
          </div>
          <div className="text-right">
            <div className="uppercase tracking-widest text-slate-500">Сила карты</div>
            <div className="font-black text-amber-300"><SmallIconText>×</SmallIconText>{2 ** (level - 1)} <SmallIconText>{!isMaxLevel && `→ ×${2 ** level}`}</SmallIconText></div>
          </div>
        </div>
        {isMaxLevel ? (
          <div className="p-3 text-violet-200">
            Дальнейшее возвышение потребует ресурс «Осколок возвышения». Пока он недоступен.
          </div>
        ) : (
          <div className="p-3 text-slate-300">
            Стоимость: <span className="font-black text-yellow-300"><GameIcon name="coin" /> {cost}</span>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="kit-button">Отмена</button>
          <button
            type="button"
            disabled={isMaxLevel || !canAfford}
            onClick={onConfirm}
            className="kit-button kit-button-red"
          >
            Улучшить
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpgradePopup;
