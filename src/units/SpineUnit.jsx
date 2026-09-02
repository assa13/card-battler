import { useEffect, useRef, useState } from 'react';
import { getSpineUnit } from './spineUnits';

const fitSpineToRenderer = (spine, renderer, contentScale = 1, offsetXRatio = 0, offsetYRatio = 0) => {
  const width = renderer.width / renderer.resolution;
  const height = renderer.height / renderer.resolution;
  const bounds = spine.getLocalBounds();
  if (!bounds.width || !bounds.height || !width || !height) return;

  const scale = Math.min(width / bounds.width, height / bounds.height) * 0.92 * contentScale;
  spine.scale.set(scale);
  spine.position.set(
    width * (0.5 + offsetXRatio) - (bounds.x + bounds.width / 2) * scale,
    height * (0.5 + offsetYRatio) - (bounds.y + bounds.height / 2) * scale,
  );
};

const movementEase = (name, progress) => {
  if (name === 'smooth') {
    return progress * progress * (3 - 2 * progress);
  }
  if (name === 'ease-in') return progress * progress;
  if (name === 'ease-out') return 1 - ((1 - progress) * (1 - progress));
  if (name === 'ease-in-out') {
    return progress < 0.5
      ? 2 * progress * progress
      : 1 - ((-2 * progress + 2) ** 2) / 2;
  }
  return progress;
};

const SpineUnit = ({
  unitId,
  animation,
  animationKey,
  animationSpeed = 1,
  animationMixMs = 0,
  loop = true,
  paused = false,
  retroFps,
  movement,
  contentScale = 1,
  contentOffsetXRatio = 0,
  contentOffsetYRatio = 0,
  className = '',
  style,
  showError = false,
  onAnimationsChange,
  onAnimationMetaChange,
  onMovementPositionChange,
  onError,
}) => {
  const hostRef = useRef(null);
  const spineRef = useRef(null);
  const pausedRef = useRef(paused);
  const fpsRef = useRef(retroFps);
  const animationRef = useRef(animation);
  const animationSpeedRef = useRef(animationSpeed);
  const loopRef = useRef(loop);
  const playbackTimingRef = useRef({
    entry: null,
    pauseRemainingMs: 0,
    pauseCompleted: false,
  });
  const movementRef = useRef({
    x: 0,
    y: 0,
    fromX: 0,
    fromY: 0,
    targetX: 0,
    targetY: 0,
    elapsedMs: 0,
    durationMs: 0,
    easing: 'linear',
    screenTargetX: null,
    screenStartX: null,
  });
  const lastAttackPositionRef = useRef(null);
  const callbacksRef = useRef({
    onAnimationsChange,
    onAnimationMetaChange,
    onMovementPositionChange,
    onError,
  });
  const [error, setError] = useState('');
  const unit = getSpineUnit(unitId);

  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { fpsRef.current = retroFps; }, [retroFps]);
  useEffect(() => {
    const current = movementRef.current;
    current.fromX = current.x;
    current.fromY = current.y;
    current.targetX = movement?.x || 0;
    current.targetY = movement?.y || 0;
    current.elapsedMs = 0;
    current.durationMs = Math.max(0, movement?.durationMs || 0);
    current.easing = movement?.easing || 'linear';
    current.screenTargetX = Number.isFinite(movement?.screenTargetX)
      ? movement.screenTargetX
      : null;
    current.screenStartX = lastAttackPositionRef.current?.x ?? null;
    if (current.durationMs === 0) {
      current.x = current.targetX;
      current.y = current.targetY;
    }
  }, [
    movement?.durationMs,
    movement?.easing,
    movement?.key,
    movement?.screenTargetX,
    movement?.x,
    movement?.y,
  ]);
  useEffect(() => {
    callbacksRef.current = {
      onAnimationsChange,
      onAnimationMetaChange,
      onMovementPositionChange,
      onError,
    };
  }, [onAnimationMetaChange, onAnimationsChange, onMovementPositionChange, onError]);

  useEffect(() => {
    animationRef.current = animation;
    animationSpeedRef.current = animationSpeed;
    loopRef.current = loop;
    const spine = spineRef.current;
    if (!spine) return;
    const nextAnimation = animation || unit?.defaultAnimation;
    const mixSeconds = Math.max(0, animationMixMs) / 1000;
    spine.state.data.defaultMix = mixSeconds;
    spine.state.timeScale = animationSpeed;
    if (nextAnimation) {
      const entry = spine.state.setAnimation(0, nextAnimation, loop);
      if (entry) entry.mixDuration = mixSeconds;
    }
  }, [animation, animationKey, animationMixMs, animationSpeed, loop, unit]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !unit) return undefined;

    let cancelled = false;
    let resizeObserver;
    let accumulatedSeconds = 0;
    let app;
    let movementBone;
    let attackTargetBone;

    (async () => {
      try {
        // Pixi и Spine нужны только боссам и админ-витрине. Динамический импорт
        // не утяжеляет начальный игровой бандл до появления такого юнита.
        const [{ Application, Assets }, { Spine }] = await Promise.all([
          import('pixi.js'),
          import('@pixi-spine/all-3.8'),
        ]);
        if (cancelled) return;

        app = new Application({
          antialias: true,
          autoDensity: true,
          backgroundAlpha: 0,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
        });
        app.view.style.width = '100%';
        app.view.style.height = '100%';
        app.view.style.display = 'block';
        host.replaceChildren(app.view);

        const resize = () => {
          if (!host.clientWidth || !host.clientHeight || cancelled) return;
          app.renderer.resize(host.clientWidth, host.clientHeight);
          if (spineRef.current) {
            fitSpineToRenderer(
              spineRef.current,
              app.renderer,
              contentScale,
              contentOffsetXRatio,
              contentOffsetYRatio,
            );
          }
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();

        const resource = await Assets.load({
          src: unit.skeletonUrl,
          data: { spineAtlasFile: unit.atlasUrl },
        });
        if (cancelled) return;

        const spine = new Spine(resource.spineData);
        spine.autoUpdate = false;
        spineRef.current = spine;
        app.stage.addChild(spine);

        const animations = resource.spineData.animations.map((item) => item.name);
        callbacksRef.current.onAnimationsChange?.(animations);
        callbacksRef.current.onAnimationMetaChange?.(
          resource.spineData.animations.map((item) => ({
            name: item.name,
            duration: item.duration,
          })),
        );
        const firstAnimation = animationRef.current || unit.defaultAnimation || animations[0];
        spine.state.data.defaultMix = Math.max(0, animationMixMs) / 1000;
        spine.state.timeScale = animationSpeedRef.current;
        if (firstAnimation) spine.state.setAnimation(0, firstAnimation, loopRef.current);
        spine.update(0);
        movementBone = unit.movementBone
          ? spine.skeleton.findBone(unit.movementBone)
          : null;
        attackTargetBone = unit.attackTargetBone
          ? spine.skeleton.findBone(unit.attackTargetBone)
          : null;
        if (movementBone) {
          const applyAnimationState = spine.state.apply.bind(spine.state);
          let appliedOffsetX = 0;
          let appliedOffsetY = 0;
          spine.state.apply = (skeleton) => {
            // Убираем добавку прошлого кадра. Некоторые участки Idle/Attack
            // не ключуют translate BoneDragon, и без этого update(0) снова
            // прибавлял тот же offset, быстро унося весь скелет влево.
            movementBone.x -= appliedOffsetX;
            movementBone.y -= appliedOffsetY;
            const result = applyAnimationState(skeleton);
            const motion = movementRef.current;
            const renderScale = Math.max(0.0001, Math.abs(spine.scale.x));
            // Внешнее движение добавляется ПОСЛЕ таймлайна Attack1/Attak2, но
            // ДО updateWorldTransform и пересчёта мешей внутри spine.update().
            // Поэтому анимация BoneDragon больше не может обнулить staging.
            appliedOffsetX = (motion.x / renderScale) * (unit.movementDirectionX || 1);
            appliedOffsetY = (motion.y / renderScale) * (unit.movementDirectionY || 1);
            movementBone.x += appliedOffsetX;
            movementBone.y += appliedOffsetY;
            return result;
          };
        }
        fitSpineToRenderer(
          spine,
          app.renderer,
          contentScale,
          contentOffsetXRatio,
          contentOffsetYRatio,
        );

        app.ticker.add(() => {
          if (pausedRef.current || !spineRef.current) return;
          const elapsedMs = app.ticker.elapsedMS;
          accumulatedSeconds += elapsedMs / 1000;
          const fps = fpsRef.current || unit.retroFps || 12;
          const step = 1 / Math.max(1, fps);
          let animationDelta = 0;
          if (accumulatedSeconds >= step) {
            const elapsedSteps = Math.floor(accumulatedSeconds / step);
            accumulatedSeconds -= elapsedSteps * step;
            animationDelta = elapsedSteps * step;
          }

          const trackEntry = spine.state.getCurrent(0);
          const playbackTiming = playbackTimingRef.current;
          if (playbackTiming.entry !== trackEntry) {
            playbackTiming.entry = trackEntry;
            playbackTiming.pauseRemainingMs = 0;
            playbackTiming.pauseCompleted = false;
          }

          const playback = unit.animationPlayback?.[trackEntry?.animation?.name];
          const baseSpeed = Math.max(0, animationSpeedRef.current);
          let pauseAfterUpdate = false;
          let freezeMovement = false;
          if (!playback || playbackTiming.pauseCompleted) {
            spine.state.timeScale = baseSpeed;
          } else if (playbackTiming.pauseRemainingMs > 0) {
            freezeMovement = true;
            playbackTiming.pauseRemainingMs = Math.max(
              0,
              playbackTiming.pauseRemainingMs - elapsedMs,
            );
            spine.state.timeScale = 0;
            animationDelta = 0;
            if (playbackTiming.pauseRemainingMs === 0) {
              playbackTiming.pauseCompleted = true;
            }
          } else {
            const sourceFps = Math.max(1, playback.sourceFps || 30);
            const slowdownStart = playback.slowdownStartFrame / sourceFps;
            const pauseAt = playback.pauseFrame / sourceFps;
            const trackTime = trackEntry?.trackTime || 0;

            if (trackTime >= pauseAt) {
              freezeMovement = true;
              trackEntry.trackTime = pauseAt;
              playbackTiming.pauseRemainingMs = playback.pauseMs;
              spine.state.timeScale = 0;
              animationDelta = 0;
            } else if (trackTime >= slowdownStart && animationDelta > 0) {
              const progress = Math.min(
                1,
                (trackTime - slowdownStart) / Math.max(0.0001, pauseAt - slowdownStart),
              );
              // sqrt-кривая даёт равномерное торможение во времени и при этом
              // достигает нужного кадра, не застревая перед ним асимптотически.
              const speedScale = Math.max(0.05, Math.sqrt(1 - progress));
              const effectiveSpeed = baseSpeed * speedScale;
              spine.state.timeScale = effectiveSpeed;
              const remainingTrackTime = pauseAt - trackTime;
              if (effectiveSpeed > 0 && animationDelta * effectiveSpeed >= remainingTrackTime) {
                animationDelta = remainingTrackTime / effectiveSpeed;
                pauseAfterUpdate = true;
              }
            } else {
              spine.state.timeScale = baseSpeed;
            }
          }

          const motion = movementRef.current;
          if (!freezeMovement && motion.durationMs > 0 && motion.elapsedMs < motion.durationMs) {
            motion.elapsedMs = Math.min(motion.durationMs, motion.elapsedMs + elapsedMs);
            const progress = movementEase(motion.easing, motion.elapsedMs / motion.durationMs);
            motion.x = motion.fromX + (motion.targetX - motion.fromX) * progress;
            motion.y = motion.fromY + (motion.targetY - motion.fromY) * progress;
          }

          if (movementBone) {
            // update(0) не продвигает анимацию, но заново применяет текущее
            // внешнее смещение кости к слотам и мешам.
            spine.update(animationDelta);
            const hostRect = host.getBoundingClientRect();
            const rendererWidth = app.renderer.width / app.renderer.resolution;
            const rendererHeight = app.renderer.height / app.renderer.resolution;
            const screenScaleX = hostRect.width / Math.max(1, rendererWidth);
            const screenScaleY = hostRect.height / Math.max(1, rendererHeight);
            const getAttackPosition = () => {
              if (!attackTargetBone) return null;
              const matrix = attackTargetBone.matrix;
              const tipX = unit.attackTargetBoneTip
                ? (attackTargetBone.data?.length || 0) * (matrix?.a || 0)
                : 0;
              const tipY = unit.attackTargetBoneTip
                ? (attackTargetBone.data?.length || 0) * (matrix?.b || 0)
                : 0;
              return {
                x: hostRect.left
                  + (
                    spine.position.x
                    + (attackTargetBone.worldX + tipX) * spine.scale.x
                  ) * screenScaleX,
                y: hostRect.top
                  + (
                    spine.position.y
                    + (attackTargetBone.worldY + tipY) * spine.scale.y
                  ) * screenScaleY,
              };
            };
            let attackPosition = getAttackPosition();
            if (
              attackPosition
              && motion.screenTargetX !== null
              && motion.durationMs > 0
            ) {
              if (motion.screenStartX === null) {
                motion.screenStartX = attackPosition.x;
              }
              const progress = movementEase(
                motion.easing,
                Math.min(1, motion.elapsedMs / motion.durationMs),
              );
              const desiredX = motion.screenStartX
                + (motion.screenTargetX - motion.screenStartX) * progress;
              const motionScreenScaleX = (unit.movementDirectionX || 1)
                * Math.sign(spine.scale.x || 1)
                * screenScaleX;
              motion.x += (desiredX - attackPosition.x) / motionScreenScaleX;
              spine.update(0);
              attackPosition = getAttackPosition();
            }
            lastAttackPositionRef.current = attackPosition;
            callbacksRef.current.onMovementPositionChange?.({
              x: hostRect.left
                + (spine.position.x + movementBone.worldX * spine.scale.x)
                  * screenScaleX,
              y: hostRect.top
                + (spine.position.y + movementBone.worldY * spine.scale.y)
                  * screenScaleY,
              attackX: attackPosition?.x,
              attackY: attackPosition?.y,
              offsetX: motion.x,
              offsetY: motion.y,
            });
          } else if (animationDelta > 0) {
            spine.update(animationDelta);
          }
          if (pauseAfterUpdate && trackEntry) {
            trackEntry.trackTime = playback.pauseFrame / Math.max(1, playback.sourceFps || 30);
            playbackTiming.pauseRemainingMs = playback.pauseMs;
            spine.state.timeScale = 0;
          }
        });
      } catch (loadError) {
        if (cancelled) return;
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setError(message);
        callbacksRef.current.onError?.(loadError);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      spineRef.current = null;
      app?.destroy(true, { children: true, texture: false, baseTexture: false });
    };
  }, [animationMixMs, contentOffsetXRatio, contentOffsetYRatio, contentScale, unit]);

  if (!unit) return showError ? <p className="text-xs text-red-400">Неизвестный Spine-юнит: {unitId}</p> : null;

  return (
    <div ref={hostRef} className={className} style={{ position: 'relative', width: '100%', height: '100%', ...style }}>
      {showError && error && (
        <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};

export default SpineUnit;
