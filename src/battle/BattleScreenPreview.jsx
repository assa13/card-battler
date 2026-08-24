import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import BattleScreen from './BattleScreen';
import { BattleViewContext } from './battleView';

// Новый боевой экран поверх живой игры, по F9.
//
// Это одновременно и способ сверяться со старым экраном (одно состояние, два
// рендера, переключение на лету), и флаг отката: пока новый экран не наберёт
// паритет, играет старый, а этот только смотрит.
//
// Компонент грузится лениво и только в dev — в production-бандл ни он, ни
// экран, ни виджеты не попадают.
const TOGGLE_KEY = 'F9';

const BattleScreenPreview = ({ view }) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== TOGGLE_KEY) return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  // Портал в body обязателен: корень приложения в App.jsx несёт transform от
  // тряски экрана, а тот создаёт стековый контекст — изнутри него никакой
  // z-index не перекроет оверлеи, которые лежат снаружи.
  return createPortal(
    <BattleViewContext.Provider value={view}>
      {/* pointer-events отключены целиком: экран пока только читает состояние,
          а клики должны доставаться живому бою под ним. */}
      <div className="pointer-events-none">
        <BattleScreen zIndex={10100} />
        <div className="fixed left-1/2 top-3 z-[10101] -translate-x-1/2 rounded-lg border border-amber-500/50 bg-slate-950/90 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-amber-400">
          новый экран · только чтение · {TOGGLE_KEY} закрыть
        </div>
      </div>
    </BattleViewContext.Provider>,
    document.body,
  );
};

export default BattleScreenPreview;
