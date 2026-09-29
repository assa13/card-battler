const FRAME_SIZE = 48;
const DISPLAY_SCALE = 5;

const sizedSheet = (url, frameSize, frameCount, fps, displayScale) => Object.freeze({
  url,
  frameSize,
  frameCount,
  fps,
  displayScale,
});
const sheet = (url, frameCount, fps = 24) => (
  sizedSheet(url, FRAME_SIZE, frameCount, fps, DISPLAY_SCALE)
);
const statusSheet = (url, frameCount, fps = 13.5) => (
  sizedSheet(url, 24, frameCount, fps, 5)
);

export const DAGGER_VFX = Object.freeze({
  projectile: sheet('./assets/vfx/dagger-03/projectile-native.webp', 5, 18),
  muzzle: sheet('./assets/vfx/dagger-03/muzzle-native.webp', 5),
  hits: Object.freeze([
    sheet('./assets/vfx/dagger-03/hit-1-native.webp', 5),
    sheet('./assets/vfx/dagger-03/hit-2-native.webp', 5),
  ]),
  hitLingerMs: 260,
});

export const FIREBALL_VFX = Object.freeze({
  projectile: sheet('./assets/vfx/fireball-05/projectile-native.webp', 5, 18),
  muzzle: sheet('./assets/vfx/fireball-05/muzzle-native.webp', 5),
  hits: Object.freeze([
    sheet('./assets/vfx/fireball-05/hit-1-native.webp', 7),
    sheet('./assets/vfx/fireball-05/hit-2-native.webp', 7),
  ]),
  hitLingerMs: 340,
});

export const ICE_SPIKE_VFX = Object.freeze({
  projectile: sheet('./assets/vfx/ice-spike-10/projectile-native.webp', 6, 18),
  muzzle: sheet('./assets/vfx/ice-spike-10/muzzle-native.webp', 8),
  hits: Object.freeze([
    sheet('./assets/vfx/ice-spike-10/hit-native.webp', 8),
  ]),
  hitLingerMs: 380,
});

export const CARD_PROJECTILE_VFX = Object.freeze({
  dagger_single: DAGGER_VFX,
  ice_spike: ICE_SPIKE_VFX,
});

export const WARRIOR_HIT_VFX = sheet('./assets/vfx/warrior-hit/hit-native.webp', 7);
export const ROGUE_HIT_VFX = sheet('./assets/vfx/rogue-hit/hit-native.webp', 7);
export const MAGE_HIT_VFX = sheet('./assets/vfx/mage-hit/hit-native.webp', 7);
export const ENEMY_HIT_VFX = sheet('./assets/vfx/enemy-hit/hit-native.webp', 6);
export const ARMOR_BUFF_VFX = statusSheet('./assets/vfx/status/armor-buff.webp', 12);
export const CHAIN_START_VFX = statusSheet('./assets/vfx/status/chain-start.webp', 11);
export const MARK_DEBUFF_VFX = statusSheet('./assets/vfx/status/mark-debuff.webp', 10);
export const BLEED_DEBUFF_VFX = statusSheet('./assets/vfx/status/bleed-debuff.webp', 9);
export const CHAIN_BUFF_VFX = statusSheet('./assets/vfx/status/chain-buff.webp', 10);
export const WORM_COUNTER_HIT_VFX = Object.freeze({
  url: './assets/vfx/worm-counter/hit-native.webp',
  frameSize: FRAME_SIZE,
  frameCount: 6,
  fps: 24,
  displayScale: 10,
});
export const RUNE_LINE_VFX = Object.freeze({
  url: './assets/vfx/rune-line/projetil-new.webp',
  frameWidth: 256,
  frameHeight: 64,
  frameCount: 7,
  fps: 24,
});

export const IMPACT_VFX_LINGER_MS = 340;
