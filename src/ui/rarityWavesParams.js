// Настройки фона карточек, вынесенные из RarityWaves наружу, чтобы их можно было
// крутить живьём дев-панелью (src/dev/RarityWavesPanel.jsx, F8).
//
// Это не «редактор в игре»: правка живёт в localStorage дев-сборки, игра читает
// только DEFAULTS. Подобранные значения переносятся в код руками — панель для
// того и печатает JSON.

// Значения подобраны глазами на живом экране; здесь они лежат ровно в том виде,
// в каком были приняты.
export const RARITY_WAVES_DEFAULTS = Object.freeze({
  /** Сторона точки сетки в пикселях макета. Меньше — мельче зерно и дороже кадр. */
  pixel: 5,
  /** Кадров в секунду. Пиксельной картинке хватает немногого, но капля не должна прыгать через точку. */
  fps: 16,
  /** Прозрачность обоих слоёв разом. */
  opacity: 0.38,
  /** Во сколько раз притушена сплошная подложка относительно цвета редкости. */
  baseMix: 0.46,
  /** Скос метрики расстояния: 0 — круглые капли, больше — ромб с острыми углами. */
  shard: 0.6,
  /** Общий множитель темпа: всплытие и качание разом. */
  tempo: 3,
  /** Дизер на кромке, в единицах поля. Здесь он крупный: кромка нарочно рыхлая. */
  dither: 0.38,
  /**
   * Ступени заливки. Нулевая опущена: там видна только подложка.
   *
   * Вторая ступень при нынешних порогах не выпадает (см. ниже), так что фон
   * двухступенчатый: рыхлая кайма и плотное тело. Значение alpha2 оставлено
   * осмысленным на случай, если пороги переставят обратно по возрастанию.
   */
  alpha1: 0.52,
  alpha2: 0.54,
  alpha3: 1,
  /**
   * Пороги поля: тело капли, кромка, ядро слияния.
   *
   * Порядок нарушен намеренно — edge3 ниже edge2, поэтому всё, что перевалило
   * за 0.95, сразу уходит в верхнюю ступень, а средняя остаётся пустой. Так
   * картинка и принималась: капли почти без полутонов, две трети поля плотные.
   */
  edge1: 0.4,
  edge2: 1.35,
  edge3: 0.95,
  /** Множитель радиусов всех капель. */
  radiusScale: 1.55,
  /** Множитель размаха качания. */
  swayScale: 1,
  /** Сколько капель участвует, от 1 до 5. */
  blobCount: 5,
  /** Направление всплытия в градусах: 0 — вправо, 90 — вверх. */
  driftAngle: 225,
});

const STORAGE_KEY = 'dev.rarityWaves';
const isDev = Boolean(import.meta.env?.DEV);

const readOverrides = () => {
  if (!isDev || typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

let current = Object.freeze({ ...RARITY_WAVES_DEFAULTS, ...readOverrides() });
const listeners = new Set();

const publish = () => {
  if (isDev && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch {
      // Приватный режим и прочие отказы хранилища панель не должны ронять.
    }
  }
  listeners.forEach((listener) => listener());
};

export const getRarityWavesParams = () => current;

export const setRarityWavesParams = (patch) => {
  current = Object.freeze({ ...current, ...patch });
  publish();
};

export const resetRarityWavesParams = () => {
  current = Object.freeze({ ...RARITY_WAVES_DEFAULTS });
  publish();
};

export const subscribeRarityWavesParams = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
