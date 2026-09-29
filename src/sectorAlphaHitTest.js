// Use the source alpha, not the blurred render or its rectangular DOM bounds.
export function hitsRoomAlpha(mask, rect, clientX, clientY) {
  if (!mask || rect.width <= 0 || rect.height <= 0) return false;
  const u = (clientX - rect.left) / rect.width;
  const v = (clientY - rect.top) / rect.height;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return false;
  const x = Math.floor(u * mask.width);
  const y = Math.floor(v * mask.height);
  return mask.data[(y * mask.width + x) * 4 + 3] > 8;
}

export function pickAlphaRoom(candidates, clientX, clientY) {
  // A transparent foreground corner must let the room behind it receive input.
  return [...candidates].sort((a, b) => b.zIndex - a.zIndex || b.id - a.id)
    .find(candidate => hitsRoomAlpha(candidate.mask, candidate.rect, clientX, clientY))?.id ?? null;
}
