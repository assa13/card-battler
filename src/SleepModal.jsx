// Модалка сна в таверне: тёмный готический сплеш в стиле экрана подготовки.
// Намеренно тупая (вопрос + три кнопки): вся логика ночи живёт в
// TavernHubScreen — модалка лишь показывает выбор и гасит «Спать до утра»,
// когда этой ночью ждёт обязательный гость.

const SleepButton = ({ onClick, disabled, title, className, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all border
                ${disabled
                  ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
                  : `${className} hover:scale-105 active:scale-95`}`}
  >
    {children}
  </button>
);

const SleepModal = ({ onSleep, onListen, onCancel, sleepDisabled = false, sleepHint = '' }) => (
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
        Ночь опускается на таверну
      </h2>
      <p className="text-slate-500 text-[11px] uppercase tracking-[0.35em] text-center -mt-4">
        Отряд восстановит силы · но кто-то может прийти
      </p>
      <div className="flex gap-4">
        <SleepButton
          onClick={onSleep}
          disabled={sleepDisabled}
          title={sleepDisabled ? sleepHint : 'Проспать ночь до рассвета'}
          className="bg-amber-600 hover:bg-amber-500 text-black border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.4)]"
        >
          Спать до утра
        </SleepButton>
        <SleepButton
          onClick={onListen}
          title="Дождаться ночи и встретить того, кто придёт"
          className="bg-indigo-800 hover:bg-indigo-700 text-indigo-100 border-indigo-500/70 shadow-[0_0_25px_rgba(99,102,241,0.35)]"
        >
          Прислушаться к ночи
        </SleepButton>
        <SleepButton
          onClick={onCancel}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600"
        >
          Отмена
        </SleepButton>
      </div>
      {sleepDisabled && sleepHint && (
        <p className="text-red-300/80 text-[11px] uppercase tracking-[0.25em] text-center -mt-4">
          {sleepHint}
        </p>
      )}
    </div>
  </div>
);

export default SleepModal;
