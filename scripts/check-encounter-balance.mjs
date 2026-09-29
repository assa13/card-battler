import assert from 'node:assert/strict';
import { getEncounterProfile, fillEncounterSquad, createHorseDamageBudget, getOnboardingHint, HORSE_COUNT } from '../src/encounterBalance.js';

for (let sector = 1; sector <= 10; sector += 1) {
  for (let stage = 0; stage <= 5; stage += 1) {
    for (const type of ['combat_easy', 'combat_medium', 'combat_hard', 'boss']) {
      const profile = getEncounterProfile(type, stage, sector);
      const represented = type === 'boss' ? 'Червь' : 'Волк';
      const squad = fillEncounterSquad([represented], ['Зомби', 'Волк'], profile.count);
      assert.equal(squad.length, profile.count);
      assert.ok(squad.includes(represented));
      assert.ok(profile.hpPower > 0 && profile.attackPower > 0);
      assert.equal(profile.count, type === 'boss' ? 1 : type === 'combat_hard' ? 4 : type === 'combat_medium' || stage >= 3 ? 3 : 2);
    }
  }
}
// Every combination of timing successes: exact base damage and <=35% QTE bonus,
// independent of success order and integer rounding, even with small damage.
for (const total of [1, 7, 8, 23, 50, 137]) {
  for (let mask = 0; mask < 2 ** HORSE_COUNT; mask += 1) {
    const next = createHorseDamageBudget(total);
    let actual = 0, successes = 0;
    for (let hit = 0; hit < HORSE_COUNT; hit += 1) {
      const active = Boolean(mask & (1 << hit));
      actual += next(active);
      successes += Number(active);
    }
    assert.equal(actual, total + Math.floor(total * 0.35 * successes / HORSE_COUNT));
    assert.equal(next(true), 0, 'No ninth hit can increase the budget');
  }
}
const hint = cards => getOnboardingHint({ wins: 1, turnState: 'player', cards, mana: 3 });
assert.ok(hint([{ cost: 0 }, { cost: 1 }, { cost: 2 }]).includes('0 → 1 → 2'));
assert.ok(!hint([{ cost: 0 }, { cost: 2 }]).includes('0 → 1 → 2'));
assert.ok(!getOnboardingHint({ wins: 1, turnState: 'player', cards: [{ cost: 0 }, { cost: 1 }, { cost: 2 }], mana: 2 }).includes('0 → 1 → 2'));
assert.equal(getOnboardingHint({ wins: 3 }), null);
console.log('Encounter counts, visible-enemy membership, all 1536 horse timing patterns and contextual hints passed.');
