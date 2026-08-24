import { useEffect, useState } from 'react';
import NineSlice from '../ui/NineSlice';
import UiSprite from '../ui/UiSprite';
import { UI_ATLAS, getMinSize, getStretchCenter, validateAtlas } from '../ui/uiAtlas';
import { CHECKER } from './backgrounds';

// Ключ выбора: «slices:card_bg» или «sprites:PB_mana».
const parseKey = (key) => {
  const [kind, name] = key.split(':');
  return { kind, name, element: UI_ATLAS[kind][name] };
};

const figmaNodeUrl = (nodeId) =>
  `https://www.figma.com/design/${UI_ATLAS.source.fileKey}/card-crawler?node-id=${nodeId.replace(':', '-')}`;

const listButtonCls = (active) =>
  `block w-full truncate rounded px-2 py-1 text-left text-xs ${
    active ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:bg-slate-800'
  }`;

export const AtlasList = ({ selected, onSelect }) => (
  <div className="space-y-4 overflow-y-auto p-2">
    {[
      ['9-slice', 'slices', UI_ATLAS.slices],
      ['Спрайты', 'sprites', UI_ATLAS.sprites],
    ].map(([title, kind, group]) => (
      <div key={kind}>
        <h2 className="mb-1 px-2 text-[10px] font-black uppercase tracking-widest text-slate-600">{title}</h2>
        {Object.entries(group).map(([name, element]) => {
          const key = `${kind}:${name}`;
          return (
            <button
              key={key}
              type="button"
              title={element.label}
              onClick={() => onSelect(key)}
              className={listButtonCls(selected === key)}
            >
              {name}
            </button>
          );
        })}
      </div>
    ))}
  </div>
);

// Атлас экспортирован без прозрачности — тот самый класс ошибки, который глазами
// на тёмном фоне не виден. Проверяем пиксели один раз при открытии вкладки.
const useAtlasAlpha = () => {
  const [state, setState] = useState('checking');

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: false });
      ctx.drawImage(image, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let transparent = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 255) transparent += 1;
      setState(transparent > 0 ? 'ok' : 'opaque');
    };
    image.onerror = () => {
      if (!cancelled) setState('error');
    };
    image.src = UI_ATLAS.image;
    return () => { cancelled = true; };
  }, []);

  return state;
};

const ConfigChecks = () => {
  const problems = validateAtlas();
  const alpha = useAtlasAlpha();

  return (
    <div className="space-y-1 text-[11px]">
      {problems.length === 0
        ? <p className="text-emerald-400">Инварианты конфига в порядке.</p>
        : problems.map((problem) => <p key={problem} className="text-red-400">{problem}</p>)}
      {alpha === 'opaque' && (
        <p className="text-red-400">
          В атласе нет ни одного полупрозрачного пикселя — картинка выгружена с непрозрачным фоном,
          все рамки будут рисоваться прямоугольниками.
        </p>
      )}
      {alpha === 'error' && <p className="text-red-400">Атлас не загрузился: {UI_ATLAS.image}</p>}
      {alpha === 'ok' && <p className="text-emerald-400">Прозрачность в атласе есть.</p>}
    </div>
  );
};

const Specimen = ({ caption, children }) => (
  <figure className="space-y-1">
    <div className="inline-block rounded border border-slate-800" style={{ background: CHECKER }}>
      {children}
    </div>
    <figcaption className="text-[10px] text-slate-500">{caption}</figcaption>
  </figure>
);

const Field = ({ label, children }) => (
  <div>
    <dt className="text-[10px] font-black uppercase tracking-widest text-slate-600">{label}</dt>
    <dd className="text-[11px] text-slate-300">{children}</dd>
  </div>
);

export const AtlasViewer = ({ selected }) => {
  const { kind, name, element } = parseKey(selected);
  const isSlice = kind === 'slices';
  const { region } = element;
  const min = isSlice ? getMinSize(element) : null;
  const center = isSlice ? getStretchCenter(element) : null;

  // Обязательные проверки 9-slice: углы не должны деформироваться ни в
  // минимальном размере, ни при растяжении по каждой оси отдельно.
  const cases = isSlice
    ? [
      { caption: `минимум ${min.width}×${min.height}`, width: min.width, height: min.height },
      { caption: `натуральный ${region.width}×${region.height}`, width: region.width, height: region.height },
      { caption: `широкий ${min.width + 240}×${min.height}`, width: min.width + 240, height: min.height },
      { caption: `высокий ${min.width}×${min.height + 240}`, width: min.width, height: min.height + 240 },
    ]
    : [];

  return (
    <div className="space-y-6">
      <ConfigChecks />

      <div className="space-y-1 border-t border-slate-800 pt-4">
        <h1 className="text-sm font-black text-amber-300">{name}</h1>
        <p className="text-[11px] text-slate-500">
          {element.label} · {isSlice ? '9-slice' : 'цельный спрайт'}
        </p>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        <Field label="Регион">{region.x},{region.y} · {region.width}×{region.height}</Field>
        {isSlice && (
          <>
            <Field label="Границы">
              L{element.borders.left} R{element.borders.right} T{element.borders.top} B{element.borders.bottom}
            </Field>
            <Field label="Центр">{center.width}×{center.height}</Field>
            <Field label="Минимум">{min.width}×{min.height}</Field>
            <Field label="Режимы">края {element.edgeMode} · центр {element.centerMode}</Field>
          </>
        )}
      </dl>

      {element.notes && <p className="text-[11px] text-slate-500">{element.notes}</p>}

      {isSlice ? (
        <section className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Растяжение</h2>
          <div className="flex flex-wrap items-end gap-6">
            {cases.map((testCase) => (
              <Specimen key={testCase.caption} caption={testCase.caption}>
                <NineSlice name={name} width={testCase.width} height={testCase.height} />
              </Specimen>
            ))}
          </div>
        </section>
      ) : (
        <section className="space-y-2">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-600">Натуральный размер</h2>
          <Specimen caption={`${region.width}×${region.height}`}>
            <UiSprite name={name} />
          </Specimen>
        </section>
      )}

      <p className="text-[11px] text-slate-600">
        Координаты правятся руками в src/config/uiAtlas.json ·{' '}
        <a className="underline hover:text-amber-400" href={figmaNodeUrl(UI_ATLAS.source.nodeId)} target="_blank" rel="noreferrer">
          атлас в Figma
        </a>
      </p>
    </div>
  );
};
