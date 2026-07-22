# Handoff: Незнакомец, экономика меты, card reveal

Дата: 14.07.2026. Контекст чата для продолжения работы в новой сессии.

## Что за проект

React (Vite, single-file build) карточный рогалик-идлер: бой с QTE, карта секторов,
таверна-хаб с диалоговой системой (Yarn-like скрипты), экран инвентаря героев,
экран подготовки (prep). Сборка: `npm run build` (vite, всё инлайнится в `dist/index.html`).

## Что сделано в этой сессии

### 1. Наёмник Незнакомец (stranger.png)

- **Скрипт 2-й смерти** — `src/dialogue/scripts/strangerSecondDeath.js`
  (`STRANGER_SECOND_DEATH_SCRIPT`). Играет **НОЧЬЮ** после второй смерти отряда:
  игрок отдыхает (лестница → ночь → стук), открывает дверь → скрипт незнакомца
  вместо случайного ночного гостя. Ветвление: «Впустить» → команда
  `STRANGER_JOIN_TAVERN` (+ тост + `END_NIGHT_SLEEP`), «Прогнать» → `END_NIGHT_SLEEP`,
  визит повторится ночью после следующей смерти.
- **Проп таверны**: `nightScript` / `onNightScriptComplete` (бывший `entryScript`
  удалён). В `TavernHubScreen.startNightVisitorScript` — `nightScript` имеет
  приоритет над роллом `NIGHT_VISITOR_SCRIPTS`. Флаг в App: `strangerStoryPending`
  (ставится в `handleDeathDone` при `deathCountRef.current >= 2 && !strangerInTavern`).
- **В таверне**: `strangerInTavern` — подмена посетителя `visitor_cloaked_center`
  на атлас `./assets/tavern/stranger.png` (4×4, fps 4) в `TavernHubScreen`.
- **Найм**: `hireStranger(targetHeroId)` в App — 250 🪙 (`STRANGER_HIRE_GOLD_COST`),
  доступен с сектора 2 (`STRANGER_HIRE_MIN_SECTOR`, «пыточные», проверка по
  `maxSectorReached`). Заменяет героя: имя → «Незнакомец», спрайт → оверрайд в
  `HERO_SPRITE_OVERRIDES` (боевой кит класса остаётся). Заглушка-аватар с замком
  и ценой — в `HeroCarousel` / `HeroInventoryScreen`.

### 2. Кошелёк и экономика

- `WalletHUD` в App (fixed top-right, z-9650): 🪙 золото + 🔥 огоньки души, на всех экранах.
- **Карты коллекции** — разблокировка за **золото**: `getCardUnlockGoldCost(rarity)`,
  цены `{COMMON: 40, RARE: 90, EPIC: 180, LEGENDARY: 350}` (`heroCardInventory.js`).
- **Слоты лоадаута** — за **огоньки**: `getLoadoutSlotUnlockPrice`, лестница
  `[1, 1, 3, 6, 11, 22]` общая на всех героев (как PREP_SLOT_PRICES).
  `HERO_CARD_LOADOUT_SIZE = 2`, `DEFAULT_UNLOCKED_SLOTS = 1`.
- Тултипы предметов в инвентаре героев — как в бою (`renderItemTooltip` → `ItemTooltip`).

### 3. CardRevealOverlay (экран получения карты)

- `presentCardReveal(card, owner, { fromTavern })` в App; показывается при: первой
  смерти (бесплатная карта, `grantFirstDeathFreeCards`), наградах диалогов
  (`dispatchUnlockHeroCard`), покупке карты за золото (`unlockHeroInventoryCard`),
  prep-покупке (`buyPrepCard`), level-up наградах.
- Оверлей: `fixed z-[10050]`; пока `cardReveal != null` — таверна и инвентарь
  героев **скрываются** (условия `!cardReveal` в рендере), иначе оверлей был под ними.
- Старый `SquadSlotsPopup` не используется (мёртвый код ещё в App.jsx).

### 4. Верстка Ammunition в HeroInventoryScreen

Логика ряда слотов один в один с prep-экраном (эталон — App.jsx ~2445–2477):
1. базовая атака → 2. заполненные карты лоадаута подряд → 3. **первый пустой
слот = кнопка 🔥** (`EmberUnlockSlot`, если можно купить ещё) → 4. пустые
dashed-заглушки → 5. equipment.
- `EmberUnlockSlot` — тот же bbox, что `InventoryCardSlot`: обёртка `h-[104px] w-20`,
  кнопка `w-16 h-20` + `origin-top-left scale-125`, border/hover классы как в prep.
- `packedLoadout` (useMemo) — заполненные карты «упакованы» влево, кнопка огонька
  всегда СЛЕДУЮЩАЯ после них.

### 5. Сброс прогресса при перезапуске (сохранений пока НЕТ — осознанно)

- При маунте App: `clearMetaSessionStorage()` (из `heroCardInventory.js`) чистит
  `idler_permanentlyUnlockedCards` и `idler_heroInventoryMeta` + удаляются ключи
  `idler_strangerInTavern`, `idler_strangerHiredAs`.
- Все стейты инициализируются пустыми, `useEffect`-персисты удалены
  (`loadHeroInventoryMeta` / `saveHeroInventoryMeta` / `loadPermanentlyUnlockedCards` /
  `savePermanentlyUnlockedCards` из App больше не импортируются, но функции в
  `heroCardInventory.js` остались — пригодятся, когда будем делать сохранения).
- ВНИМАНИЕ: `maxSectorReached` всё ещё читает/пишет `idler_maxSectorReached` в
  localStorage — это единственный оставшийся персист (мета-прогресс для условия
  найма). Если нужно сбрасывать и его — добавить ключ в очистку.

## Ключевые файлы

| Файл | Роль |
|------|------|
| `src/App.jsx` | WalletHUD, hireStranger, presentCardReveal, handleDeathDone, resetGame, prep-экран (эталон слотов ~2445), рендер таверны/инвентаря/оверлея |
| `src/HeroInventoryScreen.jsx` | Инвентарь героев: Ammunition, Collection, EmberUnlockSlot, packedLoadout |
| `src/TavernHubScreen.jsx` | Таверна: ночная машина состояний, nightScript, strangerInTavern, диалоги |
| `src/heroCardInventory.js` | Вся мета карт: цены, слоты, clearMetaSessionStorage, (не)персист |
| `src/dialogue/scripts/strangerSecondDeath.js` | Скрипт незнакомца (ночь после 2-й смерти) |
| `src/dialogue/scripts/index.js` | Реестр ночных скриптов (незнакомец НЕ в ролле) |
| `src/PreparationCardSlot.jsx` | Эталонный слот карты `w-16 h-20` |
| `src/DialogueConfig.js` | Линейные триггеры (FIRST_DEATH, TAVERN_ENTER, бармен) |

## Константы

```
STRANGER_HIRE_GOLD_COST = 250
STRANGER_HIRE_MIN_SECTOR = 2
HERO_CARD_LOADOUT_SIZE = 2, DEFAULT_UNLOCKED_SLOTS = 1
LOADOUT_SLOT_UNLOCK_PRICES = [1, 1, 3, 6, 11, 22]
CARD_UNLOCK_GOLD_COSTS = { COMMON: 40, RARE: 90, EPIC: 180, LEGENDARY: 350 }
MAX_PERMANENT_CARDS = { p1: 2, p2: 2, p3: 2 }, CARD_POOL_SIZE = 4
```

## Сюжетный флоу смертей

1. **1-я смерть** → `firstDeathStoryPending` → вход в таверну → линейный диалог
   `FIRST_DEATH` → по завершении `grantFirstDeathFreeCards()` → CardRevealOverlay.
2. **2-я+ смерть** (пока `!strangerInTavern`) → `strangerStoryPending` → НОЧЬЮ
   (отдых → стук → дверь) скрипт незнакомца. Впустили → живёт в таверне.
3. Незнакомец в таверне + сектор 2 достигнут → найм за 250 🪙 в инвентаре героев.

## Состояние сборки

`npm run build` проходит (vite 8, ~502 КБ single-file). Линт чистый.
Терминал в песочнице не возвращал exit code — сборку запускать с полными правами.

## Открытые хвосты

1. **Проверка в браузере не делалась** (весь флоу: 2 смерти → ночь → дверь →
   скрипт → впустить → найм; позиция кнопки 🔥 в Ammunition; card reveal поверх всего).
2. Мёртвый код `SquadSlotsPopup` в App.jsx — можно удалить.
3. `idler_maxSectorReached` — единственный оставшийся localStorage-персист (см. выше).
4. Сохранение прогресса — отложено пользователем («это уже потом»); функции
   load/save в `heroCardInventory.js` сохранены под будущую систему сейвов.
5. В git status дублируются пути с `/` и `\` (docs/meta.md и docs\meta.md и т.п.) —
   артефакт Windows, при коммите проверить.
