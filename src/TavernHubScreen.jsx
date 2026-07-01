import React, { useEffect, useMemo, useState } from 'react';
import { TAVERN_ENTITIES, TAVERN_PADDING_PX, TAVERN_STAGE_RATIO } from './TavernSceneConfig';
import ShaderOutlineWrapper from './ShaderOutlineWrapper';

// Анимированный спрайт по атласу. Если атлас не задан — просто <img>.
// Намеренно изолирован от глобального CharSprite, чтобы Таверна не зависела от App.jsx.
const TavernSprite = React.memo(({ sprite, assetUrl, alt = '' }) => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!sprite) return;
    const fps = sprite.fps || 10;
    const id = setInterval(() => setFrame(f => (f + 1) % sprite.frameCount), 1000 / fps);
    return () => clearInterval(id);
  }, [sprite]);

  if (!sprite) {
    return (
      <img
        src={assetUrl}
        alt={alt}
        draggable={false}
        className="w-auto h-full block select-none"
        style={{ imageRendering: 'pixelated' }}
        onError={(e) => { e.currentTarget.style.opacity = 0; }}
      />
    );
  }
  const col = frame % sprite.cols;
  const row = Math.floor(frame / sprite.cols);
  return (
    <div className="h-full aspect-square overflow-hidden relative">
      <img
        src={sprite.url}
        alt={alt}
        draggable={false}
        className="block max-w-none absolute top-0 left-0 select-none"
        style={{
          height: `${sprite.rows * 100}%`,
          width: `${sprite.cols * 100}%`,
          transform: `translate(${-col * (100 / sprite.cols)}%, ${-row * (100 / sprite.rows)}%)`,
          imageRendering: 'pixelated',
        }}
        onError={(e) => { e.currentTarget.style.opacity = 0; }}
      />
    </div>
  );
});

const LockedBadge = ({ minSector }) => (
  <div
    className="absolute left-1/2 -top-3 -translate-x-1/2 px-2 py-0.5 text-[10px] font-black uppercase
               tracking-wider rounded bg-black/85 text-amber-300 border border-amber-500/60 pointer-events-none"
    style={{ zIndex: 200 }}
  >
    🔒 Сектор {minSector}+
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
      return <TavernSprite sprite={hero.sprite} assetUrl={hero.assetUrl} alt={hero.name} />;
    }
    case 'HERO_RECRUIT': {
      const recruit = recruitsPool?.find?.(r => r.id === entity.recruitId);
      return <TavernSprite sprite={recruit?.sprite} assetUrl={recruit?.assetUrl || entity.assetUrl} alt={entity.id} />;
    }
    default:
      return <TavernSprite sprite={entity.sprite} assetUrl={entity.assetUrl} alt={entity.id} />;
  }
};

const TavernEntity = React.memo(function TavernEntity({ entity, locked, activeParty, recruitsPool, onClick }) {
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
  }

  const interactive = entity.interactive && !locked;
  const cursor = interactive ? 'cursor-pointer' : 'cursor-default';
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
 *  - onOpenPrepScreen: (heroPayload) => void — выделенный маршрут на экран подготовки к бою
 *    (срабатывает при клике на HERO_ACTIVE у барной стойки). Намеренно отдельный проп,
 *    а не ветка onAction — ключевой UX-поток не должен растворяться в generic-диспетчере.
 */
export default function TavernHubScreen({
  activeParty = [],
  recruitsPool = [],
  currentSector = 1,
  onAction,
  onOpenPrepScreen,
}) {
  // Y-sort: сортируем один раз (конфиг статичен).
  const sortedEntities = useMemo(
    () => [...TAVERN_ENTITIES].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
    []
  );

  const handleClick = (entity) => {
    if (!entity.interactive) return;
    if (entity.minSectorRequired && currentSector < entity.minSectorRequired) return;

    // HERO_ACTIVE → выделенный маршрут на PrepScreen. payload содержит slot/действие.
    if (entity.type === 'HERO_ACTIVE') {
      const hero = activeParty?.[entity.slotIndex] ?? null;
      onOpenPrepScreen?.({ ...entity.payload, slotIndex: entity.slotIndex, hero });
      return;
    }

    onAction?.(entity.payload, entity);
  };

  // ────────────────────────────────────────────────────────────────────────
  // ЗАМОРОЗКА ГЕОМЕТРИИ (Cinematic Letterbox), масштаб сцены = 0.75 от макс.
  //   height = 0.75 * min(viewportH - pad, (viewportW - pad) * 9/16)
  // Это ЕДИНСТВЕННЫЙ источник размера. Ширина высчитывается через aspect-ratio.
  // Дети сцены расположены в % от сцены — относительные позиции и пропорции
  // между объектами сохраняются при любом ресайзе окна.
  // ────────────────────────────────────────────────────────────────────────
  const SCENE_SCALE = 0.75;
  const sceneHeight =
    `min(calc((100vh - ${TAVERN_PADDING_PX}px) * ${SCENE_SCALE}),` +
    ` calc((100vw - ${TAVERN_PADDING_PX}px) * ${SCENE_SCALE} / ${TAVERN_STAGE_RATIO}))`;

  return (
    // КИНОЛЕТТЕРБОКС: корень — 100vw x 100vh, чёрный, центрирует сцену.
    // z-index выше боевого HUD и оверлеев — Таверна целиком перекрывает игру.
    <div
      className="fixed inset-0 w-screen h-screen bg-black flex items-center justify-center overflow-hidden"
      style={{ zIndex: 9000 }}
    >
      {/* СЦЕНА: строгое 16:9, размер — ЭКСКЛЮЗИВНО по min()-формуле выше. */}
      {/* overflow НЕ скрываем: дети-визитёры около краёв (visitor_cloaked_back_right
          и пр.) уезжают на 1–2% за bbox сцены и при clip получают «срез/сплющ». */}
      <div
        className="relative shadow-[0_0_60px_rgba(0,0,0,0.9)]"
        style={{
          aspectRatio: String(TAVERN_STAGE_RATIO),
          height: sceneHeight,
          backgroundColor: '#0a0608',
        }}
      >
        {sortedEntities.map((entity) => {
          const locked = !!(entity.minSectorRequired && currentSector < entity.minSectorRequired);
          return (
            <TavernEntity
              key={entity.id}
              entity={entity}
              locked={locked}
              activeParty={activeParty}
              recruitsPool={recruitsPool}
              onClick={handleClick}
            />
          );
        })}
      </div>
    </div>
  );
}
