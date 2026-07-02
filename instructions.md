# Card Battler — техническая инструкция (по коду)

> Обзор игры и баланс — в [`GDD.md`](./GDD.md). Детали по доменам — в модульных доках:
> [`docs/core.md`](./docs/core.md) (бой) · [`docs/vfx.md`](./docs/vfx.md) (графика/звук) · [`docs/meta.md`](./docs/meta.md) (мета).
> Здесь — **общее**: стек, структура, карта монолита, риски, тех-долг. Если расходится с доками — приоритет у доков, код правится первым.

---

## 0. Стек и проект

- **React 19 + Vite 8 + Tailwind 3** (см. `package.json`).
- Скрипты: `npm run dev` / `npm run build` / `npm run preview` / `npm run lint`.
- **Сборка в один HTML** через `vite-plugin-singlefile` (`vite.config.js`, `base: './'`). Важно: плагин инлайнит только JS+CSS (~420 КБ); все ассеты из `public/` остаются снаружи — «один html» без соседней папки ассетов не работает.
- Деплой — GitHub Pages: `.github/workflows/deploy-pages.yml` (push в `master`/`main` → build → Pages).
- **Все растровые ассеты — WebP** (миграция с PNG). Конвертер: `scripts/convert-images.mjs` (dry-run по умолчанию, `--apply`).

### Структура

```
src/
  main.jsx                 — bootstrap React
  App.jsx                  — ядро игры (~5200 строк): константы, компоненты, главный App
  QteOverlay.jsx           — QTE «Perfect Hit»: сужающееся кольцо (изолированный, rAF)
  qteTimeScale.js          — bullet-time: playbackRate всем анимациям + «игровое» время
  TavernHubScreen.jsx      — мета-экран Таверна-Хаб (изолирован от App.jsx)
  TavernSceneConfig.js     — декларативный конфиг сцены таверны (позиции/z/хитбоксы из Figma)
  ShaderOutlineWrapper.jsx — hover-обводка интерактивных спрайтов (WebGPU / CSS fallback)
  gpu/alphaOutlinePipeline.js — WebGPU-пайплайн alpha-outline (WGSL, outline-only pass)
  App.css / index.css      — глобальные стили / tailwind directives
scripts/
  convert-images.mjs       — PNG → WebP конвертер (sharp)
  import-tavern-assets.mjs — одноразовый импорт ассетов таверны из new_imgs/
  gen-sfx.mjs              — генератор wav-звуков (jsfxr) в public/assets/sfx/
docs/
  core.md / vfx.md / meta.md — модульные доки по доменам (дизайн + реализация)
public/
  file.mp3                 — фоновый трек (13.5 МБ)
  assets/sfx/**/*.wav      — сгенерированные SFX (ui/combat/game/map/events)
  assets/tavern/*.webp     — сцена таверны
  chars/*_atlas.webp       — спрайт-атласы героев и врагов
  icons/item_NN.webp       — иконки предметов
  bg/locations/*.webp      — фоны локаций (ЧБ, красятся mix-blend-mode)
  bg/mask.webp, combo_rune_*.webp
```

> Папка `game-new/` — отдельный, не подключённый прототип (свой `index.html` и вложенный `.git`). К боевой сборке отношения не имеет.

### Модули вне монолита

| Модуль | Назначение | Детали |
|---|---|---|
| `QteOverlay.jsx` | QTE-кольцо, полноэкранный клик-катчер, rAF без setState | [`docs/core.md`](./docs/core.md) §4, [`docs/vfx.md`](./docs/vfx.md) §5 |
| `qteTimeScale.js` | Bullet-time под QTE: слоу-мо мира ×0.35, кольцо в реальном времени | [`docs/core.md`](./docs/core.md) §4 |
| `TavernHubScreen.jsx` + `TavernSceneConfig.js` | Таверна-Хаб: старт и возврат после смерти | [`docs/meta.md`](./docs/meta.md) §5 |
| `ShaderOutlineWrapper.jsx` + `gpu/alphaOutlinePipeline.js` | Hover-обводка по силуэту (WebGPU/CSS) | [`docs/vfx.md`](./docs/vfx.md) §7 |

---

## 1. Карта `src/App.jsx` (где что искать)

Файл — монолит (~5200 строк). Помечен комментариями-разделителями `// --- N. ... ---` (нумерация сбита: «3. ЗВУКИ» и «3. ГЛАВНОЕ ПРИЛОЖЕНИЕ» — дубль номера):

| Зона строк (≈) | Содержимое |
|---|---|
| 1–620 | Константы, словари (`RARITIES`, `INITIAL_PLAYERS_DATA`, `HERO_ABILITIES`, `MOD_CARDS`, `SECONDARY_EFFECTS`, `ITEM_TEMPLATES`, `ENEMY_TYPES`, `POWERUPS`, формации) |
| 620–920 | Бой/урон: `computeCardDamage`, QTE-хелперы, `applyIncomingDamage`, `buildSecondaryPayload`, `applyStatusToEnemy`, `decrementStatuses` |
| 920–1110 | Генерация карты сектора (`generateMap`, `getSubwayPath`) |
| 1110–1960 | Презентационные компоненты: `CharSprite`, `EnemyHpBar`, `FlyingCard/Item/Xp`, `DamagePopup`, `ItemSlot`, `BloodParticle`, `ComboIndicator`, `TargetReticle`, `HeroFieldBadges`, `CombatVfx`, `ShaderBackground`, `ImageBackground`, `AbilityCard` |
| 1960–2870 | Звуки (`playSound`, `PRELOAD_ASSETS`), экраны/оверлеи: `Preloader`, `SquadSlotsBoard/Popup`, `DeathScreen`, `PrepScreen`, `CardRevealOverlay`, `DeckWindow`, `SectorSplashScreen` |
| 2870+ | `export default function App()` — главный компонент: ~55 `useState`, рефы, эффекты, обработчики боя, рендер |

Полные словари символов по доменам — в конце каждого модульного дока: [`core.md`](./docs/core.md) §8, [`meta.md`](./docs/meta.md) §7.

---

## 2. Известный тех-долг / риски

1. **Монолит `App.jsx`** (~5200 строк). Один `App` держит ~55 `useState`, любой setState на попапах перерисовывает всё дерево → главный источник перформанс-просадок. Эфемерные эффекты вынесены в `FxLayer` (императивный API через `fxRef`); новые модули (Таверна, QTE) изолированы.
2. ~~`setTimeout`-цепочки без защиты~~ — **закрыто**: `safeAnim` + watchdog ([`docs/vfx.md`](./docs/vfx.md) §3). Правило: новые боевые колбэки — только через `safeAnim`.
3. **Мёртвый код** (отлавливается `npm run lint`, ~49 ошибок): `NUM_STAGES`, `STAGE_WIDTH`, `ITEM_RARITY_WEIGHTS`, `DECK_SIZE`, `rollCardDamage`, `getTargetText`, `formatItemStats` — можно удалить отдельным проходом.
4. ~~`shuffleArray` со смещением~~ — **закрыто**: Fisher–Yates.
5. **`vite-plugin-singlefile`** инлайнит только JS+CSS; билд не «однофайловый» буквально. Дубликаты в корне репо: `file.mp3` и папка `icons/` — кандидаты на чистку.
6. **Прототип `game-new/`** (со своим вложенным `.git`!) не подключён к билду, засоряет репо. Решение нужно: переносить или удалять.
7. **Заглушки Таверны**: `OPEN_BARTENDER_DIALOG`, `INSPECT_RECRUIT` объявлены, экранов нет; `recruitsPool` не передаётся.

---

## 3. Правила работы с доками

- **Один домен — один док.** Боевая механика правится в `docs/core.md`, графика/звук — в `docs/vfx.md`, мета — в `docs/meta.md`. Ничего не дублировать между доками — ссылаться.
- `GDD.md` — обзор + сводка параметров; `instructions.md` — стек/структура/тех-долг. Новые числа баланса попадают и в модульный док, и в сводку GDD.
- При расхождении доков с кодом приоритет у доков, код правится первым.
