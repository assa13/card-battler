import { useState } from 'react';
import AtlasSprite from './AtlasSprite';
import ScreenStage from './ScreenStage';
import StageBox from './ui/StageBox';
import NineSlice from './ui/NineSlice';
import UiSprite from './ui/UiSprite';
import SmallIconText from './ui/SmallIconText';
import GameIcon from './ui/GameIcon';
import useStageSpace from './ui/useStageSpace';
import RarityWash from './ui/RarityWash';
import { getItemIconUrl, ITEM_RARITIES } from './itemSystem';
import { getTaskRewardItem } from './taskMasterSystem';
import { getCardIconUrl } from './config/cardIcons';
import './TavernScreens.css';

const ACTIVE_SPRITE = { url: './assets/tavern/task_master.webp', cols: 4, rows: 4, frameCount: 16, fps: 4 };
const INACTIVE_SPRITE = { ...ACTIVE_SPRITE, url: './assets/tavern/task_master_inactive.webp' };
const PANEL = { x: 1440, y: 140, width: 1650, height: 1520 };
const INSET = 132;
const CONTENT = PANEL.width - INSET * 2;

const objectiveText = (quest) => {
  switch (quest.key) {
    case 'recover_lost_rite': return `Победить в ${quest.target} боях`;
    case 'bones_for_relic': return `Победить ${quest.target} врагов`;
    case 'prove_your_hand': return `Разыграть ${quest.target} карт`;
    case 'feed_the_embers': return `Одержать ${quest.target} победы`;
    default: return quest.description || quest.title;
  }
};

function Reward({ quest, onItemHover, onItemLeave }) {
  const { reward } = quest;
  const item = reward.type === 'item' ? getTaskRewardItem(reward, quest.id) : null;
  const card = reward.card;
  const icon = item ? getItemIconUrl(item.icon) : reward.type === 'card' ? getCardIconUrl(card) : null;
  const label = item ? item.name : reward.type === 'gold' ? `${reward.amount} золота`
    : reward.type === 'embers' ? `${reward.amount} огонька души` : card?.name || 'Новая карта герою';
  return (
    <button type="button" className="quest-reward relative" aria-label={`Награда: ${label}`}
      onMouseEnter={event => item && onItemHover(item, event)} onMouseLeave={onItemLeave}
      onFocus={event => item && onItemHover(item, event)} onBlur={onItemLeave}
      style={{ width: 158, height: 158 }}>
      <UiSprite name="item_slot" width={158} height={158}>
        {item && <RarityWash color={(ITEM_RARITIES[item.rarity] || ITEM_RARITIES.COMMON).color} inset={12} radius={0} />}
        {icon ? <img src={icon} alt="" draggable={false} style={{ position: 'absolute', inset: 18, width: 122, height: 122, objectFit: 'contain', imageRendering: item ? 'pixelated' : 'auto' }} />
          : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 64 }}>
            {reward.type === 'gold' || reward.type === 'embers'
              ? <GameIcon name={reward.type === 'gold' ? 'coin' : 'ember'} size={116} />
              : <SmallIconText>{reward.icon || '🃏'}</SmallIconText>}
          </span>}
      </UiSprite>
      <span style={{ position: 'absolute', top: 162, left: -12, right: -12, fontSize: 26, textAlign: 'center', color: '#fffdcc', whiteSpace: 'nowrap' }}>
        {reward.type === 'gold' || reward.type === 'embers' ? `+${reward.amount}` : reward.type === 'item' ? 'ПРЕДМЕТ' : 'НОВАЯ КАРТА'}
      </span>
      {!item && <span role="tooltip" className="quest-reward-tip">
        <strong>{label}</strong>
        {card && <span style={{ display: 'block', color: '#a8a8aa', marginTop: 8 }}>Мана: {card.cost} · {card.description || 'Добавьте карту в колоду героя.'}</span>}
      </span>}
    </button>
  );
}

function QuestRow({ quest, index, onClaim, onItemHover, onItemLeave }) {
  const ready = quest.status === 'completed';
  const claimed = quest.status === 'claimed';
  const progress = Math.min(quest.target, Math.max(0, quest.progress));
  const ratio = quest.target > 0 ? Math.min(1, progress / quest.target) : 0;
  return (
    <div style={{ position: 'relative', width: CONTENT, height: 242, color: '#fffdcc', opacity: claimed ? 0.6 : 1 }}>
      <NineSlice name="icon_bg" width={CONTENT} height={242} style={{ position: 'absolute', inset: 0, filter: ready ? 'brightness(1.15)' : undefined }} />
      <div style={{ position: 'absolute', left: 42, top: 29, width: 715 }}>
        <p style={{ color: ready ? '#9fc98a' : '#aa9572', fontSize: 25, lineHeight: 1 }}>{claimed ? 'НАГРАДА ПОЛУЧЕНА' : ready ? 'ЗАДАНИЕ ВЫПОЛНЕНО' : `ПОРУЧЕНИЕ ${String(index + 1).padStart(2, '0')}`}</p>
        <h2 style={{ fontSize: 39, lineHeight: 1.1, marginTop: 12, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{quest.title}</h2>
        <p className="tavern-muted" style={{ fontSize: 29, marginTop: 8 }}>{objectiveText(quest)}</p>
        <div role="progressbar" aria-label={objectiveText(quest)} aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={progress}
          style={{ position: 'relative', marginTop: 15, width: 680, height: 38 }}>
          <NineSlice name="PB_empty" width={680} height={38} />
          {ratio > 0 && <div style={{ position: 'absolute', left: 18, top: 11, width: 644 * ratio, height: 16, overflow: 'hidden' }}>
            <NineSlice name="PB" width={644} height={16} />
          </div>}
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 26, textShadow: '0 3px #000' }}>{progress} / {quest.target}</span>
        </div>
      </div>
      <div style={{ position: 'absolute', left: 835, top: 24 }}><Reward quest={quest} onItemHover={onItemHover} onItemLeave={onItemLeave} /></div>
      <div style={{ position: 'absolute', right: 38, top: 66, width: 300, height: 110 }}>
        {ready ? <button type="button" onClick={() => onClaim(quest.id)} className="relative transition-transform hover:scale-105 active:scale-95" style={{ width: 300, height: 110 }}>
          <NineSlice name="button_red" width={300} height={110} />
          <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 34, color: '#fffdcc' }}>ЗАБРАТЬ</span>
        </button> : <div style={{ height: 110, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
          <span style={{ color: claimed ? '#9fc98a' : '#aa9572', fontSize: 34 }}><SmallIconText>{claimed ? '✓' : '⏳'}</SmallIconText></span>
          <span style={{ color: claimed ? '#9fc98a' : '#a8a8aa', fontSize: 27 }}>{claimed ? 'ПОЛУЧЕНО' : 'ВЫПОЛНЯЕТСЯ'}</span>
        </div>}
      </div>
    </div>
  );
}

export default function TaskMasterScreen({ state, onClose, onClaim, renderItemTooltip }) {
  const space = useStageSpace();
  const headerOffset = space.canvasSize(10);
  const [hovered, setHovered] = useState(null);
  const quests = state?.quests || [];
  const readyCount = quests.filter(quest => quest.status === 'completed').length;
  const hasWork = quests.some(quest => quest.status !== 'claimed');
  const showItem = (item, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setHovered({ item, x: event.clientX ?? rect.right, y: event.clientY ?? rect.top });
  };
  return (
    <div className="tavern-ui fixed inset-0 z-[9460] bg-black" onPointerDown={event => event.stopPropagation()}>
      <ScreenStage backgroundColor="#000" stageStyle={{ backgroundColor: '#000' }}>
        <div style={{ position: 'absolute', left: '4.375%', top: '17.1%', height: '65.78%', aspectRatio: '1' }}>
          <AtlasSprite sprite={hasWork ? ACTIVE_SPRITE : INACTIVE_SPRITE} alt="Поручитель" />
        </div>
        <StageBox x={290} y={1370} width={1010} height={200} zIndex={20}>
          <NineSlice name="header" width={1010} height={95} />
          <p style={{ position: 'absolute', top: 12, width: 1010, textAlign: 'center', fontSize: 54, color: '#fffdcc' }}>ДОЛГ ПЕРЕД МЁРТВЫМИ</p>
          <p className="tavern-muted" style={{ marginTop: 24, fontSize: 36, textAlign: 'center', lineHeight: 1.25 }}>{readyCount ? 'Вы заслужили плату. Заберите награду.' : hasWork ? 'Поручения выполняются во время похода.' : 'Возвращайтесь после следующего ночлега.'}</p>
        </StageBox>
        <StageBox {...PANEL} zIndex={30}>
          <section aria-label="Задания поручителя" style={{ position: 'relative', width: PANEL.width, height: PANEL.height, color: '#fffdcc', textShadow: '0 3px #000' }}>
            <NineSlice name="location_frame" width={PANEL.width} height={PANEL.height} />
            <NineSlice name="header" width={1200} height={110} style={{ position: 'absolute', left: 225, top: -55 + headerOffset }} />
            <h1 style={{ position: 'absolute', top: -45 + headerOffset, width: PANEL.width, textAlign: 'center', fontSize: 70 }}>ЗАДАНИЯ</h1>
            <button type="button" onClick={onClose} aria-label="Закрыть задания" style={{ position: 'absolute', right: 82, top: 68, width: 72, height: 72, fontSize: 34 }}><SmallIconText>✕</SmallIconText></button>
            <div style={{ position: 'absolute', left: INSET + 18, right: INSET + 18, top: 211, display: 'flex', justifyContent: 'space-between', fontSize: 32 }}>
              <span className="tavern-muted">{hasWork ? 'Выполняются автоматически в походе' : 'Все поручения завершены'}</span>
              <span style={{ color: readyCount ? '#9fc98a' : '#aa9572' }}>{readyCount ? `Наград готово: ${readyCount}` : `Поручений: ${quests.filter(q => q.status !== 'claimed').length}`}</span>
            </div>
            <div style={{ position: 'absolute', left: INSET, top: 285, width: CONTENT, height: 1060, overflowY: quests.length > 4 ? 'auto' : 'visible', overflowX: 'visible', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {quests.map((quest, index) => <div key={quest.id} style={{ flexShrink: 0 }}><QuestRow quest={quest} index={index} onClaim={onClaim} onItemHover={showItem} onItemLeave={() => setHovered(null)} /></div>)}
              {!quests.length && <div style={{ marginTop: 250, textAlign: 'center', padding: 70, fontSize: 44, lineHeight: 1.5 }}>
                <p style={{ color: '#9fc98a' }}>Все долги уплачены</p>
                <p className="tavern-muted" style={{ fontSize: 34, marginTop: 20 }}>Отдохните в таверне. Утром поручитель приготовит новые задания.</p>
              </div>}
            </div>
            <p className="tavern-muted" style={{ position: 'absolute', left: INSET, right: INSET, top: 1390, textAlign: 'center', fontSize: 29 }}>Наведите на награду, чтобы узнать подробности.</p>
          </section>
        </StageBox>
      </ScreenStage>
      {hovered && renderItemTooltip?.(hovered)}
    </div>
  );
}
