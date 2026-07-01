import React, { useEffect, useRef, useState } from 'react';
import { createAlphaOutlineRenderer, hexToRgba01 } from './gpu/alphaOutlinePipeline';

/**
 * Обёртка вокруг интерактивных спрайтов сцены Таверны.
 *
 * РЕЖИМЫ:
 *  - WebGPU alpha-outline (outline-only пасс, см. alphaOutlinePipeline.js).
 *    Активируется для статичных одиночных <img>.
 *  - CSS fallback (drop-shadow по DOM-альфе) для анимированных атласов / без WebGPU.
 *
 * Структура (важно для геометрии):
 *  <div inline-block h-full>
 *    [canvas, absolute inset:0, z=0]
 *    <div h-full, z=1>{children}</div>
 *    [hitbox-overlay, absolute, pointer-events:auto]
 *  </div>
 *
 *  - inline-block + height:100% дают «width=intrinsic от детей», что не ломает
 *    aspect-ratio спрайтов внутри shrink-to-fit absolute родителя (TavernEntity).
 *  - hitbox-overlay — единственная зона, ловящая click/hover. ВСЁ ОСТАЛЬНОЕ
 *    в обёртке имеет pointer-events:none. Это и есть «хитбокс по картинке, а не
 *    по фрейму спрайта»: размер хитбокса задаётся декларативно сверху.
 *
 * PROPS:
 *  - children:  один спрайт (img / atlas div). Размер диктует обёртку.
 *  - enabled:   глобальный выключатель эффекта.
 *  - animated:  атлас? → принудительный CSS fallback.
 *  - color:     HEX обводки.
 *  - thickness: толщина обводки в пикселях входной текстуры (по спеке).
 *  - hitbox:    {left,top,width,height} в % от bbox обёртки. Дефолт — узкая
 *               вертикальная полоса в центре (под пиксель-арт-персонажей).
 *  - onClick:   handler клика по хитбоксу.
 *  - hoverScale: scale-фактор на hover (вместо Tailwind hover:scale-).
 */
const DEFAULT_HITBOX = { left: '30%', top: '10%', width: '40%', height: '85%' };

const ShaderOutlineWrapper = ({
  children,
  enabled = true,
  animated = false,
  color = '#fbbf24',
  thickness = 3,
  hitbox = DEFAULT_HITBOX,
  onClick,
  hoverScale = 1.04,
}) => {
  const [hovered, setHovered] = useState(false);
  const [shaderReady, setShaderReady] = useState(false);
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (animated || !enabled) return undefined;
    if (typeof navigator === 'undefined' || !navigator.gpu) return undefined;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    let cancelled = false;
    let renderer = null;
    let imgEl = null;
    let loadHandler = null;
    let resizeObserver = null;
    let lastBitmap = null;

    const uploadAndRender = async () => {
      if (cancelled || !renderer) return;
      const img = container.querySelector('img');
      if (!img) return;
      imgEl = img;
      if (!img.complete || img.naturalWidth === 0) {
        loadHandler = () => uploadAndRender();
        img.addEventListener('load', loadHandler, { once: true });
        return;
      }

      let bitmap;
      try {
        bitmap = await createImageBitmap(img, { premultiplyAlpha: 'premultiply' });
      } catch {
        return;
      }
      if (cancelled) { bitmap.close?.(); return; }
      lastBitmap?.close?.();
      lastBitmap = bitmap;

      const rect = img.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.max(1, Math.ceil(rect.width  * dpr));
      canvas.height = Math.max(1, Math.ceil(rect.height * dpr));

      renderer.uploadTexture(bitmap, bitmap.width, bitmap.height);
      renderer.render({
        inputW: bitmap.width,
        inputH: bitmap.height,
        outlineColor: hexToRgba01(color, 1),
        thickness,
      });
      setShaderReady(true);
    };

    (async () => {
      renderer = await createAlphaOutlineRenderer(canvas);
      if (cancelled || !renderer) return;
      await uploadAndRender();

      const img = container.querySelector('img');
      if (img && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!lastBitmap) return;
          const r = img.getBoundingClientRect();
          const dpr2 = window.devicePixelRatio || 1;
          canvas.width  = Math.max(1, Math.ceil(r.width  * dpr2));
          canvas.height = Math.max(1, Math.ceil(r.height * dpr2));
          renderer?.render({
            inputW: lastBitmap.width,
            inputH: lastBitmap.height,
            outlineColor: hexToRgba01(color, 1),
            thickness,
          });
        });
        resizeObserver.observe(img);
      }
    })();

    return () => {
      cancelled = true;
      if (imgEl && loadHandler) imgEl.removeEventListener('load', loadHandler);
      resizeObserver?.disconnect();
      lastBitmap?.close?.();
      renderer?.destroy?.();
      setShaderReady(false);
    };
  }, [animated, enabled, color, thickness]);

  // Fallback drop-shadow для атласов/без WebGPU/пока шейдер не готов.
  const useFallback = (!shaderReady) && enabled && hovered;
  const fallbackFilter = useFallback
    ? `drop-shadow(0 0 ${thickness}px ${color})
       drop-shadow(0 0 ${thickness * 2}px ${color})
       drop-shadow(0 0 ${thickness * 4}px rgba(251,191,36,0.45))`
    : 'none';

  const showCanvas = shaderReady && enabled && hovered;
  const scale = enabled && hovered ? hoverScale : 1;

  return (
    <div
      ref={containerRef}
      className="relative inline-block align-top"
      style={{
        height: '100%',
        // pointer-events:none — клики/ховер ловит ТОЛЬКО hitbox-overlay ниже.
        pointerEvents: 'none',
        filter: fallbackFilter,
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        transition: 'filter 120ms ease-out, transform 150ms ease-out',
        willChange: shaderReady ? 'transform' : 'filter, transform',
      }}
      data-shader-outline-mode={shaderReady ? 'webgpu' : (animated ? 'css-animated' : 'css')}
      data-shader-outline-active={(showCanvas || useFallback) ? 'true' : 'false'}
    >
      {/* Canvas СНИЗУ под children — содержит outline-only композит. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          width: '100%',
          height: '100%',
          opacity: showCanvas ? 1 : 0,
          transition: 'opacity 80ms linear',
          imageRendering: 'pixelated',
          zIndex: 0,
        }}
      />

      {/* Children в нормальном потоке — задают bbox обёртки. */}
      <div className="relative" style={{ height: '100%', zIndex: 1 }}>
        {children}
      </div>

      {/* Hitbox: единственная кликабельная зона. % от bbox обёртки. */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
        className="absolute cursor-pointer"
        style={{
          left: hitbox.left,
          top: hitbox.top,
          width: hitbox.width,
          height: hitbox.height,
          pointerEvents: 'auto',
          zIndex: 2,
        }}
        data-tavern-hitbox="true"
      />
    </div>
  );
};

export default ShaderOutlineWrapper;
