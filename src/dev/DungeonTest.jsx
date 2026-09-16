import App from '../App.jsx';
import DungeonMap from './DungeonMap.jsx';
import { generateDungeon } from './dungeonGenerator.js';
import { createDungeonRun, dungeonRunReducer } from './dungeonInteraction.js';

const dungeonTools = {
  Map: DungeonMap,
  generate: generateDungeon,
  createRun: createDungeonRun,
  reducer: dungeonRunReducer,
};

export default function DungeonTest() {
  return <App dungeonMode dungeonTools={dungeonTools} />;
}
