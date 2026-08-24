import { useState } from 'react';
import MagicCard from '../widgets/MagicCard';
import HeroSlot from '../widgets/HeroSlot';
import { UI_ATLAS } from '../ui/uiAtlas';
import { CHECKER, GAME_DARK } from './backgrounds';

// Виджет — собранный из элементов атласа кусок интерфейса. Здесь он всегда
// рисуется один к одному с макетом: масштабировать витрину нельзя, иначе
// пиксельная сетка врёт и проверка теряет смысл.
//
// Карты взяты из HERO_ABILITIES (src/App.jsx). Описаний в игровых данных нет,
// строки ниже подобраны так, чтобы проверить короткий, длинный и пустой текст.
const FIREBALL = { name: 'Огненный шар', icon: '☄️', cost: 3, rarity: 'RARE', description: 'Бьёт по всем врагам' };
const VOID = {
  name: 'Чёрная дыра',
  icon: '🌌',
  cost: 5,
  rarity: 'LEGENDARY',
  description: 'Очень длинное описание карточки, которое должно уместиться в три строки и не разъехать композицию',
};

const WIDGETS = [
  {
    id: 'HeroSlot',
    size: '421×573',
    figmaNodeId: '150:1665',
    note: 'Слот артефакта выступает на 135 px ниже рамки — это по макету, не переполнение.',
    overhangBottom: 150,
    variants: [
      {
        id: 'full',
        caption: 'полное HP, карточка внутри',
        render: () => (
          <HeroSlot heroName="Warrior" hp={999} maxHp={999}>
            <MagicCard {...FIREBALL} />
          </HeroSlot>
        ),
      },
      {
        id: 'low',
        caption: 'HP 1/35 — минимальный огрызок полосы',
        render: () => (
          <HeroSlot heroName="Rogue" hp={1} maxHp={35}>
            <MagicCard {...VOID} />
          </HeroSlot>
        ),
      },
      {
        id: 'dead',
        caption: 'HP 0/40 и длинное имя',
        render: () => <HeroSlot heroName="Некромант-заклинатель" hp={0} maxHp={40} />,
      },
      {
        id: 'no-artefact',
        caption: 'без слота артефакта',
        render: () => <HeroSlot heroName="Mage" hp={20} maxHp={35} showArtefactSlot={false} />,
      },
    ],
  },
  {
    id: 'MagicCard',
    size: '374×434',
    figmaNodeId: '150:1667',
    note: 'Размер фиксирован по макету: содержимое разложено абсолютно и не переверстывается.',
    overhangBottom: 0,
    variants: [
      { id: 'short', caption: 'короткое описание, стоимость 3', render: () => <MagicCard {...FIREBALL} /> },
      { id: 'long', caption: 'длинное описание, стоимость 5', render: () => <MagicCard {...VOID} /> },
      {
        id: 'empty',
        caption: 'пустое описание, стоимость 0',
        render: () => <MagicCard name="Кинжал" icon="🗡️" cost={0} rarity="COMMON" description="" />,
      },
      {
        id: 'no-cost',
        caption: 'без стоимости, редкость EPIC',
        render: () => <MagicCard name="Молот Тора" icon="🔨" rarity="EPIC" description="Оглушает цель" />,
      },
    ],
  },
];

const listButtonCls = (active) =>
  `block w-full truncate rounded px-2 py-1 text-left text-xs ${
    active ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:bg-slate-800'
  }`;

export const WidgetList = ({ selected, onSelect }) => (
  <div className="space-y-1 overflow-y-auto p-2">
    <h2 className="mb-1 px-2 text-[10px] font-black uppercase tracking-widest text-slate-600">Собранные виджеты</h2>
    {WIDGETS.map((widget) => (
      <button
        key={widget.id}
        type="button"
        onClick={() => onSelect(widget.id)}
        className={listButtonCls(selected === widget.id)}
      >
        {widget.id} <span className="text-slate-600">{widget.size}</span>
      </button>
    ))}
  </div>
);

const BACKGROUNDS = [
  { id: 'checker', label: 'Шахматка', value: CHECKER },
  { id: 'game', label: 'Фон сцены', value: GAME_DARK },
];

export const WidgetViewer = ({ selected }) => {
  const [backgroundId, setBackgroundId] = useState('checker');
  const widget = WIDGETS.find((item) => item.id === selected) ?? WIDGETS[0];
  const background = BACKGROUNDS.find((item) => item.id === backgroundId).value;
  const figmaUrl = `https://www.figma.com/design/${UI_ATLAS.source.fileKey}/card-crawler?node-id=${widget.figmaNodeId.replace(':', '-')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-sm font-black text-amber-300">{widget.id}</h1>
        <p className="text-[11px] text-slate-500">{widget.size} · масштаб 1:1</p>
        <a className="text-[11px] text-slate-500 underline hover:text-amber-400" href={figmaUrl} target="_blank" rel="noreferrer">
          фрейм в Figma
        </a>
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

      {widget.note && <p className="text-[11px] text-slate-500">{widget.note}</p>}

      <div className="flex flex-wrap items-start gap-8">
        {widget.variants.map((variant) => (
          <figure key={variant.id} className="space-y-2">
            <div
              className="inline-block rounded border border-slate-800 p-4"
              style={{ background, marginBottom: widget.overhangBottom }}
            >
              {variant.render()}
            </div>
            <figcaption className="text-[10px] text-slate-500">{variant.caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};
