// Модалка сна в таверне: тёмный готический сплеш в стиле экрана подготовки.
// Намеренно тупая (вопрос + две кнопки): вся логика отдыха живёт в handleRest
// у родителя — туда позже встанут диалоги, ресурсы и спавн юнитов.

const SleepModal = ({ onRest, onCancel }) => (
  <div
    className="fixed inset-0 flex items-center justify-center animate-in fade-in duration-300"
    style={{ zIndex: 9600 }}
  >
    {/* Тёмная подложка + виньетка — готика как на PrepScreen */}
    <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onCancel} />
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.85) 100%)' }}
    />

    <div className="relative flex flex-col items-center gap-8 px-16 py-12 bg-slate-950/90 border border-slate-700/70 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-300">
      <div className="text-5xl select-none" aria-hidden="true">🕯️</div>
      <h2 className="text-3xl font-black text-amber-400 uppercase italic tracking-tighter text-center drop-shadow-2xl">
        Желаете отдохнуть?
      </h2>
      <p className="text-slate-500 text-[11px] uppercase tracking-[0.35em] text-center -mt-4">
        Ночь в таверне · отряд восстановит силы
      </p>
      <div className="flex gap-4">
        <button
          onClick={onRest}
          className="px-10 py-4 bg-amber-600 hover:bg-amber-500 rounded-2xl font-black uppercase tracking-widest text-xs text-black transition-all shadow-[0_0_25px_rgba(245,158,11,0.4)] border border-amber-400 hover:scale-105 active:scale-95"
        >
          Отдохнуть
        </button>
        <button
          onClick={onCancel}
          className="px-10 py-4 bg-slate-800 hover:bg-slate-700 rounded-2xl font-black uppercase tracking-widest text-xs text-slate-300 transition-all border border-slate-600 hover:scale-105 active:scale-95"
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
);

export default SleepModal;
