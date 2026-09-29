// StageBox scales logical scene pixels with CSS. Allocating a DPR-sized buffer
// from clientWidth alone can render four times more pixels than are displayed.
export function spriteRenderResolution(logicalWidth, displayWidth, dpr = 1) {
  const scale = logicalWidth > 0 && displayWidth > 0 ? displayWidth / logicalWidth : 1;
  return Math.max(0.25, Math.min(1, scale * dpr));
}

export const SPINE_RENDER_FPS = 30;
