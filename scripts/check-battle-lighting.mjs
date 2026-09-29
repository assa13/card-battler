import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { BATTLE_LIGHT_SCENE, BATTLE_LIGHT_MARKERS, computeBattleSpriteLight } from '../src/battle/battleLight.js';
import { BATTLE_LAYOUT, FIELD_ART, HERO_UNITS, ENEMY_FORMATIONS } from '../src/battle/battleLayout.js';
import { computeSpriteLight } from '../src/lighting/lightModel.js';
import { spriteLightUniforms } from '../src/lighting/pixiSpriteLight.js';
import { characterShadowBox } from '../src/lighting/groundShadow.js';
import { ENTITY_ANIMATIONS, entityAnimationFrame, entityFrameRect } from '../src/dev/dungeonAnimations.js';
import { ENTITY_URLS } from '../src/dev/dungeonGenerator.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const field = BATTLE_LAYOUT.fieldBackground;
const almost = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
assert.equal(BATTLE_LIGHT_SCENE.lights.length, 2);
assert.deepEqual(BATTLE_LIGHT_MARKERS.map(({ x, y }) => [field.x + x, field.y + y]), [[832, 226], [2362, 226]]);
for (const [index, light] of BATTLE_LIGHT_SCENE.lights.entries()) {
  almost(light.x / 100 * field.width, BATTLE_LIGHT_MARKERS[index].x);
  almost(light.y / 100 * field.height, BATTLE_LIGHT_MARKERS[index].y);
}

const first = BATTLE_LIGHT_SCENE.lights[0];
const near = computeSpriteLight({ x: first.x, y: first.y }, BATTLE_LIGHT_SCENE);
const far = computeSpriteLight({ x: 50, y: 100 }, BATTLE_LIGHT_SCENE);
assert.ok(near.gpu.brightness > far.gpu.brightness);
assert.ok(far.gpu.brightness >= BATTLE_LIGHT_SCENE.ambient);
for (const unit of [...HERO_UNITS, ...Object.values(ENEMY_FORMATIONS).flat()]) {
  const ordinary = computeBattleSpriteLight(unit);
  const mirrored = computeBattleSpriteLight(unit, { flipX: true });
  almost(ordinary.gpu.brightness, mirrored.gpu.brightness);
  almost(ordinary.gpu.direction[0], -mirrored.gpu.direction[0]);
  const shadow = characterShadowBox(unit, ordinary);
  assert.ok(shadow.width > 0 && shadow.height > 0);
  assert.equal(shadow.y, unit.y + unit.size * 0.87);
  for (const time of [0, 0.4, 1.1, 2.3, 100]) {
    const uniforms = spriteLightUniforms(ordinary, time);
    assert.ok(Object.values(uniforms).flat().every(Number.isFinite));
    assert.ok(uniforms.uFlicker >= 0.82 && uniforms.uFlicker <= 1);
  }
}
assert.equal(spriteLightUniforms(null).uBrightness, 1);
assert.equal(spriteLightUniforms(null).uLightStrength, 0);

const bg = await sharp(path.join(root, 'public', FIELD_ART.fight.url.slice(2))).metadata();
assert.equal(bg.width, 2048);
assert.equal(bg.height, 2048);
assert.ok(bg.hasAlpha);
const manifest = JSON.parse(await fs.readFile(path.join(root, 'icon-atlas/minimap/manifest.json'), 'utf8'));
assert.deepEqual(Object.keys(manifest.sprites).sort(), Object.keys(ENTITY_ANIMATIONS).sort());
for (const [name, animation] of Object.entries(ENTITY_ANIMATIONS)) {
  assert.equal(ENTITY_URLS[name], animation.url);
  const file = path.join(root, 'public', animation.url.slice(2));
  const meta = await sharp(file).metadata();
  assert.equal(meta.width, 288); assert.equal(meta.height, 96); assert.ok(meta.hasAlpha);
  const hashes = [];
  for (let frame = 0; frame < 3; frame += 1) {
    const rect = entityFrameRect(name, meta.width, meta.height, frame);
    const { data, info } = await sharp(file).extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height })
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let visible = 0;
    for (let y = 0; y < info.height; y += 1) {
      for (let x = 0; x < info.width; x += 1) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha > 0) visible += 1;
        if (x < 3 || x >= 93 || y < 3 || y >= 93) assert.equal(alpha, 0, `${name} leaks outside its frame`);
      }
    }
    assert.ok(visible > 100);
    hashes.push(createHash('sha256').update(data).digest('hex'));
  }
  assert.equal(new Set(hashes).size, 3, `${name} needs three distinct poses`);
  const entity = { id: `${name}:test`, sprite: name };
  assert.equal(entityAnimationFrame(entity, null), 0);
  const cycle = [0.01, 0.35, 0.68].map(time => entityAnimationFrame(entity, time));
  assert.equal(new Set(cycle).size, 3);
  assert.equal(entityAnimationFrame(entity, 1.01), cycle[0]);
}
console.log('Figma light positions, sprite lighting, mirrored direction, shadows, background and all 21 minimap frames passed.');
