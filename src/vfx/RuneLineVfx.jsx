import { useEffect, useRef } from 'react';

import { RUNE_LINE_VFX } from './vfxCatalog';

const RuneLineVfx = ({ start, end, scale = 1 }) => {
  const imageRef = useRef(null);
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
  const frameHeight = RUNE_LINE_VFX.frameHeight * scale * 1.5;

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return undefined;

    const frameMs = 1000 / RUNE_LINE_VFX.fps;
    let frame = 0;
    let accumulated = 0;
    let lastTime = performance.now();
    let animationFrame = 0;

    const tick = (now) => {
      const elapsed = Math.min(100, now - lastTime);
      lastTime = now;
      accumulated += elapsed;

      if (accumulated >= frameMs) {
        const advance = Math.floor(accumulated / frameMs);
        accumulated -= advance * frameMs;
        frame += advance;
        if (frame >= RUNE_LINE_VFX.frameCount) {
          image.style.visibility = 'hidden';
          return;
        }
        image.style.transform = `translate3d(0, -${frame * frameHeight}px, 0)`;
      }

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [frameHeight]);

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: start.x,
        top: start.y,
        width: length,
        height: frameHeight,
        overflow: 'hidden',
        transform: `translateY(-50%) rotate(${angle}deg)`,
        transformOrigin: 'left center',
        filter: 'drop-shadow(0 0 16px rgba(96,165,250,0.95))',
      }}
    >
      <img
        ref={imageRef}
        src={RUNE_LINE_VFX.url}
        alt=""
        draggable={false}
        className="block max-w-none select-none"
        style={{
          width: length,
          height: frameHeight * RUNE_LINE_VFX.frameCount,
          imageRendering: 'pixelated',
          willChange: 'transform',
        }}
      />
    </div>
  );
};

export default RuneLineVfx;
