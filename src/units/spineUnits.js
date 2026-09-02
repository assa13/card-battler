export const WORM_BOSS_NAME = 'Червь';

export const WORM_ATTACK1_PLAYBACK = Object.freeze({
  sourceFps: 30,
  qteEndFrame: 6,
  slowdownStartFrame: 8,
  pauseFrame: 11,
  pauseMs: 300,
});

export const SPINE_UNITS = Object.freeze({
  worm: Object.freeze({
    id: 'worm',
    name: WORM_BOSS_NAME,
    skeletonUrl: './assets/units/worm/worm.json?v=4',
    atlasUrl: './assets/units/worm/worm.atlas',
    defaultAnimation: 'Idle',
    movementBone: 'BoneDragon',
    attackTargetBone: 'Jaw',
    attackTargetBoneTip: true,
    movementDirectionX: 1,
    movementDirectionY: -1,
    retroFps: 12,
    animationMixMs: 330,
    animationPlayback: Object.freeze({
      Attack1: WORM_ATTACK1_PLAYBACK,
    }),
    battleWidthScale: 2,
    battleHeightScale: 1,
    battleContentScale: 1.465,
    legacyContentScale: 2.2,
    battleContentOffsetXRatio: 0.74,
    battleContentOffsetYRatio: 0.2,
    arenaTopOverflow: 700,
    clipToArena: true,
    counterEnemyMirror: false,
  }),
});

export const getSpineUnit = (unitId) => SPINE_UNITS[unitId] || null;

export const getEnemySpineUnitId = (enemyName) => (
  enemyName === WORM_BOSS_NAME ? 'worm' : null
);
