import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  RARITY_WAVES_DEFAULTS,
  getRarityWavesParams,
  resetRarityWavesParams,
  setRarityWavesParams,
  subscribeRarityWavesParams,
} from '../ui/rarityWavesParams';

// Дев-панель фона карточек: F8. Только в dev-сборке — в проде модуль не
// монтируется и ничего не весит.
//
// Панель живёт вне ScreenStage, обычными экранными пикселями: её задача —
// крутилки, а не вёрстка по макету, и масштабироваться вместе со сценой ей
// незачем.
//
// Значения сохраняются в localStorage дев-сборки, чтобы пережить перезагрузку,
// но игра их не читает: кнопка внизу печатает JSON, подобранные числа
// переносятся в RARITY_WAVES_DEFAULTS руками.

const FIELDS = [
  { key: 'pixel', label: 'зерно, px макета', min: 2, max: 12, step: 1 },
  { key: 'fps', label: 'кадров в секунду', min: 4, max: 30, step: 1 },
  { key: 'opacity', label: 'прозрачность слоёв', min: 0, max: 1, step: 0.02 },
  { key: 'baseMix', label: 'яркость подложки', min: 0, max: 1, step: 0.02 },
  { key: 'shard', label: 'острота углов', min: 0, max: 3, step: 0.05 },
  { key: 'tempo', label: 'темп', min: 0, max: 3, step: 0.05 },
  { key: 'dither', label: 'дизер кромки', min: 0, max: 1, step: 0.01 },
  { key: 'alpha1', label: 'ступень 1', min: 0, max: 1, step: 0.01 },
  { key: 'alpha2', label: 'ступень 2', min: 0, max: 1, step: 0.01 },
  { key: 'alpha3', label: 'ступень 3', min: 0, max: 1, step: 0.01 },
  { key: 'edge1', label: 'порог 1 (тело)', min: 0.05, max: 4, step: 0.05 },
  { key: 'edge2', label: 'порог 2 (кромка)', min: 0.05, max: 4, step: 0.05 },
  { key: 'edge3', label: 'порог 3 (ядро)', min: 0.05, max: 6, step: 0.05 },
  { key: 'radiusScale', label: 'размер капель', min: 0.3, max: 2.5, step: 0.05 },
  { key: 'swayScale', label: 'размах качания', min: 0, max: 3, step: 0.05 },
  { key: 'blobCount', label: 'капель', min: 1, max: 5, step: 1 },
  { key: 'driftAngle', label: 'угол всплытия, °', min: 0, max: 360, step: 1 },
];

const RarityWavesPanel = () => {
  const params = useSyncExternalStore(subscribeRarityWavesParams, getRarityWavesParams, getRarityWavesParams);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'F8') return;
      event.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!open) return null;

  // Отличия от дефолта показываются явно: иначе после перезагрузки непонятно,
  // смотришь ты на подобранное или на исходное.
  const changed = Object.keys(RARITY_WAVES_DEFAULTS).filter((key) => params[key] !== RARITY_WAVES_DEFAULTS[key]);

  const copy = () => {
    const json = JSON.stringify(params, null, 2);
    navigator.clipboard?.writeText(json);
    console.log('RARITY_WAVES:', json);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className="fixed right-4 top-4 z-[999] w-72 rounded-lg border border-white/15 bg-black/85 p-3 text-xs text-slate-200 backdrop-blur"
      style={{ fontFamily: 'Greybeard, sans-serif' }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold text-amber-300">Фон карточек</span>
        <span className="text-[10px] text-slate-500">F8 — скрыть</span>
      </div>

      <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="flex justify-between">
              <span className={params[field.key] !== RARITY_WAVES_DEFAULTS[field.key] ? 'text-amber-300' : ''}>
                {field.label}
              </span>
              <span className="tabular-nums text-slate-400">{params[field.key]}</span>
            </span>
            <input
              type="range"
              className="w-full accent-amber-400"
              min={field.min}
              max={field.max}
              step={field.step}
              value={params[field.key]}
              onChange={(event) => setRarityWavesParams({ [field.key]: Number(event.target.value) })}
            />
          </label>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex-1 rounded border border-white/20 py-1 hover:bg-white/10"
        >
          {copied ? 'скопировано' : 'JSON в буфер'}
        </button>
        <button
          type="button"
          onClick={resetRarityWavesParams}
          className="rounded border border-white/20 px-2 py-1 hover:bg-white/10"
        >
          сброс
        </button>
      </div>

      <p className="mt-2 text-[10px] leading-tight text-slate-500">
        {changed.length ? `отличий от кода: ${changed.length}` : 'значения как в коде'}
      </p>
    </div>
  );
};

export default RarityWavesPanel;
