export const SKELETON_BOSS_NAME = 'Костяной Король';

export const SKELETON_BOSS_PATTERN = Object.freeze({
  id: 'false_death',
  label: 'Ложная смерть',
  allPerfectStunRemaining: 2,
  phases: Object.freeze([
    Object.freeze({
      id: 'detached_hand',
      label: 'Оторванная рука',
      target: 'front',
      preDelayMs: 0,
      launchMs: 260,
      closeInMs: 300,
      gapMs: 90,
      damageScale: 0.22,
      vfxScale: 0.8,
    }),
    Object.freeze({
      id: 'rib_volley',
      label: 'Рёберный залп',
      target: 'rear',
      preDelayMs: 0,
      launchMs: 190,
      closeInMs: 250,
      gapMs: 75,
      damageScale: 0.22,
      vfxScale: 1,
    }),
    Object.freeze({
      id: 'skull_bite',
      label: 'Укус черепа',
      target: 'middle',
      preDelayMs: 0,
      launchMs: 140,
      closeInMs: 220,
      gapMs: 0,
      damageScale: 0.22,
      vfxScale: 1.15,
    }),
    Object.freeze({
      id: 'reassembly',
      label: 'Ложная смерть',
      target: 'weakest',
      preDelayMs: 650,
      launchMs: 120,
      closeInMs: 300,
      gapMs: 0,
      damageScale: 0.5,
      vfxScale: 1.45,
      isFinisher: true,
    }),
  ]),
});

export const resolveSkeletonBossTarget = (targetRule, players) => {
  const alive = players.filter((player) => player.hp > 0);
  if (alive.length === 0) return null;

  if (targetRule === 'rear') return alive[alive.length - 1];
  if (targetRule === 'middle') return alive[Math.floor(alive.length / 2)];
  if (targetRule === 'weakest') {
    return alive.reduce((weakest, player) => (
      player.hp < weakest.hp ? player : weakest
    ));
  }
  return alive[0];
};
