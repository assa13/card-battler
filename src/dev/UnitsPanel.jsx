import { useState } from 'react';
import SpineUnit from '../units/SpineUnit';
import { SPINE_UNITS } from '../units/spineUnits';
import { CHECKER, GAME_DARK } from './backgrounds';

const UNITS = Object.values(SPINE_UNITS);

const listButtonCls = (active) =>
  `block w-full truncate rounded px-2 py-1 text-left text-xs ${
    active ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:bg-slate-800'
  }`;

export const UnitList = ({ selected, onSelect }) => (
  <div className="space-y-1 overflow-y-auto p-2">
    <h2 className="mb-1 px-2 text-[10px] font-black uppercase tracking-widest text-slate-600">Spine-юниты</h2>
    {UNITS.map((unit) => (
      <button
        key={unit.id}
        type="button"
        onClick={() => onSelect(unit.id)}
        className={listButtonCls(selected === unit.id)}
      >
        {unit.name}
      </button>
    ))}
  </div>
);

const BACKGROUNDS = [
  { id: 'checker', label: 'Шахматка', value: CHECKER },
  { id: 'game', label: 'Фон сцены', value: GAME_DARK },
];

const UnitViewerContent = ({ unit }) => {
  const [animations, setAnimations] = useState([]);
  const [animation, setAnimation] = useState(unit?.defaultAnimation || '');
  const [backgroundId, setBackgroundId] = useState('game');
  const background = BACKGROUNDS.find((item) => item.id === backgroundId)?.value;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-sm font-black text-amber-300">{unit.name}</h1>
          <p className="text-[11px] text-slate-500">
            Spine 3.8 · {unit.retroFps} FPS · движение: {unit.movementBone}
          </p>
        </div>

        <div className="ml-auto flex gap-1 rounded bg-slate-900 p-0.5">
          {BACKGROUNDS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setBackgroundId(item.id)}
              className={`rounded px-2 py-1 text-[10px] font-bold ${
                backgroundId === item.id ? 'bg-amber-500 text-black' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {animations.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {animations.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setAnimation(name)}
              className={`rounded border px-3 py-1.5 text-xs font-bold ${
                animation === name
                  ? 'border-amber-400 bg-amber-500/20 text-amber-300'
                  : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <div
        className="relative h-[620px] min-h-[420px] overflow-hidden rounded border border-slate-800"
        style={{ background }}
      >
        <SpineUnit
          unitId={unit.id}
          animation={animation}
          retroFps={unit.retroFps}
          animationMixMs={unit.animationMixMs}
          showError
          onAnimationsChange={(names) => {
            setAnimations(names);
            if (!names.includes(animation)) setAnimation(unit.defaultAnimation || names[0] || '');
          }}
        />
      </div>

      {animations.length === 1 && (
        <p className="text-[11px] text-slate-500">Анимация: {animations[0]}</p>
      )}
    </div>
  );
};

export const UnitViewer = ({ selected }) => {
  const unit = SPINE_UNITS[selected] || UNITS[0];
  if (!unit) return <p className="text-sm text-slate-500">Spine-юниты пока не добавлены.</p>;
  return <UnitViewerContent key={unit.id} unit={unit} />;
};
