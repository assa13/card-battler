import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NIGHT_HIDDEN_ENTITY_TYPES, TAVERN_ENTITIES, TAVERN_STAGE_RATIO } from './TavernSceneConfig';
import ScreenStage from './ScreenStage';
import ShaderOutlineWrapper from './ShaderOutlineWrapper';
import DialogueOverlay from './DialogueOverlay';
import { getBarkeepHint, getDialogueForTrigger } from './DialogueConfig';
import SleepModal from './SleepModal';
import NightSplashOverlay from './NightSplashOverlay';
import NightEncounterScreen from './dialogue/NightEncounterScreen';
import { pickWeightedScript } from './dialogue/scriptRunner';
import { NIGHT_VISITOR_SCRIPTS } from './dialogue/scripts';
import { STRANGER_COLORIZE } from './spriteColorize';
// Общий рендерер атлас-спрайтов (см. AtlasSprite.jsx) — используется и другими
// сценами (ночная встреча), чтобы анимация персонажей была идентична.
import TavernSprite from './AtlasSprite';

// Нарратив ночного сплеша под выбор игрока: проспал он ночь или встретил её,
// и был ли этой ночью гость (см. ролл в openSleepModal).
const NIGHT_SPLASH_TEXTS = {
  sleepQuiet: 'Вы гасите свечи и проваливаетесь в сон.\nНочь проходит тихо, без снов и без гостей.',
  sleepMissed: 'Вы гасите свечи и проваливаетесь в сон.\nСквозь дрёму чудится стук в дверь — но утро приходит раньше, чем вы решаетесь встать.',
  listenVisitor: 'В ночи нас посетил таинственный посетитель...\nКто-то настойчиво стучит в дверь таверны.',
  listenQuiet: 'Вы вслушиваетесь в темноту до рези в ушах.\nНи шороха, ни шага. Этой ночью никто не пришёл.',
};

const LockedBadge = ({ minSector }) => (
  <div
    className="absolute left-1/2 -top-3 -translate-x-1/2 px-2 py-0.5 text-[10px] font-black uppercase
               tracking-wider rounded bg-black/85 text-amber-300 border border-amber-500/60 pointer-events-none"
    style={{ zIndex: 200 }}
  >
    🔒 Сектор {minSector}+
  </div>
);

// ─── Ночной стук в дверь ─────────────────────────────────────────────────
// Зацикленные всплывающие «Тук-тук» у двери: появляются с НЕРАВНЫМИ интервалами
// (1.2–3.4s), медленно проявляются, дрейфуют вверх и тают. Позиция — у клик-зоны
// двери (door_to_map: left 92.5%, top 52%), чуть выше «головы» двери.

// Тряска дверного спрайта (door_night) в такт стуку. Прямая работа с DOM —
// намеренно: TavernEntity мемоизирован и generic, прокидывать через него
// одноразовый анимационный пульс было бы дороже. Keyframes ОБЯЗАНЫ включать
// базовый transform сущности (translate(-50%,-50%)), иначе дверь «уедет».
const shakeDoor = () => {
  const el = document.querySelector('[data-entity-id="door_night"]');
  if (!el) return;
  el.style.animation = 'none';
  void el.offsetWidth; // сброс через reflow — анимация перезапускается с нуля
  el.style.animation = 'tavernDoorShake 0.5s ease-in-out';
};

const KnockEffects = () => {
  const [knocks, setKnocks] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    let timer;
    const schedule = () => {
      timer = setTimeout(() => {
        idRef.current += 1;
        const id = idRef.current;
        // Случайный горизонтальный сдвиг — стук «гуляет» по дверному полотну.
        const dx = (Math.random() - 0.5) * 6; // ±3% сцены
        setKnocks(prev => [...prev, { id, dx }]);
        shakeDoor();
        setTimeout(() => setKnocks(prev => prev.filter(k => k.id !== id)), 2600);
        schedule();
      }, 1200 + Math.random() * 2200);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 190 }}>
      {knocks.map(k => (
        <div
          key={k.id}
          className="absolute font-black uppercase tracking-widest text-amber-200/90"
          style={{
            left: `calc(88% + ${k.dx}%)`,
            top: '34%',
            fontSize: 'clamp(10px, 1.4vw, 18px)',
            textShadow: '0 0 12px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8)',
            animation: 'tavernKnockFloat 2.5s ease-out forwards',
          }}
        >
          Тук-тук
        </div>
      ))}
      <style>{`@keyframes tavernKnockFloat {
        0%   { opacity: 0; transform: translateY(6px); }
        25%  { opacity: 0.95; }
        60%  { opacity: 0.8; }
        100% { opacity: 0; transform: translateY(-26px); }
      }
      @keyframes tavernDoorShake {
        0%, 100% { transform: translate(-50%, -50%) scaleX(1) rotate(0deg); }
        20% { transform: translate(calc(-50% - 2px), -50%) scaleX(1) rotate(-0.6deg); }
        40% { transform: translate(calc(-50% + 2px), -50%) scaleX(1) rotate(0.6deg); }
        60% { transform: translate(calc(-50% - 1px), -50%) scaleX(1) rotate(-0.4deg); }
        80% { transform: translate(calc(-50% + 1px), -50%) scaleX(1) rotate(0.3deg); }
      }`}</style>
    </div>
  );
};

// Нотификатор «есть дело» над персонажем: пульсирующий восклицательный знак.
// Клики пропускает насквозь (интерактив живёт в ShaderOutlineWrapper под ним).
// top ≈ 2%: у атласов персонажей голова начинается с ~10% высоты бокса
// (см. hitbox в TavernSceneConfig), значок встаёт прямо над ней.
const NotifierBadge = ({ hint }) => (
  <div
    className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
    style={{ top: '2%', zIndex: 210, animation: 'tavernNotifierBob 1.1s ease-in-out infinite' }}
    title={hint}
  >
    <div
      className="flex items-center justify-center rounded-full bg-amber-400 text-black font-black
                 border-2 border-amber-100"
      style={{
        width: 'clamp(18px, 2.1vw, 34px)',
        height: 'clamp(18px, 2.1vw, 34px)',
        fontSize: 'clamp(12px, 1.5vw, 24px)',
        lineHeight: 1,
        boxShadow: '0 0 18px rgba(245,158,11,0.85), 0 2px 6px rgba(0,0,0,0.7)',
      }}
    >
      !
    </div>
    <style>{`@keyframes tavernNotifierBob {
      0%, 100% { transform: translate(-50%, 0) scale(1); }
      50%      { transform: translate(-50%, -18%) scale(1.14); }
    }`}</style>
  </div>
);

const ActionLabel = ({ children }) => (
  <div
    className="absolute left-1/2 -top-4 -translate-x-1/2 px-2 py-0.5 text-[11px] font-black uppercase
               tracking-wider rounded bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.7)] pointer-events-none whitespace-nowrap"
    style={{ zIndex: 200 }}
  >
    {children}
  </div>
);

const renderEntityContent = ({ entity, activeParty, recruitsPool }) => {
  switch (entity.type) {
    case 'HERO_ACTIVE': {
      const hero = activeParty?.[entity.slotIndex];
      if (!hero) {
        return (
          <div className="w-full h-full border-2 border-dashed border-amber-500/40 rounded-lg
                          bg-black/20 flex items-center justify-center text-amber-400/60 text-xs font-bold uppercase">
            Слот {entity.slotIndex + 1}
          </div>
        );
      }
      return (
        <TavernSprite
          sprite={hero.sprite}
          assetUrl={hero.assetUrl}
          alt={hero.name}
          hue={hero.hue}
          sat={hero.sat}
        />
      );
    }
    case 'HERO_RECRUIT': {
      const recruit = recruitsPool?.find?.(r => r.id === entity.recruitId);
      return (
        <TavernSprite
          sprite={recruit?.sprite}
          assetUrl={recruit?.assetUrl || entity.assetUrl}
          alt={entity.id}
          hue={recruit?.hue}
          sat={recruit?.sat}
        />
      );
    }
    default:
      return (
        <TavernSprite
          sprite={entity.sprite}
          assetUrl={entity.assetUrl}
          alt={entity.id}
          hue={entity.colorize?.hue}
          sat={entity.colorize?.sat}
        />
      );
  }
};

const TavernEntity = React.memo(function TavernEntity({ entity, locked, activeParty, recruitsPool, notify, onClick }) {
  const isBg = entity.type === 'BG';
  const isPortal = entity.type === 'PORTAL';

  // PORTAL — невидимая клик-зона: прямоугольник с явным aspect.
  // Прочие сущности — высота в % от сцены, ширина по натуральному соотношению (auto).
  let baseStyle;
  if (isBg) {
    baseStyle = { inset: 0, position: 'absolute', zIndex: entity.zIndex };
  } else if (isPortal) {
    const heightPct = (entity.scale ?? 0.5) * 100;
    baseStyle = {
      position: 'absolute',
      left: entity.pos.left,
      top: entity.pos.top,
      height: `${heightPct}%`,
      aspectRatio: String(entity.aspect ?? 0.5),
      transform: 'translate(-50%, -50%)',
      zIndex: entity.zIndex,
    };
  } else {
    const flipX = entity.flipX ? -1 : 1;
    baseStyle = {
      position: 'absolute',
      left: entity.pos.left,
      top: entity.pos.top,
      height: entity.scale ? `${entity.scale * 100}%` : 'auto',
      transform: `translate(-50%, -50%) scaleX(${flipX})`,
      zIndex: entity.zIndex,
    };
    // Явный aspect фиксирует ширину контейнера. Без него abs-элемент у края
    // сцены получает shrink-to-fit ширину ~0 (доступного места нет), и <img>
    // с tailwind-овским max-width:100% сплющивается в линию (кейс door_night).
    if (entity.aspect) baseStyle.aspectRatio = String(entity.aspect);
  }

  const interactive = entity.interactive && !locked;
  const lockedFilter = locked ? 'grayscale(0.9) brightness(0.55)' : 'none';

  // Контент спрайта/фона — независимая ветка. Hover-эффект (drop-shadow / будущий шейдер)
  // живёт ИСКЛЮЧИТЕЛЬНО в ShaderOutlineWrapper. Сюда мы оборачиваем только интерактивные
  // не-фоновые сущности; PORTAL не имеет визуала и оборачивать нечего.
  let sprite;
  if (isBg) {
    sprite = (
      <img
        src={entity.assetUrl}
        alt=""
        draggable={false}
        className="w-full h-full object-cover select-none"
        style={{ imageRendering: 'pixelated' }}
      />
    );
  } else if (isPortal) {
    sprite = null;
  } else {
    sprite = renderEntityContent({ entity, activeParty, recruitsPool });
  }

  // Подсказка обертке: атлас-анимация → CSS fallback (drop-shadow), статика → WebGPU.
  // HERO_ACTIVE рендерит TavernSprite с CHAR_ATLASES[*] (атлас), значит animated=true.
  // Для прочих интерактивных (NPC бармен, PORTAL-портал) — статичный <img>.
  const animated =
    entity.type === 'HERO_ACTIVE' ||
    !!entity.sprite;

  // PORTAL — сам div и есть кликабельная зона (sprite=null, ShaderOutlineWrapper не нужен).
  // Остальные интерактивные — клик/ховер внутри ShaderOutlineWrapper, outer-div = pointer-events:none.
  const wrappedSprite =
    interactive && !isBg && sprite != null
      ? (
        <ShaderOutlineWrapper
          enabled={interactive}
          animated={animated}
          hitbox={entity.hitbox}
          onClick={() => onClick(entity)}
        >
          {sprite}
        </ShaderOutlineWrapper>
      )
      : sprite;

  const isPortalClickable = isPortal && interactive;

  return (
    <div
      style={{
        ...baseStyle,
        filter: lockedFilter,
        pointerEvents: isPortalClickable ? 'auto' : 'none',
        cursor: isPortalClickable ? 'pointer' : undefined,
      }}
      onClick={isPortalClickable ? () => onClick(entity) : undefined}
      data-entity-id={entity.id}
    >
      {isPortal && interactive && entity.payload?.label && (
        <ActionLabel>{entity.payload.label}</ActionLabel>
      )}
      {locked && entity.minSectorRequired && (
        <LockedBadge minSector={entity.minSectorRequired} />
      )}
      {notify && !locked && <NotifierBadge hint={notify.hint} />}
      {wrappedSprite}
    </div>
  );
});

/**
 * Главный мета-экран: Таверна-Хаб.
 *
 * Props:
 *  - activeParty:    [{ id, name, sprite?, assetUrl? }, ...] (до 3) — отображаются в HERO_ACTIVE слотах.
 *  - recruitsPool:   [{ id, sprite?, assetUrl? }, ...] — данные потенциальных наёмников.
 *  - currentSector:  number — текущий мета-прогресс, используется для блокировок (minSectorRequired).
 *  - onAction:         (payload, entity) => void — generic-диспетчер кликов (карта, бармен, и т.п.).
 *  - onOpenHeroInventory: (heroPayload) => void — выделенный маршрут в инвентарь героя
 *    (срабатывает при клике на HERO_ACTIVE у барной стойки). Намеренно отдельный проп,
 *    а не ветка onAction — ключевой UX-поток не должен растворяться в generic-диспетчере.
 */
export default function TavernHubScreen({
  activeParty = [],
  recruitsPool = [],
  currentSector = 1,
  onAction,
  onOpenHeroInventory,
  // Триггер диалога при входе (по умолчанию — обычная болтовня посетителей)
  // и необязательный колбэк его завершения для линейных историй.
  entryDialogueTrigger = 'TAVERN_ENTER',
  onEntryDialogueComplete,
  // Сюжетный ночной скрипт (например, Незнакомец после 2-й смерти): если задан,
  // играет при открытии двери НОЧЬЮ вместо случайной ночной истории.
  nightScript = null,
  onNightScriptComplete,
  // Незнакомца впустили: он перманентно занимает место посетителя за столом.
  strangerInTavern = false,
  // Скелет-поручитель появляется после обязательной ночи первой смерти.
  // Активный атлас означает: есть новое поручение или готовая награда.
  taskMasterVisible = false,
  taskMasterActive = false,
  // Отдых отряда — контролируемое состояние из App: экран таверны размонтируется
  // на оверлеях (например, реванш карты из ночной награды), и локальный флаг
  // терял бы засчитанную ночёвку.
  hasRested = false,
  onRested,
  // Нотификаторы над сущностями: { [entityId]: { hint } } — рендерятся поверх
  // спрайта пульсирующим «!».
  notifications = null,
}) {
  // ─── Ночное событие: машина состояний времени суток ───────────────────
  // 'DAY' → (клик «Отдохнуть») → 'NIGHT_SPLASH' → (сплеш дочитан) → 'NIGHT_KNOCKING'
  // → (лестница = сбежать спать) → fade → 'DAY' + hasRested.
  const [tavernTimeState, setTavernTimeState] = useState('DAY');
  const [activeScript, setActiveScript] = useState(null); // ветвящийся диалог (ночной гость)
  const [fadeVeil, setFadeVeil] = useState(null); // null | 'in' | 'out' — чёрная вуаль переходов
  const fadeTimersRef = useRef([]);
  useEffect(() => () => fadeTimersRef.current.forEach(clearTimeout), []);

  const isNight = tavernTimeState === 'NIGHT_KNOCKING';

  // Y-sort + фильтр времени суток:
  //   - ночью (фаза стука) таверна пустеет — прячем посетителей и героев;
  //   - visibleWhen: 'DAY' | 'NIGHT' — сущности одного времени суток
  //     (например, два состояния двери: door_day открыта / door_night закрыта).
  const sortedEntities = useMemo(
    () => TAVERN_ENTITIES
      .filter(e => !isNight || !NIGHT_HIDDEN_ENTITY_TYPES.includes(e.type))
      .filter(e => !e.visibleWhen || e.visibleWhen === (isNight ? 'NIGHT' : 'DAY'))
      .filter(e => e.id !== 'npc_task_master' || taskMasterVisible)
      // Незнакомец в таверне: атлас stranger.png (4×4 idle, курит трубку)
      // вместо посетителя за центральным столом (позиция/масштаб не меняются).
      .map((e) => {
        if (strangerInTavern && e.id === 'visitor_cloaked_center') {
          return {
            ...e,
            sprite: { url: './assets/tavern/stranger.png', cols: 4, rows: 4, frameCount: 16, fps: 4 },
            colorize: STRANGER_COLORIZE,
            flipX: false,
          };
        }
        if (e.id === 'npc_task_master') {
          return {
            ...e,
            sprite: {
              ...e.sprite,
              url: taskMasterActive
                ? './assets/tavern/task_master.webp'
                : './assets/tavern/task_master_inactive.webp',
            },
          };
        }
        return e;
      })
      .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    [isNight, strangerInTavern, taskMasterVisible, taskMasterActive]
  );

  // ─── Диалоговая система: фундамент триггеров ──────────────────────────
  // activeDialogue — { triggerId, queue } текущего триггера (null = диалогов нет).
  // fireDialogueTrigger('ANY_TRIGGER') — единственная точка входа; новые триггеры
  // (клик по герою, idle-таймер и т.п.) добавляются одной строкой вызова.
  const [activeDialogue, setActiveDialogue] = useState(null);
  const fireDialogueTrigger = useCallback((triggerId) => {
    const queue = getDialogueForTrigger(triggerId);
    if (queue.length) setActiveDialogue({ triggerId, queue });
  }, []);

  // Триггер входа: КАЖДЫЙ вход в таверну (на маунт) — история из entryDialogueTrigger.
  // Небольшая задержка — сцена успевает смонтировать спрайты-якоря.
  useEffect(() => {
    const t = setTimeout(() => fireDialogueTrigger(entryDialogueTrigger), 400);
    return () => clearTimeout(t);
  }, [fireDialogueTrigger, entryDialogueTrigger]);

  const handleDialogueComplete = useCallback(() => {
    const finished = activeDialogue;
    setActiveDialogue(null);
    // Колбэк завершения — только для диалога входа (сюжетные события App).
    if (finished?.triggerId === entryDialogueTrigger) onEntryDialogueComplete?.(finished.triggerId);
  }, [activeDialogue, entryDialogueTrigger, onEntryDialogueComplete]);

  // ─── Система сна: обязательный отдых перед выходом в поход ────────────
  // hasRested приходит из App и сбрасывается при выходе в поход.
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [toast, setToast] = useState(null); // { id, text } — id перезапускает CSS-анимацию
  const toastTimerRef = useRef(null);
  const toastIdRef = useRef(0);
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  const showToast = useCallback((text) => {
    toastIdRef.current += 1;
    setToast({ id: toastIdRef.current, text });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2000);
  }, []);

  // ─── Кто придёт этой ночью ────────────────────────────────────────────
  // Гость роллится ОДИН раз — при открытии модалки сна — и живёт до рассвета:
  // отмена и повторное открытие модалки не перекатывают обязательного гостя.
  // night === null — ночь ещё не разыграна; night.script === null — тихая ночь.
  const [night, setNight] = useState(null);
  const [nightIntent, setNightIntent] = useState(null); // 'sleep' | 'listen'
  const tonight = night?.script ?? null;
  const isMandatoryNight = !!tonight?.mandatory;
  // Не скипаемый гость: сбежать по лестнице из фазы стука нельзя.
  const canEscapeNight = !tonight || (tonight.escapable !== false && !tonight.mandatory);

  // Текст сплеша зависит от выбора и от того, кто (не) пришёл этой ночью.
  const nightSplashText = nightIntent === 'sleep'
    ? (tonight ? NIGHT_SPLASH_TEXTS.sleepMissed : NIGHT_SPLASH_TEXTS.sleepQuiet)
    : (tonight ? NIGHT_SPLASH_TEXTS.listenVisitor : NIGHT_SPLASH_TEXTS.listenQuiet);

  const openSleepModal = () => {
    // Сюжетный гость (nightScript) имеет приоритет над случайным роллом.
    if (!night) setNight({ script: nightScript || pickWeightedScript(NIGHT_VISITOR_SCRIPTS) || null });
    setShowSleepModal(true);
  };

  // «Спать до утра»: сон без стука. Если гость всё же собирался прийти —
  // он уйдёт ни с чем, игрок узнает об этом только из текста сплеша.
  const sleepUntilMorning = () => {
    if (isMandatoryNight) return;
    setShowSleepModal(false);
    setNightIntent('sleep');
    setTavernTimeState('NIGHT_SPLASH');
  };

  // «Прислушаться к ночи»: прежний поток — стук, подсказка бармена, дверь.
  const listenToNight = () => {
    setShowSleepModal(false);
    setNightIntent('listen');
    setTavernTimeState('NIGHT_SPLASH');
  };

  // Побег «обратно в кровать»: чёрная вуаль наплывает, ночь безопасно
  // сворачивается (стук прекращается), отряд считается отдохнувшим.
  // Флаг-страж: ночь сворачивается ровно один раз, даже если END_NIGHT_SLEEP
  // и завершение скрипта прилетят подряд.
  const nightEndingRef = useRef(false);
  const goBackToBed = useCallback(() => {
    if (nightEndingRef.current) return;
    nightEndingRef.current = true;
    // Отдых фиксируем сразу, а не в таймере вуали: команда награды ночного гостя
    // может открыть оверлей карты и размонтировать таверну вместе с таймерами.
    onRested?.();
    setFadeVeil('in');
    fadeTimersRef.current.push(setTimeout(() => {
      setTavernTimeState('DAY');
      // Ночь разыграна — следующий сон роллит гостя заново. Сбрасываем под
      // вуалью: раньше сменился бы текст ещё видимого сплеша.
      setNight(null);
      setNightIntent(null);
      setActiveDialogue(null);
      setActiveScript(null);
      setFadeVeil('out');
      nightEndingRef.current = false;
      fadeTimersRef.current.push(setTimeout(() => setFadeVeil(null), 700));
    }, 700));
  }, [onRested]);

  // Сплеш дочитан. «Спать до утра» и тихая ночь ведут прямо в рассвет,
  // «прислушаться» с гостем — в фазу стука: бармен рассказывает мини-историю
  // про того, кто за дверью (ролл из BARKEEP_WARNINGS, якорь — npc_bartender).
  const handleNightSplashComplete = useCallback(() => {
    if (nightIntent === 'sleep' || !tonight) { goBackToBed(); return; }
    setTavernTimeState('NIGHT_KNOCKING');
    setTimeout(() => {
      const queue = getBarkeepHint('UNKNOWN_VISITOR');
      if (queue.length) setActiveDialogue({ triggerId: 'NIGHT_KNOCK_BARKEEP', queue });
    }, 500);
  }, [nightIntent, tonight, goBackToBed]);

  // ─── Ветвящиеся диалог-скрипты (система Yarn-like, см. docs/dialogue-authoring.md) ──
  // Диспетчер внешних команд скрипта. Локальные (ночь/тосты) исполняем здесь,
  // остальные (награды, спавн...) поднимаем в App через onAction — единый канал
  // DIALOGUE_COMMAND, чтобы новые команды не требовали правок таверны.
  const handleScriptCommand = useCallback((cmd) => {
    switch (cmd.type) {
      case 'END_NIGHT_SLEEP':
        goBackToBed();
        break;
      case 'SHOW_TOAST':
        showToast(cmd.text ?? '');
        break;
      default:
        onAction?.({ action: 'DIALOGUE_COMMAND', command: cmd });
        break;
    }
  }, [goBackToBed, showToast, onAction]);

  const startNightVisitorScript = useCallback(() => {
    if (!tonight) return;
    setActiveDialogue(null); // линейная болтовня (бармен) уступает сцену скрипту
    setActiveScript(tonight);
  }, [tonight]);

  const handleScriptComplete = useCallback(() => {
    const wasNightScript = !!nightScript && activeScript === nightScript;
    setActiveScript(null);
    // Сюжетный ночной скрипт закончился — App снимает pending-флаг
    // (следующей ночью за дверью снова случайный гость).
    if (wasNightScript) onNightScriptComplete?.(nightScript.id);
    // Страховка от концовки без END_NIGHT_SLEEP: ночь всё равно сворачивается
    // (у не скипаемого гостя лестница закрыта — иначе игрок запрётся в ночи).
    // Повторный вызов безопасен: goBackToBed защищён флагом-стражем.
    goBackToBed();
  }, [activeScript, nightScript, onNightScriptComplete, goBackToBed]);

  const handleClick = (entity) => {
    if (!entity.interactive) return;
    if (entity.minSectorRequired && currentSector < entity.minSectorRequired) return;

    // ─── Ночная фаза стука: свои маршруты для лестницы и двери ──────────
    if (isNight) {
      // Лестница → сбежать спать: ночь сворачивается, отдых засчитан.
      // Не скипаемый гость побега не допускает — он дождётся разговора.
      if (entity.payload?.action === 'OPEN_SLEEP_MODAL') {
        if (!canEscapeNight) {
          showToast('Он не уйдёт, пока вы не откроете');
          return;
        }
        goBackToBed();
        return;
      }
      // Дверь → экран ночной встречи (диалог с гостем играет прямо на нём).
      if (entity.payload?.action === 'OPEN_MAP') {
        startNightVisitorScript();
        return;
      }
      return; // прочие сущности ночью не активны
    }

    // HERO_ACTIVE → выделенный маршрут в Hero Inventory. payload содержит slot/действие.
    if (entity.type === 'HERO_ACTIVE') {
      const hero = activeParty?.[entity.slotIndex] ?? null;
      onOpenHeroInventory?.({ ...entity.payload, slotIndex: entity.slotIndex, hero });
      return;
    }

    // Лестница → модалка сна (локальное состояние таверны, App не участвует).
    if (entity.payload?.action === 'OPEN_SLEEP_MODAL') {
      openSleepModal();
      return;
    }

    // Дверь → карта: заблокирована, пока отряд не отдохнул.
    if (entity.payload?.action === 'OPEN_MAP' && !hasRested) {
      showToast('Вы еще не отдохнули!');
      return;
    }

    onAction?.(entity.payload, entity);
  };

  // ────────────────────────────────────────────────────────────────────────
  // Геометрия сцены — единый холст 3200×1800, масштаб от высоты (ScreenStage).
  // ────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0" style={{ zIndex: 9000 }}>
    {/* z-index выше боевого HUD — Таверна целиком перекрывает игру. */}
    {/* aspectRatio = пропорция bg_base (1024/529): весь холст шире 16∶9,
        object-cover фона совпадает с контейнером — края не режутся.
        fill — визуальный скейл сцены; scale сущностей в конфиге не меняется. */}
    <ScreenStage fill={0.8203125} aspectRatio={TAVERN_STAGE_RATIO}>
        {sortedEntities.map((entity) => {
          const locked = !!(entity.minSectorRequired && currentSector < entity.minSectorRequired);
          return (
            <TavernEntity
              key={entity.id}
              entity={entity}
              locked={locked}
              activeParty={activeParty}
              recruitsPool={recruitsPool}
              notify={isNight ? null : (notifications?.[entity.id] ?? null)}
              onClick={handleClick}
            />
          );
        })}

        {/* Ночная тонировка сцены: холодный полумрак поверх спрайтов, под UI.
            pointer-events: none — клики по лестнице/двери проходят насквозь. */}
        {isNight && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
            style={{
              zIndex: 180,
              background: 'linear-gradient(180deg, rgba(8,12,30,0.55) 0%, rgba(4,6,16,0.65) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
        )}

        {/* Плавающие «Тук-тук» у двери — кто-то снаружи */}
        {isNight && <KnockEffects />}
    </ScreenStage>

      {/* Диалоги: экран-агностик оверлей, якорится к DOM-узлам спикеров сам */}
      {activeDialogue && (
        <DialogueOverlay
          lines={activeDialogue.queue}
          onComplete={handleDialogueComplete}
        />
      )}

      {/* Модалка сна (лестница): проспать ночь, встретить её или отменить */}
      {showSleepModal && (
        <SleepModal
          onSleep={sleepUntilMorning}
          onListen={listenToNight}
          onCancel={() => setShowSleepModal(false)}
          sleepDisabled={isMandatoryNight}
          sleepHint={isMandatoryNight ? 'Кто-то ждёт у двери — этой ночью не уснуть' : ''}
        />
      )}

      {/* Ночной сплеш: медленный fade-in, тайпрайтер, строгий прогресс-лок */}
      {tavernTimeState === 'NIGHT_SPLASH' && (
        <NightSplashOverlay text={nightSplashText} onComplete={handleNightSplashComplete} />
      )}

      {/* Экран ночной встречи: открывается кликом по двери в фазе стука,
          диалог-скрипт (ночной гость) играет прямо на нём */}
      {activeScript && (
        <NightEncounterScreen
          script={activeScript}
          onCommand={handleScriptCommand}
          onComplete={handleScriptComplete}
        />
      )}

      {/* Чёрная вуаль перехода (побег в кровать): наплыв → сброс ночи → рассвет */}
      {fadeVeil && (
        <div
          className="fixed inset-0 bg-black pointer-events-none"
          style={{
            zIndex: 9800,
            animation: fadeVeil === 'in'
              ? 'tavernVeilIn 0.7s ease-in forwards'
              : 'tavernVeilOut 0.7s ease-out forwards',
          }}
        >
          <style>{`
            @keyframes tavernVeilIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes tavernVeilOut { from { opacity: 1; } to { opacity: 0; } }
          `}</style>
        </div>
      )}

      {/* Тост-предупреждение (дверь до отдыха): всплывает и тает через 2с */}
      {toast && (
        <div
          key={toast.id}
          className="fixed left-1/2 top-[18%] -translate-x-1/2 px-6 py-3 bg-red-950/90 border border-red-500/70 rounded-2xl
                     text-red-200 font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(239,68,68,0.35)]
                     pointer-events-none"
          style={{ zIndex: 9700, animation: 'tavernToastFade 2s ease-in-out forwards' }}
        >
          {toast.text}
          <style>{`@keyframes tavernToastFade { 0% { opacity: 0; transform: translate(-50%, -8px); } 12% { opacity: 1; transform: translate(-50%, 0); } 75% { opacity: 1; } 100% { opacity: 0; } }`}</style>
        </div>
      )}
    </div>
  );
}
