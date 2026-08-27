// Единственный источник истины по ui_atlas — src/config/uiAtlas.json.
// Правится руками и коммитится; runtime-оверрайдов нет, игра читает только JSON.
import atlas from '../config/uiAtlas.json';

export const UI_ATLAS = atlas;

/** Режимы заполнения краёв/центра, которые реально умеет NineSlice. */
export const SUPPORTED_FILL_MODES = ['stretch'];

export const getSlice = (name) => UI_ATLAS.slices[name] ?? null;

/**
 * Регион под цельную отрисовку. Кроме спрайтов сюда попадают и 9-slice: рамку
 * иногда нужно не растянуть, а уменьшить целиком — тогда разрез только мешает,
 * потому что углы у него не сжимаются и налезают друг на друга.
 */
export const getSprite = (name) => UI_ATLAS.sprites[name] ?? UI_ATLAS.slices[name] ?? null;

/** Размер нерастягиваемой части: ниже него 9-slice рисовать нельзя. */
export const getMinSize = ({ borders }) => ({
  width: borders.left + borders.right,
  height: borders.top + borders.bottom,
});

/** Размер растягиваемого центра в пикселях атласа. */
export const getStretchCenter = ({ region, borders }) => ({
  width: region.width - borders.left - borders.right,
  height: region.height - borders.top - borders.bottom,
});

/**
 * Инварианты, которые нельзя поймать глазами: регион вылез за атлас, границы
 * не оставили центра, заявлен нереализованный режим заполнения. Возвращает
 * список проблем — пусто значит всё в порядке.
 */
export const validateAtlas = (source = UI_ATLAS) => {
  const problems = [];
  const checkRegion = (kind, name, region) => {
    if (region.x + region.width > source.width || region.y + region.height > source.height) {
      problems.push(`${kind} «${name}»: регион выходит за пределы атласа ${source.width}×${source.height}.`);
    }
  };

  for (const [name, slice] of Object.entries(source.slices)) {
    checkRegion('9-slice', name, slice.region);
    const center = getStretchCenter(slice);
    if (center.width <= 0 || center.height <= 0) {
      problems.push(`9-slice «${name}»: границы не оставили центра (${center.width}×${center.height}).`);
    }
    for (const mode of ['edgeMode', 'centerMode']) {
      if (!SUPPORTED_FILL_MODES.includes(slice[mode])) {
        problems.push(`9-slice «${name}»: ${mode}="${slice[mode]}" не реализован, будет нарисован как stretch.`);
      }
    }
    if (slice.innerFill) {
      const { x, y, width, height } = slice.innerFill;
      if (x + width > slice.region.width || y + height > slice.region.height) {
        problems.push(`9-slice «${name}»: innerFill выходит за границы региона.`);
      }
    }
  }

  for (const [name, sprite] of Object.entries(source.sprites)) {
    checkRegion('Спрайт', name, sprite.region);
  }

  return problems;
};

if (import.meta.env.DEV) {
  const problems = validateAtlas();
  if (problems.length) console.error(`ui_atlas: ${problems.length} проблем в конфиге\n${problems.join('\n')}`);
}
