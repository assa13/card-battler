const characters = ['hero', 'wolf', 'zombie', 'dark_wized', 'boss_skeletal_golem', 'boss_eye', 'boss_worm'];

export const ENTITY_ANIMATIONS = Object.fromEntries(characters.map(name => [name, {
  url: `./assets/dev/dungeon/animations/${name}.png`,
  cols: 3, rows: 1, frameCount: 3, fps: 3,
}]));

// A stable phase per instance keeps duplicate enemies from breathing in unison.
export function entityAnimationFrame(entity, time = null) {
  const animation = ENTITY_ANIMATIONS[entity.sprite];
  if (!animation || time == null) return 0;
  let phase = 0;
  for (const character of String(entity.id)) phase = (phase * 31 + character.charCodeAt(0)) >>> 0;
  return (Math.floor(Math.max(0, time) * animation.fps) + phase % animation.frameCount) % animation.frameCount;
}

export function entityFrameRect(sprite, width, height, frame = 0) {
  const animation = ENTITY_ANIMATIONS[sprite];
  if (!animation) return { x: 0, y: 0, width, height };
  return {
    x: (frame % animation.cols) * width / animation.cols,
    y: Math.floor(frame / animation.cols) * height / animation.rows,
    width: width / animation.cols,
    height: height / animation.rows,
  };
}
