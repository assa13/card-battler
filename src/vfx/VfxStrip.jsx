import { useEffect, useRef } from 'react';
import { qteSlowMo } from '../qteTimeScale';

const frameSubscribers = new Set();
let sharedAnimationFrame = 0;

const runSharedTicker = (now) => {
  sharedAnimationFrame = 0;
  frameSubscribers.forEach(subscriber => subscriber(now));
  if (frameSubscribers.size > 0) {
    sharedAnimationFrame = requestAnimationFrame(runSharedTicker);
  }
};

const subscribeToTicker = (subscriber) => {
  frameSubscribers.add(subscriber);
  if (!sharedAnimationFrame) {
    sharedAnimationFrame = requestAnimationFrame(runSharedTicker);
  }
  return () => {
    frameSubscribers.delete(subscriber);
    if (frameSubscribers.size === 0 && sharedAnimationFrame) {
      cancelAnimationFrame(sharedAnimationFrame);
      sharedAnimationFrame = 0;
    }
  };
};

const VfxStrip = ({
  sheet,
  loop = false,
  realTime = false,
  className = '',
  style,
  onComplete,
}) => {
  const imageRef = useRef(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!sheet || !imageRef.current) return undefined;

    const image = imageRef.current;
    const displayFrameSize = sheet.frameSize * (sheet.displayScale || 1);
    const frameMs = 1000 / sheet.fps;
    let frame = 0;
    let accumulated = 0;
    let lastTime = performance.now();
    let unsubscribe = () => {};

    image.style.transform = 'translate3d(0, 0, 0)';
    image.style.visibility = 'visible';

    const tick = (now) => {
      const elapsed = Math.min(100, now - lastTime);
      lastTime = now;
      accumulated += elapsed * (realTime ? 1 : qteSlowMo.scale);

      if (accumulated >= frameMs) {
        const advance = Math.floor(accumulated / frameMs);
        accumulated -= advance * frameMs;
        frame += advance;

        if (frame >= sheet.frameCount) {
          if (!loop) {
            image.style.visibility = 'hidden';
            unsubscribe();
            onCompleteRef.current?.();
            return;
          }
          frame %= sheet.frameCount;
        }

        image.style.transform = `translate3d(-${frame * displayFrameSize}px, 0, 0)`;
      }
    };

    unsubscribe = subscribeToTicker(tick);
    return unsubscribe;
  }, [loop, realTime, sheet]);

  if (!sheet) return null;
  const displayFrameSize = sheet.frameSize * (sheet.displayScale || 1);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: displayFrameSize,
        height: displayFrameSize,
        overflow: 'hidden',
        ...style,
      }}
    >
      <img
        ref={imageRef}
        src={sheet.url}
        alt=""
        draggable={false}
        className="block max-w-none select-none"
        style={{
          width: displayFrameSize * sheet.frameCount,
          height: displayFrameSize,
          imageRendering: 'pixelated',
          willChange: 'transform',
        }}
      />
    </div>
  );
};

export default VfxStrip;
