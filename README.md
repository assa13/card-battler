# Card Battler

Браузерный пошаговый карточный авто-батлер с элементами рогалика: отряд из трёх героев, ветвящаяся карта секторов в стиле Slay the Spire, комбо-цепочки по стоимости карт, QTE «Perfect Hit», лут/крафт и мета-прогрессия «огоньки души». Интерфейс — русский.

## Документация

Модульная: один домен — один док, без дублирования.

| Файл | Что внутри |
|---|---|
| [`GDD.md`](./GDD.md) | Обзор игры + сводка ключевых параметров баланса |
| [`docs/core.md`](./docs/core.md) | **Кор**: герои, карты, урон, комбо, QTE, дебаффы, враги, фазы боя |
| [`docs/vfx.md`](./docs/vfx.md) | **VFX/графика/звук**: спрайты, анимации, фоны, шейдеры, обводка, SFX |
| [`docs/meta.md`](./docs/meta.md) | **Мета**: лут/крафт, XP, события, смерть, огоньки, Таверна, подготовка |
| [`instructions.md`](./instructions.md) | Стек, структура репо, карта монолита `App.jsx`, тех-долг |

При расхождении доков с кодом приоритет у доков — код правится первым.

## Стек

React 19 + Vite 8 + Tailwind 3. Сборка через `vite-plugin-singlefile` (JS+CSS инлайнятся в один html; ассеты из `public/` остаются рядом). Деплой — GitHub Pages (`.github/workflows/deploy-pages.yml`).

## Команды

```bash
npm ci             # зависимости
npm run dev        # dev-сервер (http://localhost:5173)
npm run build      # прод-билд в dist/
npm run preview    # предпросмотр прод-билда
npm run lint       # eslint
```

Служебные скрипты (запуск вручную):

```bash
node scripts/convert-images.mjs --apply   # PNG → WebP (без --apply — dry-run)
node scripts/gen-sfx.mjs                  # регенерация wav-звуков (jsfxr)
node scripts/import-tavern-assets.mjs     # одноразовый импорт ассетов таверны
```

## Структура

- `src/App.jsx` — ядро игры (монолит ~5200 строк, карта — в `instructions.md`)
- `src/QteOverlay.jsx` — QTE «Perfect Hit» (сужающееся кольцо, rAF)
- `src/TavernHubScreen.jsx` + `src/TavernSceneConfig.js` — мета-экран Таверна-Хаб
- `src/ShaderOutlineWrapper.jsx` + `src/gpu/alphaOutlinePipeline.js` — hover-обводка спрайтов (WebGPU / CSS fallback)
- `public/` — ассеты (WebP-спрайты, wav-звуки, фоновый трек)

> Папка `game-new/` — отдельный неподключённый прототип, к боевой сборке отношения не имеет.
