# Card Battler — техническая инструкция (по коду)

> Дизайн-документ — в `GDD.md`. Здесь — **реализация**: где что лежит, как связано, что трогать осторожно. Если расходится с `GDD.md` — приоритет у GDD, а это документ обновляется по коду.

---

## 0. Стек и проект

- **React 19 + Vite 8 + Tailwind 3** (см. `package.json`).
- Скрипты: `npm run dev` / `npm run build` / `npm run preview` / `npm run lint`.
- **Сборка в один HTML** через `vite-plugin-singlefile` (`vite.config.js`, `base: './'`) — для распространения как одного `.html`. Учитывать при добавлении крупных ассетов: они инлайнятся в base64 и раздувают итоговый html.
- SFX — `jsfxr` (процедурные), фоновая музыка — `public/file.mp3` (стримим первую половину, см. `App` → `useEffect` загрузки музыки).

### Структура

```
src/
  main.jsx       — bootstrap React
  App.jsx        — ВСЯ игра (~4400 строк): константы, компоненты, главный App
  App.css        — глобальные стили
  index.css      — tailwind directives
public/
  file.mp3       — фоновый трек
  chars/*_atlas.png   — спрайт-атласы героев и врагов
  icons/item_NN.png   — иконки предметов (растровые)
  bg/locations/*.png  — фоны локаций (ЧБ, красятся mix-blend-mode)
  bg/mask.png         — маска для фона
  combo_rune_*.png    — руны индикатора комбо
```

> Папка `game-new/` — отдельный, не подключённый прототип (свой `index.html`). К боевой сборке отношения не имеет.

---

## 1. Карта `src/App.jsx` (где что искать)

Файл — монолит. Помечен комментариями-разделителями `// --- N. ... ---`:

| Зона строк | Содержимое |
|---|---|
| 1–600 | Константы, словари (`RARITIES`, `INITIAL_PLAYERS_DATA`, `HERO_ABILITIES`, `MOD_CARDS`, `SECONDARY_EFFECTS`, `ITEM_TEMPLATES`, `ENEMY_TYPES`, `POWERUPS`, формации) |
| 600–870 | Бой/урон: `computeCardDamage`, `applyIncomingDamage`, `buildSecondaryPayload`, `applyStatusToEnemy`, `decrementStatuses` |
| 870–1070 | Генерация карты сектора (`MAP_Y_POSITIONS`, `LINE_COLORS`, `generateMap`, `getSubwayPath`) |
| 1070–1900 | Презентационные компоненты: `CharSprite`, `EnemyHpBar`, `FlyingCard/Item/Xp`, `DamagePopup`, `ItemSlot`, `BloodParticle`, `ComboIndicator`, `TargetReticle`, `HeroFieldBadges`, `CombatVfx`, `ShaderBackground`, `ImageBackground`, `AbilityCard` |
| 1900–2700 | Экраны/оверлеи: `Preloader`, `SquadSlotsBoard/Popup`, `DeathScreen`, `PrepScreen`, `CardRevealOverlay`, `DeckWindow`, `SectorSplashScreen` |
| 2700+ | `export default function App()` — главный компонент: ~50 `useState`, рефы, эффекты, обработчики боя, рендер |

### Ключевой словарь символов

| Символ | Что |
|---|---|
| `INITIAL_PLAYERS_DATA`, `HP_PER_LEVEL`, `HERO_ACCENT` | Базовые статы героев и цвета |
| `MAX_MANA` (=3), `CARD_BASE_POWER` (=15), `SECONDARY_BASE_POWER` (=14), `ENEMY_POWER_MULT` (=0.5) | Базовый баланс |
| `CARD_POOL_SIZE` (=4) | Слотов карт на героя |
| `COMBO_DAMAGE_MULT` `[1, 1.5, 2.5]`, `COMBO_DAMAGE_PCT` `[0, 50, 150]` | Шкала комбо |
| `HERO_ABILITIES` | Каталог карт по героям (basic + skills) |
| `MOD_CARDS`, `MOD_CARD_LIST`, `isModCard`, `getModValue` | Универсальные мод-карты (🛡️ Закал брони, 🔗 Усиление цепи) |
| `SECONDARY_EFFECTS` | Конфиг дебаффов (icon, color, label, duration) |
| `computeCardDamage`, `rollCardDamage`, `computePreviewDamageOnEnemy` | Расчёт урона (рандомный крит и превью без рандома) |
| `getSecondaryStatValue`, `getSecondaryDesc`, `buildSecondaryPayload` | Сила эффектов |
| `applyStatusToEnemy`, `decrementStatuses`, `describeStatus` | Жизненный цикл статусов |
| `applyIncomingDamage` | Поглощение урона бронёй |
| `getEffectivePlayer`, `getMaxHpFromStats`, `syncPlayerMaxHp` | Применение бонусов экипировки |
| `getTargets` (внутри `App`), `getCardTargeting`, `pickRandomAliveIndices` | Выбор целей карты |
| `getCardLevel`, `getLevelMultiplier` | Уровень карты (×2 урона / уровень) |
| `createInitialDeck`, `ensureFullDeck`, `purgeHeroFromDeck` | Жизненный цикл колоды |
| `buildLevelUpOptions`, `upgradeCardById` | Награды level-up |
| `ITEM_TEMPLATES`, `RARITY_TINT`, `ItemIcon`, `pickTemplateForRarity` | Шаблоны и тинт предметов |
| `rollItemStatBundle`, `ITEM_BONUS_COUNTS`, `ITEM_STAT_TYPES`, `ITEM_HP_MULT`, `ITEM_CRIT_MULT` | Случайные бонусы предметов |
| `generateItemOfRarity`, `rollItemRarity`, `rollLootDrop` | Генерация и дроп лута |
| `getNextRarity`, `doCraft` | Крафт предметов (3 → 1 редкости выше) |
| `ITEM_BURN_XP`, `addItemToInventory` | Сжигание лишних предметов в XP |
| `JUNK_SOUL_POINTS`, `EMBER_JUNK_THRESHOLD` (=11) | Мета-валюта «огоньки души» |
| `PREP_SLOT_PRICES`, `PREP_BURN_COST`, `PREP_MAX_BUYS` (=2) | Экран подготовки |
| `POWERUPS`, `handleEventChoice` | События |
| `ENEMY_TYPES`, `spawnEnemies` | Ростер и спавн врагов |
| `CHAR_ATLASES`, `ENEMY_ATLASES`, `CHAR_FORMATION`, `ENEMY_FORMATIONS`, `CHAR_SPRITE_SIZE` | Спрайты и формации |
| `EnemyHpBar`, `lowHpPulse` | Полоса HP врага и предсмертная пульсация |
| `ShaderBackground` | WebGL-фон с авто-деградацией FPS (3 тира) |
| `ImageBackground`, `BG_LOCATION_SETS` | ЧБ-локации, красятся mix-blend-mode |
| `Preloader`, `PRELOAD_ASSETS` | Прогрев ассетов перед стартом |
| `resetGame(fromDeath)`, `fullReset` | Сброс забега |

---

## 2. Расчёт урона (единая формула)

См. `computeCardDamage(owner, card, bonus)`:

```js
base   = card.mult * CARD_BASE_POWER * 2^(level − 1)
atkPct = card.dmgType === 'magic' ? owner.matk : owner.atk
total  = base * (1 + atkPct/100) * bonus       // bonus = combo×1/1.5/2.5
damage = max(1, round(total))
critChance = min(0.75, owner.crit/100)         // owner.crit — только с предметов
```

- **Урон не зависит от характеристик** героя — характеристики `str/dex/int` удалены из проекта. Идентичность героя задаётся `dmgType` карт и предметами.
- `rollCardDamage` дополнительно катит крит (`Math.random() < critChance` → ×2). `computePreviewDamageOnEnemy` использует ту же базу, **без** случайного крита, но **учитывает** Метку и Пробитие брони цели.
- Бонус мод-карты «Усиление цепи» (`chainAttackBonus`) добавляется к итогу плоско после `computeCardDamage` (см. место вызова в `playCard`).

### Комбо

- Состояние: `lastPlayedCost`, `comboStreak` в `App`. Условие продолжения цепочки: `card.cost === lastPlayedCost + 1` подряд в одном ходу.
- Шаг → множитель: 1→×1.0, 2→×1.5, 3+→×2.5 (`COMBO_DAMAGE_MULT`).
- Тот же множитель идёт в `buildSecondaryPayload(owner, card, comboMult)` и масштабирует силу дебаффов.
- `targeting` карты комбо **не меняет** (никаких авто-AoE; флаг `comboSplash` удалён из проекта).

### Цели атаки

`getCardTargeting(card)` → `'all' | 'random2' | 'strongest'`. Логика в `App.getTargets`:
- `all` — все живые;
- `random2` — 2 случайных живых (если один — он же);
- `strongest` — один с `max(maxHp)`, при равенстве — больший `hp`.

---

## 3. Вторичные эффекты (дебаффы)

`SECONDARY_BASE_POWER = 14`. Сила: `v = 14 × 2^(level−1) × combo`.

| Эффект | Ключ | Формула | Длительность |
|---|---|---|---|
| 💫 Оглушение | `stun` | шанс `v×2%` (кап 95%) | 1 ход |
| 🛡️ Пробитие брони | `vuln` | `+v×1%` к получаемому урону (кап +80%) | 2 |
| 🩸 Кровотечение | `bleed` | `v×0.5` урона/ход (тик в начале фазы врага, может добивать) | 3 |
| 🌀 Ослепление | `blind` | шанс промаха `v×2%` (кап 95%) | 2 |
| ⬇️ Ослабление | `weaken` | `−v×1%` к атаке (кап −80%) + мгновенно `v×0.5` HP | 2 |
| 🎯 Метка | `mark` | след. удар — гарант. крит ×2 × (1+v×0.01) | до первого удара |

- Стак — через `max` (см. `applyStatusToEnemy`), **не суммируется**.
- Длительности тикают в `decrementStatuses` в конце фазы врагов; `mark` не тикает (снимается первым ударом).
- `bleed` обрабатывается **в начале** фазы врага и может присуждать XP/лут через стандартный путь смерти.

---

## 4. Боевая машина состояний (`turnState`)

`map → dealing → player → enemy → (victory_wait → victory | map) | gameover`

- **map** — карта сектора, выбор узла.
- **dealing** — раздача карт каждому живому герою из общей очереди (своя или мод-карта). Каждые 3 раздачи `dealCounterRef` срабатывает «перемешивание сброса в резерв». Мана восстанавливается до `maxMana`. **Броня от мод-карт обнуляется** (новый раунд).
- **player** — клик по карте героя → `playCard`. Карта мгновенно разыгрывается, анимации идут параллельно (`setTimeout`-цепочка для урона/VFX, ввод не блокируется). Завершение хода: либо вручную, либо авто, когда никто не может сделать легальный ход. При завершении неиспользованный `chainAttackBonus` сгорает.
- **enemy** — последовательная атака живых врагов: тик кровотечения → ход атакующего (с учётом stun/blind/weaken) → урон героям через `applyIncomingDamage`.
- **victory_wait → victory** — пауза + экран «СЕКТОР ЗАЧИЩЕН» (для босса).
- **gameover** — экран смерти, продажа ненадетого инвентаря, переход в `PrepScreen`.

### Раздача и колода

- Старт: `createInitialDeck` = 3 стартовых героических карты + 2 универсальные мод-карты, **без балласта**.
- Новые карты на level-up / из 📜 Фолианта добавляются как `kind:'new'` через `buildLevelUpOptions`; апгрейды — `kind:'upgrade'` через `upgradeCardById` (+1 уровень).
- `purgeHeroFromDeck(heroId)` — карты погибшего героя удаляются из руки/резерва/сброса; в `DeckWindow` остаются статичные слоты 💀.

---

## 5. Лут, экипировка, крафт

- Дроп при убийстве обычного врага: `LOOT_DROP_CHANCE = 0.65`. Босс (`isBoss`) — **всегда** легендарка (без ролла), в т.ч. от добивания кровотечением.
- Редкость с глубиной: `depth = (sector−1)×6 + max(0, stage−1)`, `t = min(1, depth/22)`, веса плавно сдвигаются от старта к глубине.
- Инвентарь `INVENTORY_SIZE = 9`. Переполнение → первый предмет сгорает в XP (`ITEM_BURN_XP`).
- Бонусы предмета (`ITEM_STAT_TYPES = ['atk','matk','crit','hp']`) применяются через `getEffectivePlayer` **только пока надет**. При снятии — `syncPlayerMaxHp` обрезает HP под новый максимум.
- Крафт: 3 предмета одной редкости → 1 следующей (`getNextRarity` + `generateItemOfRarity`). Легендарные не крафтятся.

### Метa: огоньки души

- При смерти отряда **ненадетый инвентарь продаётся** в очки хлама (`JUNK_SOUL_POINTS`): 1/4/10/25.
- За каждые `EMBER_JUNK_THRESHOLD = 11` очков — +1 огонёк (`soulEmbers`). Остаток (`soulProgress`) переносится между забегами.
- `resetGame(fromDeath=true)` сбрасывает: уровень/XP/ману/колоду/сектор. Сохраняет: `equipped`, `soulEmbers`, `soulProgress`.
- `fullReset` — полный сброс с экипировкой и валютой, в обычном UI не дёргается.

---

## 6. Спрайты и анимации боя

- Атласы 1280×1280, кадры 320×320 (4×4), idle 15–16 кадров, 7.5 fps. Рендер — `CharSprite` через `background-position`, `image-rendering: pixelated`.
- **Все атласы в `PRELOAD_ASSETS`** — иначе враги «проявляются» с задержкой.
- **Melee-прыжок**: вектор до цели через `getBoundingClientRect`, двойной `requestAnimationFrame`, transition 300 мс (совпадает с моментом урона), возврат 600 мс.
- **Ranged/AoE**: атакующий не двигается, летит только снаряд через `vfxList`. Стрелок — стрела (`vfxType: 'arrow'`).
- Спрайты врагов **зеркалятся** через `scaleX(-1)` на внутреннем div; направление прыжка считается в **неотзеркаленной** системе координат на внешнем div.
- `EnemyHpBar` — двухслойный, скрыт по умолчанию, всплывает при уроне и гаснет через ~1 с.
- `lowHpPulse` — при HP < 30% спрайт пульсирует тёмно-красным CSS-фильтром.

### Известный риск (баг уже был)

Любое исключение в `setTimeout`-колбэке атаки **замораживает героя у врага** — `setIsAnimating(false)` не вызывается. Уже был кейс с `ReferenceError` на удалённой константе `ITEM_STAT_TYPES` (фикс — `975c1f4`). При любых правках в боевой анимации:
1. Заворачивать тело колбэка в `try/finally`, чтобы гарантировать сброс анимационного флага.
2. Никогда не удалять/переименовывать константы, которые читаются внутри асинхронных цепочек, без полного grep.

---

## 7. Фоны

- `ShaderBackground` — полноэкранный WebGL fragment-шейдер (FBM-небула), 3 тира качества с авто-деградацией: `[scale 0.6, 30fps] → [0.45, 24fps] → [0.3, 20fps]`. На `document.hidden` rAF замораживается, тайминги сбрасываются. На «программном» рендерере (SwiftShader/llvmpipe) сразу выбирается худший тир.
- `ImageBackground` — ЧБ пиксель-арт локации (`BG_LOCATION_SETS`), красится цветным оверлеем через `mix-blend-mode: color` (аналог Hue/Saturation).
- На экранах подготовки и оверлее раскрытия карты глобальные фоны/блюр отключаются ради производительности.

---

## 8. Звук

- Фоновый трек: `public/file.mp3` загружается фоновым `fetch`-стримом, **обрезается на первой половине** (поиск ближайшего корректного MP3-фрейма по байтам `0xff 0xe?`), декодируется в Blob URL.
- SFX — процедурные `jsfxr`. Маппинг VFX → удар: magic → `hit_magic`, `smash` → `hit_heavy`, `poison` → `hit_poison`, остальные → `hit_light`.
- Громкости: `musicVolume` (по умолч. 0.35), `_sfxVolume` (модульная переменная, обновляется из стейта `sfxVolume`).

---

## 9. UI-карточка способности (`AbilityCard`)

Сверху вниз: название + кружок маны → иконка → плашка редкости → строка «Наносит N урона по <цели>» (число окрашено через `getCardStatColor`: magic — синий, ranged — зелёный, melee — красный) → строка вторичного эффекта (если есть) → строка цели (10px, slate-400).

Подсветка комбо: бейдж `COMBO +50%/+150%`, число урона желтеет, золотое свечение плашки. **Стартовое (первое) звено не подсвечивается** — пока цепочка не начата, ни одна карта не выделена.

`ComboIndicator` (справа от арены) появляется только когда у разыгрываемой карты есть кандидаты-продолжения.

---

## 10. Известный тех-долг / риски

1. **Монолит `App.jsx`** (~4400 строк). Один `App` держит ~50 `useState`, любой setState на VFX/попапах перерисовывает всё дерево → главный источник перформанс-просадок. См. план «Производительность» (раздел 11).
2. **`setTimeout`-цепочки** в боевых анимациях без `try/finally`. Любой ReferenceError внутри = зависший герой у врага (см. раздел 6).
3. **Лагерный мёртвый код** оставлен (отлавливается через `npm run lint`): `NUM_STAGES`, `STAGE_WIDTH`, `ITEM_RARITY_WEIGHTS`, `DECK_SIZE`, `rollCardDamage`, `getTargetText`, `formatItemStats` — никем не используются, можно удалить отдельным проходом.
4. **`shuffleArray = array.sort(() => Math.random() − 0.5)`** — некорректный (необъективный) shuffle, статистически смещён. Заменить на Fisher-Yates перед серьёзным балансом.
5. **`vite-plugin-singlefile`** инлайнит всё в HTML. Любой добавленный мегабайтный ассет → раздутый билд. `file.mp3` (13.5 МБ) уже на грани. Дубликат `music.mp3` удалён.
6. **Альтернативный прототип `game-new/`** не подключён к боевому билду, но засоряет репо и поиск. Решение нужно: переносить наработки или удалять.

---

## 11. План производительности (по приоритету)

См. раздел 10 — корень проблем в монолите. Конкретные приёмы — в архитектурных задачах PR'ов, не дублирую здесь.

---

*Документ описывает реализацию по состоянию кода. Расхождения с `GDD.md` правятся в первую очередь.*
