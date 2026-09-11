const selectClass = 'w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-amber-500';
const buttonClass = 'rounded border px-3 py-2 text-xs font-black uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-40';

const CombatArenaControls = ({
  bosses,
  cardsByHero,
  bossName,
  cardId,
  enemyCount,
  wormAttack,
  busy,
  onBossChange,
  onCardChange,
  onEnemyCountChange,
  onWormAttackChange,
  onRunCard,
  onRunBoss,
  onReset,
  onExit,
}) => (
  <aside className="fixed left-4 top-4 z-[9800] w-80 rounded-xl border border-slate-700 bg-slate-950/95 p-4 text-slate-200 shadow-2xl backdrop-blur">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h1 className="text-sm font-black uppercase tracking-widest text-amber-400">Тестовая арена</h1>
        <p className="mt-1 text-[10px] text-slate-500">Реальный бой · холст 3200×1800</p>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-500 hover:text-white"
      >
        Назад
      </button>
    </div>

    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Босс</span>
        <select className={selectClass} value={bossName} onChange={(event) => onBossChange(event.target.value)} disabled={busy}>
          {bosses.map((boss) => <option key={boss.name} value={boss.name}>{boss.name}</option>)}
        </select>
      </label>

      {bossName === 'Червь' && (
        <div>
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Атака Червя</span>
          <div className="grid grid-cols-2 gap-1">
            {[
              { id: 'bite', label: 'Attack1 · укусы' },
              { id: 'sweep', label: 'Attak2 · проход' },
            ].map((attack) => (
              <button
                key={attack.id}
                type="button"
                disabled={busy}
                onClick={() => onWormAttackChange(attack.id)}
                className={`${buttonClass} ${
                  wormAttack === attack.id
                    ? 'border-red-400 bg-red-500/20 text-red-200'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
              >
                {attack.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Карта атаки</span>
        <select className={selectClass} value={cardId} onChange={(event) => onCardChange(event.target.value)} disabled={busy}>
          {cardsByHero.map((group) => (
            <optgroup key={group.heroId} label={group.heroName}>
              {group.cards.map((card) => (
                <option key={card.id} value={card.id}>{card.name} · {card.qte.mechanic}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Количество целей</span>
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3].map((count) => (
            <button
              key={count}
              type="button"
              disabled={busy}
              onClick={() => onEnemyCountChange(count)}
              className={`${buttonClass} ${
                enemyCount === count
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500'
              }`}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={onRunCard}
          className={`${buttonClass} border-violet-500 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25`}
        >
          Разыграть карту
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRunBoss}
          className={`${buttonClass} border-red-500 bg-red-500/15 text-red-200 hover:bg-red-500/25`}
        >
          Атака босса
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={onReset}
        className={`${buttonClass} w-full border-slate-600 text-slate-300 hover:bg-slate-800`}
      >
        Сбросить арену
      </button>

      <p className="text-[10px] leading-relaxed text-slate-500">
        Дополнительные цели нужны для ритм-стрима и табуна. Они оглушены и сами не атакуют.
        В обычном бою атаки Червя чередуются; здесь нужную можно выбрать вручную.
      </p>
    </div>
  </aside>
);

export default CombatArenaControls;
