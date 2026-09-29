import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { generateDungeon } from '../src/dev/dungeonGenerator.js';
import { createDungeonRun, dungeonRunReducer } from '../src/dev/dungeonInteraction.js';
import { FIRE_DURATION, naturalFireAt } from '../src/lighting/fireFlicker.js';
import { BATTLE_LIGHT_SCENE } from '../src/battle/battleLight.js';
import { computeSpriteLight } from '../src/lighting/lightModel.js';
import { spriteLightUniforms } from '../src/lighting/pixiSpriteLight.js';

const fixture = {
  tiles: [Array(7).fill('wall'), ['wall', ...Array(5).fill('floor'), 'wall']],
  entities: [{ id: 'hero', kind: 'hero', x: 1, y: 1 }],
  portals: [{ id: 'exit', kind: 'exit', x: 3, y: 0, access: { x: 3, y: 1 } }],
  coins: [{ id: 'coin', x: 3, y: 1, value: 2 }],
};
const click = (run, cell) => dungeonRunReducer(run, { type: 'click', cell });
let run = createDungeonRun(fixture);
assert.equal(click(run, fixture.portals[0]).exit, null, 'Distant exit cannot teleport');
run = click(run, { x: 5, y: 1 });
for (let i = 0; i < 4; i++) {
  run = dungeonRunReducer(run, { type: 'tick' });
  assert.equal(run.exit, null, 'Path passing an exit stays on the same map');
}
assert.equal(run.hero.x, 5);
assert.equal(run.goldCollected, 2, 'Walking still collects coins');
run = { ...run, hero: { x: 2, y: 1 } };
run = dungeonRunReducer(run, { type: 'step', dx: 1, dy: 0 });
assert.equal(run.exit, null, 'Keyboard step beside an exit does not activate it');
assert.equal(click(run, fixture.portals[0].access).exit, null, 'Access floor is not the exit');
run = click(run, fixture.portals[0]);
assert.equal(run.exit.id, 'exit', 'Click the neighboring exit tile to leave');
assert.equal(dungeonRunReducer(run, { type: 'step', dx: 1, dy: 0 }), run, 'Pending transition cannot move');
assert.equal(dungeonRunReducer(run, { type: 'consume-exit' }).exit, null);

let checked = 0;
for (let seed = 1; seed <= 40; seed++) for (const exitCount of [1, 2, 3]) {
  const level = generateDungeon(seed, { exitCount });
  for (const portal of level.portals.filter(p => p.kind === 'exit')) {
    const atExit = { ...createDungeonRun(level), hero: portal.access };
    assert.equal(click(atExit, portal.access).exit, null);
    assert.equal(click(atExit, portal).exit.id, portal.id, 'Correct branch selected');
    checked++;
  }
}
assert.equal(BATTLE_LIGHT_SCENE.sourceGain, 1.25);
assert.equal(BATTLE_LIGHT_SCENE.lightGain, .36 * 1.25);
assert.ok(BATTLE_LIGHT_SCENE.ambient < .82);
let previous = naturalFireAt(0);
for (let time = 0; time < 20; time += 1 / 120) {
  const value = naturalFireAt(time);
  assert.ok(value >= .86 && value <= 1);
  assert.ok(Math.abs(value - previous) < .015, 'No hard flicker steps');
  assert.ok(Math.abs(value - naturalFireAt(time + FIRE_DURATION)) < 1e-10, 'Continuous loop');
  previous = value;
}
for (const light of BATTLE_LIGHT_SCENE.lights) {
  const model = computeSpriteLight({ x: light.x, y: light.y }, BATTLE_LIGHT_SCENE);
  assert.ok(model.layers[0].animation.includes('sceneNaturalFire'));
  assert.equal(spriteLightUniforms(model, .3).uFlicker, naturalFireAt(.3, light.flickerOffset));
  assert.equal(spriteLightUniforms(model).uSourceGain, 1.25);
}
assert.notEqual(naturalFireAt(.3, 0), naturalFireAt(.3, 1.37), 'Torches have different phases');

const manifest = JSON.parse(await fs.readFile(new URL('../icon-atlas/navigation/manifest.json', import.meta.url), 'utf8'));
for (const [name, icon] of Object.entries(manifest.icons)) {
  const image = sharp(await fs.readFile(new URL(`../${icon.path}`, import.meta.url)));
  const meta = await image.metadata();
  assert.equal(meta.width, 32); assert.equal(meta.height, 32); assert.ok(meta.hasAlpha);
  const rgba = await image.ensureAlpha().raw().toBuffer();
  assert.ok(rgba[3] <= 1, `${name}: transparent gutter`);
  let bright = 0;
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] > 200 && Math.max(...rgba.subarray(i, i + 3)) > 150) bright++;
  assert.ok(bright > 40, `${name}: readable light silhouette`);
}
console.log(`Exit path/keyboard/click regression passed (${checked} generated exits); smooth light and nine 32px symbols passed.`);
