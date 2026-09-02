import { useState } from 'react';
import { UI_ATLAS } from '../ui/uiAtlas';
import ArenaPanel from './ArenaPanel';
import { AtlasList, AtlasViewer } from './AtlasPanel';
import { UnitList, UnitViewer } from './UnitsPanel';
import { WidgetList, WidgetViewer } from './WidgetsPanel';

// Витрина UI Kit: слева вкладки и список, справа просмотр. Только чтение —
// конфиг атласа правится руками в src/config/uiAtlas.json.
// Открывается по хешу #uikit и только в dev-сборке.
const TABS = [
  { id: 'atlas', label: 'UI атлас' },
  { id: 'widgets', label: 'Виджеты' },
  { id: 'units', label: 'Юниты' },
  { id: 'arena', label: 'Арена' },
];

const FIRST_ATLAS_KEY = `slices:${Object.keys(UI_ATLAS.slices)[0]}`;

const UiKitGallery = () => {
  const [tab, setTab] = useState('atlas');
  const [atlasKey, setAtlasKey] = useState(FIRST_ATLAS_KEY);
  const [widgetId, setWidgetId] = useState('HeroSlot');
  const [unitId, setUnitId] = useState('worm');

  if (tab === 'arena') return <ArenaPanel onExit={() => setTab('units')} />;

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-200">
      <header className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-slate-800 px-4 py-3">
        <h1 className="text-sm font-black uppercase tracking-widest text-amber-400">UI Kit</h1>
        <p className="text-[11px] text-slate-500">
          {UI_ATLAS.image} · {UI_ATLAS.width}×{UI_ATLAS.height} · {UI_ATLAS.filtering}
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40">
          <div className="grid shrink-0 grid-cols-4 gap-1 border-b border-slate-800 p-2">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`rounded px-2 py-1.5 text-[11px] font-bold ${
                  tab === item.id ? 'bg-amber-500 text-black' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'atlas' && <AtlasList selected={atlasKey} onSelect={setAtlasKey} />}
          {tab === 'widgets' && <WidgetList selected={widgetId} onSelect={setWidgetId} />}
          {tab === 'units' && <UnitList selected={unitId} onSelect={setUnitId} />}
        </nav>

        <main className="min-w-0 flex-1 overflow-auto p-6">
          {tab === 'atlas' && <AtlasViewer selected={atlasKey} />}
          {tab === 'widgets' && <WidgetViewer selected={widgetId} />}
          {tab === 'units' && <UnitViewer selected={unitId} />}
        </main>
      </div>
    </div>
  );
};

export default UiKitGallery;
