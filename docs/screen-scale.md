# Система вёрстки и масштаба экранов

Единый источник истины по геометрии сцен, Figma → код и подключению экранов.
Роли:

- сцены и сущности: [`layout-designer-prompt.md`](./layout-designer-prompt.md);
- UI Kit, игровые интерфейсы и 9-slice:
  [`game-ui-implementer-prompt.md`](./game-ui-implementer-prompt.md).

---

## 1. Базовый логический холст

| Параметр | Значение |
|----------|----------|
| Ширина | **3200 px** |
| Высота | **1800 px** |
| Соотношение по умолчанию | **16∶9** (`BASE_ASPECT`) |
| Код | `src/screenScale.js`, `src/ScreenStage.jsx` |
| Figma | файл `xFklbUodUchgblPsUfsWPo`, страница **`claude_scaling`** |

### Фреймы Figma

| Фрейм | Node ID | Код |
|-------|---------|-----|
| 📐 Screen Template 3200×1800 | [3697:13550](https://www.figma.com/design/xFklbUodUchgblPsUfsWPo/Untitled?node-id=3697-13550) | Базовый темплейт новых экранов |
| 🍺 Tavern Layout 3200×1800 | [3700:13517](https://www.figma.com/design/xFklbUodUchgblPsUfsWPo/Untitled?node-id=3700-13517) | `TavernSceneConfig.js` |
| 🚪 Guest Encounter Layout 3200×1800 | [3700:13597](https://www.figma.com/design/xFklbUodUchgblPsUfsWPo/Untitled?node-id=3700-13597) | `NightEncounterScreen.jsx` |

> **Важно:** логические координаты сущностей всегда считаются от **3200×1800**, даже если контейнер сцены имеет другой `aspectRatio` (как у таверны). Проценты `left`/`top` — от **фактического** контейнера сцены, который при совпадении aspect с фоном равен логическому холсту.

---

## 2. Масштабирование в браузере

Контент вписывается в viewport, **приоритет — высота окна** (letterbox по бокам на ультрашироких; на узких — ограничение по ширине).

```
height = min(
  (100vh − 64px) × fill,
  (100vw − 64px) × fill / aspect
)
width  = height × aspect   // через CSS aspect-ratio
```

| Константа | Значение | Где |
|-----------|----------|-----|
| `SCREEN_PADDING_PX` | 32 | letterbox с каждой стороны |
| `STAGE_FILL` | 1 | дефолт — сцена на всю доступную высоту |
| `BASE_WIDTH` / `BASE_HEIGHT` | 3200 / 1800 | `screenScale.js` |

### Исключение: Таверна

| Параметр | Значение | Зачем |
|----------|----------|-------|
| `TAVERN_STAGE_RATIO` | **1024 / 529 ≈ 1.936** | натуральный aspect фона `bg_base.webp` |
| `fill` | **0.8203125** | визуальный скейл сцены (не трогает `scale` сущностей) |

```jsx
// TavernHubScreen.jsx
<ScreenStage fill={0.8203125} aspectRatio={TAVERN_STAGE_RATIO}>
```

Фон таверны: `object-cover` на весь контейнер — при совпадении aspect контейнера и фона **края не обрезаются**.

---

## 3. Figma → код (сущности сцены)

Для спрайтов и клик-зон в `TavernSceneConfig.js` и аналогах:

```
left%  = (left + width/2)  / 3200 × 100   → pos.left  (центр по X)
top%   = (top  + height/2) / 1800 × 100   → pos.top   (центр по Y)
scale  = height_px / 1800                 → entity.scale (доля высоты сцены)
aspect = width_px / height_px             → entity.aspect (если нужна фикс. ширина)
```

Хелперы: `figmaCx`, `figmaCy`, `figmaScale`, `figmaLeft`, `figmaTop` в `screenScale.js`.

**flipX:** в Figma обёртка `-scale-y-100 rotate-180` → `flipX: true` в конфиге.

**Hitbox** (доля bbox спрайта, не сцены): `{ left, top, width, height }` в % от контейнера сущности.

---

## 4. Декларативные сущности (`TavernSceneConfig.js`)

### Типы

| type | Визуал | Позиционирование |
|------|--------|------------------|
| `BG` | `<img object-cover>` на весь контейнер | `inset: 0` |
| `NPC` / `PROP` / `VISITOR` / `HERO_*` | спрайт или атлас | `height: scale×100%`, `translate(-50%,-50%)`, опц. `aspect` |
| `PORTAL` | невидимая клик-зона | `height: scale×100%`, `aspect`, `translate(-50%,-50%)` |

### z-index (ориентир)

| Диапазон | Слой |
|----------|------|
| 0 | фон (`bg_base`) |
| 10–20 | бармен, стойка |
| 18–25 | порталы (лестница, дверь), спрайты двери |
| 30–32 | активная тройка героев |
| 40–63 | массовка, столы |
| 180 | ночная тонировка (overlay) |
| 200+ | UI-бейджи, подписи действий |

Глубина — **только** поле `zIndex` у каждой сущности. DOM-слоёв нет.

### Якоря диалогов (`data-entity-id`)

Пузырь (`SpeechBubble`) якорится к DOM-узлу с `data-entity-id === anchorEntityId`.
На интерактивных сущностях id проставляется автоматически из `entity.id`.

| id (таверна) | Назначение |
|--------------|------------|
| `npc_bartender` | бармен |
| `hero_slot_0..2` | герои у стойки |
| `visitor_cloaked_center` и др. | посетители (линейные диалоги) |
| `door_night` / `door_day` | дверь (спрайт) |

| id (ночная встреча) | Назначение |
|---------------------|------------|
| `encounter_visitor` | проём окошка в двери |

---

## 5. Каталог ассетов таверны

| Файл | Размер (px) | Примечание |
|------|-------------|------------|
| `bg_base.webp` | **1024×529** | задаёт `TAVERN_STAGE_RATIO` |
| `door.webp` | 162×750 | ночь, `aspect: 162/750` |
| `door_open.webp` | 296×750 | день |
| `barman.webp` | атлас **4×4**, кадр ~320×320 | idle 16 кадров, fps=4 |
| `visitor0.webp`, `visitor1.webp` | атлас 4×4 | массовка |
| `bar_counter.webp` | — | scale ≈ 0.756 |
| `table_round.webp` | 320×320 | `aspect: 1` у правого края |

Боевые атласы героев в таверне: `public/chars/*_atlas.webp` (4×4, 16 кадров).

Экспорт: **WebP**, `imageRendering: pixelated` в CSS.

---

## 6. Таблица сущностей таверны (актуальные координаты)

Источник: `src/TavernSceneConfig.js` (пересчитано под холст 3200×1800 / aspect фона).

| id | type | left | top | scale | z | flipX | visibleWhen |
|----|------|------|-----|-------|---|-------|-------------|
| `bg_base` | BG | 50% | 50% | — | 0 | — | always |
| `door_night` | PROP | 95.74% | 59.44% | 0.595 | 24 | — | NIGHT |
| `door_day` | PROP | 85.47% | 59.44% | 0.595 | 24 | — | DAY |
| `npc_bartender` | NPC | 42.61% | 35.57% | 0.400 | 10 | — | always |
| `bar_counter` | PROP | 48.28% | 27.86% | 0.756 | 20 | — | always |
| `hero_slot_0` | HERO | 34.68% | 51.55% | 0.400 | 30 | ✓ | always |
| `hero_slot_1` | HERO | 50.20% | 51.19% | 0.400 | 31 | ✓ | always |
| `hero_slot_2` | HERO | 65.13% | 51.55% | 0.400 | 32 | — | always |
| `visitor_cloaked_back_right` | VISITOR | 90.19% | 68.76%+20px | 0.444 | 40 | ✓ | DAY |
| `table_round_right` | PROP | 82.49% | 71.06%+20px | 0.400 | 50 | — | DAY |
| `table_round_center` | PROP | 51.53% | 73.22%+20px | 0.400 | 51 | — | DAY |
| `table_round_left` | PROP | 20.88% | 67.46%+20px | 0.400 | 52 | — | DAY |
| `visitor_walker_a_center` | VISITOR | 59.73% | 73.79%+20px | 0.444 | 60 | ✓ | DAY |
| `visitor_drunk_right` | VISITOR | 73.57% | 71.78%+20px | 0.444 | 61 | — | DAY |
| `visitor_cloaked_center` | VISITOR | 41.05% | 74.51%+20px | 0.444 | 62 | — | DAY |
| `visitor_walker_a_left` | VISITOR | 10.79% | 69.98%+20px | 0.444 | 63 | ✓ | DAY |
| `stairs_to_rest` | PORTAL | 7.5% | 42% | 0.55 | 18 | — | always |
| `door_to_map` | PORTAL | 92.5% | 52% | 0.60 | 25 | — | always |

Ночью (`NIGHT_KNOCKING`): скрыты `VISITOR` и `HERO_ACTIVE`; остаются фон, бармен, мебель, порталы, спрайт двери.

---

## 7. Экран ночной встречи (`NightEncounterScreen.jsx`)

Компоновка — Figma фрейм `dialogue` [3721:13570](https://www.figma.com/design/xFklbUodUchgblPsUfsWPo/Untitled?node-id=3721-13570) (холст 3200×1800). Координаты взяты **литерально** из экспортированного кода фрейма (`get_design_context`), без транформ кроме центрирующих translate. Экран использует `ScreenStage` (BASE_ASPECT 16∶9), диалог — вне сцены как fixed-оверлей (`DialogueScriptOverlay`, `variant="plate"`).

| Элемент | Figma (xy / wh) | В коде |
|---------|-----------------|--------|
| Контейнер | `fixed inset-0`, z **9500** | `<div fixed>` вокруг `ScreenStage` |
| Сцена | 3200×1800, чёрный фон | `<ScreenStage backgroundColor="#000">` |
| Гость (`LAYER / monster behind`) 1813×1813 | cx=1760.5, cy=860.5 | `left 55.02%`, `top 47.81%`, `height 100.72%`, `flipX`, **zIndex 0** |
| Арт окна `door_window.webp` 2048×2048 | cx=1600, cy=808 | `left 50%`, `top 44.89%`, `height 113.78%`, **zIndex 1** |
| Тень снизу `shadow` | 0,1055 / 3200×745 | `top 58.61%`, `height 41.39%`, gradient 11.831%→60.845%, **zIndex 2** |
| Виньетка | — | `radial-gradient`, прозрачный центр 35% (вне `ScreenStage`) |
| `text_block` 2568×192 @ (331,1259) | центр X=1615, top=1259 (без translateY) | `DialogueScriptOverlay` plate: `centerX 50.47%`, `top 69.94%`, `width 80.25%` |
| `text_button`×2 800×192 @ (776,1508) / (1624,1508) | без translate | plate-кнопки: `left 24.25%` / `50.75%`, `top 83.78%`, `width 25%`, `height 10.67%` |

**Гость виден СКВОЗЬ проём в самом арте окна** — не обрезается маской/клипом,
это отдельный слой ПОЗАДИ `door_window.webp` (у арта уже есть прозрачная
«дыра»). Рендерится общим `AtlasSprite` (`src/AtlasSprite.jsx`) — тем же
компонентом, что и вся анимация в Таверне, без дублирующей логики.

Источник спрайта (по выбору скрипта):
- `encounter: { visitorAtlas: { url, cols, rows, frameCount, fps } }` — анимированный атлас (например, `visitor_cloaked.webp` 4×4 из таверны).
- `encounter: { visitorUrl: '...' }` — статичный `<img>` (`object-contain`, без атласа).
- ничего не задано — дефолтный `eye_atlas.webp` (монстр) за рамкой.

**DialogueScriptOverlay variant="plate":** текст и кнопки — не плавающий
пузырь-якорь, а плашка, встроенная в композицию окна (белый текст, кнопки-
«заклёпки» bg `#3d3d3e`/`#1a1a1b`). Позиция считается из `computeStageRect()`
(`screenScale.js`) — тех же формул, что и CSS-скейл `ScreenStage`, без
DOM-измерений. Для реплик используется проектный пиксельный шрифт Greybeard
(`public/fonts/Greybeard-11px*.ttf`), Courier New остаётся fallback. Старый
вариант `variant="bubble"` (пузырь у DOM-якоря `data-entity-id`) сохранён по
умолчанию для обратной совместимости, но экраном ночной встречи не используется.

Типографика plate (масштабируется от `stageRect.scale`, т.е. пропорционально
холсту 3200×1800 — Figma-размеры делятся на 1800 и умножаются на текущий scale):

| Элемент | Figma | В коде |
|---------|-------|--------|
| Текст реплики | 76px / line-height 112px | `fontSize: 76×scale`, `line-height: 1.474` |
| Тень текста | drop-shadow белый 20%, blur 68px | `text-shadow: 0 0 68×scale px rgba(255,255,255,.2)` (+ доп. тёмная тень для контраста, вне Figma-спека) |
| Текст кнопки | 55px, letter-spacing 2px | `fontSize: 55×scale`, `letter-spacing: 2×scale` |
| Выделение слова | сегмент `#FFCD76` | разметка `**слово**` в реплике скрипта — см. `docs/dialogue-authoring.md` |

---

## 8. Диалоговый UI (ограничения вёрстки)

| Компонент | Ограничение |
|-----------|-------------|
| `SpeechBubble` | max-width **200px**, шрифт Greybeard 14px (Courier fallback) |
| Реплика | ~**70–90 символов** (иначе пузырь слишком высокий) |
| Якорь | центр X спикера; `bottomY = top bbox + 24px` |
| Панель выборов | 2–4 кнопки, без скролла |
| Оверлей диалога | `fixed inset-0`, z **9990+** — **вне** `ScreenStage` |

---

## 9. Safe-zone и сетка (Figma)

| Зона по Y (логический 3200×1800) | Назначение |
|----------------------------------|------------|
| 0–240 | HUD (XP, заголовок) — для боевого экрана |
| 240–1560 | основная сцена |
| 1560–1800 | нижний UI (карты, лут) — для боевого экрана |

- Safe-zone: **margin 80 px** от краёв логического холста
- Сетка: шаг **160 px** (20×11.25 клеток на 3200×1800)
- Кадры персонажей: **320×320** (или кратно 160)

---

## 10. Подключение нового экрана

```jsx
import ScreenStage from './ScreenStage';
import { BASE_ASPECT } from './screenScale';

<ScreenStage fill={1} aspectRatio={BASE_ASPECT} zIndex={9000}>
  {/* позиции в % от контейнера сцены */}
</ScreenStage>
```

- **Сцена** — внутри `ScreenStage` (проценты, scale от высоты)
- **Модалки, диалоги, тосты** — снаружи, `fixed inset-0` на viewport
- Конфиг сущностей — отдельный `*SceneConfig.js` по образцу таверны

---

## 11. Статус миграции экранов

| Экран | ScreenStage | Aspect | Статус |
|-------|-------------|--------|--------|
| TavernHubScreen | ✅ | 1024/529 + fill 0.82 | эталон |
| NightEncounterScreen | ✅ (частично) | квадрат по `stageHeightCss` | эталон |
| Бой (`App.jsx`) | ⏳ | flex-layout, ~16∶9 viewport | отдельный этап |
| PrepScreen | ⏳ | — | не мигрирован |
| Preloader | ⏳ | — | не мигрирован |
| MapOverlay | ⏳ | absolute внутри боя | не мигрирован |

---

## 12. Чек-лист после правки Figma

1. Duplicate `📐 Screen Template 3200×1800`
2. Рисовать внутри safe-zone (синяя пунктирная рамка)
3. Экспорт WebP, pixel-art без сглаживания
4. Пересчитать `left%`, `top%`, `scale`, `aspect` по формулам §3
5. Обновить `*SceneConfig.js` и эту таблицу в §6
6. Проверить спрайты у **краёв сцены** — обязателен `aspect`, иначе ширина схлопнется
7. `npm run build` + визуальная проверка в dev (`npm run dev`)
