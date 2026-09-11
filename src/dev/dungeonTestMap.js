// Square cells exported from Figma 328:5193; coordinates retain the supplied layout.
export const ATLAS_URL = './assets/dev/dungeon/figma-crypt.png?v=cracked-wall-e-20260911';
export const FIGMA_URL = 'https://www.figma.com/design/zG9zihyiBTJFjR5dVta74Z/card-crawler?node-id=328-5193';
export const SOURCE_TILE = 82;
export const TILE = 41;
export const BACKGROUND = '#3b3955';
export const ATLAS_COLUMNS = 11;
export const ATLAS_ROWS = 8;

// Every entry selects an entire 82×82 tile. Wall orientation is part of the art.
export const SPRITES = {
  nookNW: [1, 0], wallN: [2, 0], nookNE: [3, 0],
  wallW: [1, 1], wallE: [3, 1],
  outerNW: [0, 2], nookJoinW: [1, 2], nookJoinE: [3, 2], outerNE: [4, 2],
  brokenN: [9, 2], brokenNE: [10, 2],
  pillarTopW: [0, 3],
  passageNW: [4, 3], stairsN: [5, 3], passageNE: [6, 3], brokenE: [10, 3],
  pillarW: [0, 4], crate: [2, 4], pillarE: [10, 4],
  wallLowerW: [0, 5],
  passageSW: [4, 5], stairsS: [5, 5], passageSE: [6, 5], wallLowerE: [10, 5],
  outerSW: [0, 6], wallS: [1, 6], door: [2, 6], outerSE: [4, 6],
  CRACKED_wall_E: [8, 6],              // 325:5138 — direct layer export, no rotation
  brokenFloorS: [9, 6], brokenSE: [10, 6],
  baseW: [0, 7], base: [1, 7], baseE: [4, 7], brokenBaseE: [10, 7],
  // Author's Figma layer names are semantic: shadow tiles belong beside walls,
  // never among random interior floor variants. IDs preserve the source mapping.
  floor: [2, 5],                       // 325:5151 — floor
  floor_shadow_N: [2, 3],              // 315:5038 — floor_shadow_N
  floor_shadow_NW: [1, 3],             // 322:4892 — floor_shadow_NW
  floor_shadow_NE: [3, 3],             // 322:4891 — floor_shadow_NE
  floor_shadow_W: [1, 4],              // 323:5087 — floor_shadow_W
  floor_shadow_E: [3, 5],              // 325:5150 — floor_shadow_E
  floor_shadow_NW_alcove: [2, 1],      // 323:5067 — floor_shadow_NW (alcove crop)
};

// Explicit courses preserve the Figma joins, including the separate south base.
// '.' is empty space. This scene intentionally has no inferred/rotated walls.
export const LEVEL = [
  '. . nookNW wallN nookNE . . . . . . . .',
  '. . wallW floor_shadow_NW_alcove wallE . . . . . . . .',
  'outerNW wallN nookJoinW wallN nookJoinE wallN outerNE . outerNW wallN wallN brokenN brokenNE',
  'pillarTopW floor_shadow_NW floor_shadow_N floor_shadow_N floor_shadow_N floor_shadow_NE passageNW stairsN passageNE floor_shadow_NW floor_shadow_N floor_shadow_NE brokenE',
  'pillarW floor_shadow_W floor floor floor floor floor_shadow_N floor_shadow_N floor_shadow_N floor floor floor_shadow_E pillarE',
  'wallLowerW floor_shadow_W floor crate floor floor floor floor floor floor floor floor_shadow_E wallLowerE',
  'wallLowerW floor_shadow_W floor floor floor floor_shadow_E passageSW stairsS passageSE floor_shadow_W floor floor_shadow_E wallLowerE',
  'wallLowerW floor_shadow_W floor floor floor floor_shadow_E wallE . wallLowerW floor_shadow_W floor floor_shadow_E wallLowerE',
  'outerSW wallS wallS door wallS wallS outerSE . outerSW wallS CRACKED_wall_E brokenFloorS brokenSE',
  'baseW base base base base base baseE . baseW base base base brokenBaseE',
].map(row => row.split(' '));
export const COLS = LEVEL[0].length;
export const ROWS = LEVEL.length;

// A second layout using the same square atlas cells and the same 13×10 canvas.
// Plain floor fills the gallery; the named shadow variants stay at its edges.
const TWIN_CRYPT = [
  '. . nookNW wallN nookNE . . . nookNW wallN nookNE . .',
  '. . wallW floor_shadow_NW_alcove wallE . . . wallW floor_shadow_NW_alcove wallE . .',
  'outerNW wallN nookJoinW wallN nookJoinE wallN wallN wallN nookJoinW wallN nookJoinE wallN outerNE',
  'pillarTopW floor_shadow_NW floor_shadow_N floor_shadow_N floor_shadow_N floor_shadow_N floor_shadow_N floor_shadow_N floor_shadow_N floor_shadow_N floor_shadow_N floor_shadow_NE wallE',
  'pillarW floor_shadow_W floor floor floor floor floor floor floor floor floor floor_shadow_E pillarE',
  'wallLowerW floor_shadow_W floor crate floor floor floor floor floor crate floor floor_shadow_E wallE',
  'wallLowerW floor_shadow_W floor floor floor floor floor floor floor floor floor floor_shadow_E wallE',
  'wallLowerW floor_shadow_W floor floor floor floor crate floor floor floor floor floor_shadow_E wallE',
  'outerSW wallS wallS door wallS wallS wallS wallS wallS door wallS wallS outerSE',
  'baseW base base base base base base base base base base base baseE',
].map(row => row.split(' '));

export const LEVELS = [
  {
    id: 'cold-crypt',
    title: 'Холодный склеп',
    description: 'Два зала, переход и северная ниша.',
    tiles: LEVEL,
  },
  {
    id: 'twin-crypt',
    title: 'Крипта близнецов',
    description: 'Широкая галерея с двумя северными нишами и парными вратами.',
    tiles: TWIN_CRYPT,
  },
];

