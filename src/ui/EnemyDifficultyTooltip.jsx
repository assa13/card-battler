import { getEncounterProfile } from '../encounterBalance.js';
import './EnemyDifficultyTooltip.css';

export default function EnemyDifficultyTooltip({ name, type, stage = 1, sector = 1, hp, maxHp, nearby, align = 'center' }) {
  const profile = getEncounterProfile(type, stage, sector);
  return (
    <span role="tooltip" className={`enemy-difficulty-tooltip enemy-difficulty-tooltip--${align}`}>
      <strong>{name}</strong>
      <span style={{ color: profile.color }}>{profile.label} · {hp == null ? `Отряд: ${profile.count}` : `${hp} / ${maxHp} HP`}</span>
      <small>{hp == null
        ? nearby ? 'Рядом · нажмите, чтобы вступить в бой' : 'Подойдите вплотную, чтобы напасть'
        : 'Сложность встречи'}</small>
    </span>
  );
}
