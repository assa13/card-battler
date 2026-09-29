import { useMemo, useRef, useState } from 'react';
import ScreenStage from './ScreenStage';
import StageBox from './ui/StageBox';
import NineSlice from './ui/NineSlice';
import UiSprite from './ui/UiSprite';
import ShaderOutlineWrapper from './ShaderOutlineWrapper';
import { createSectorChoices, layoutSectorChoices, ROOM_SIZE } from './sectorSelection';
import { pickAlphaRoom } from './sectorAlphaHitTest';
import './SectorSelectScreen.css';

const ASSETS = './assets/sector-map/';

export default function SectorSelectScreen({ currentSector, maxSectorReached, maxSectorCompleted, onSelect, onBack }) {
  const rooms = useMemo(() => createSectorChoices(currentSector, maxSectorReached, maxSectorCompleted),
    [currentSector, maxSectorReached, maxSectorCompleted]);
  const [focusedId, setFocusedId] = useState(() => rooms.find(room => room.sector === currentSector)?.id ?? 0);
  const [expanded, setExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const lastPointer = useRef(null);
  const roomElements = useRef(new Map());
  const alphaMasks = useRef(new Map());
  const focused = rooms.find(room => room.id === focusedId) || rooms[0];
  const layout = layoutSectorChoices(rooms, focused.id, expanded);
  const hovered = layout.find(room => room.id === hoveredId);
  const tooltipHeight = (hovered?.name.length ?? 0) > 14 ? 474 : 410;
  const tooltipOnLeft = hovered && hovered.centerX + hovered.size / 2 + 14 + 514 > 3168;
  const tooltipLeft = hovered ? Math.max(32, Math.min(2654, tooltipOnLeft
    ? hovered.centerX - hovered.size / 2 - 14 - 514
    : hovered.centerX + hovered.size / 2 + 14)) : 0;
  const tooltipTop = hovered ? Math.max(240, Math.min(1768 - tooltipHeight, hovered.centerY + 31 - tooltipHeight / 2)) : 0;

  const rememberAlpha = (name, image) => {
    if (alphaMasks.current.has(name)) return;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    alphaMasks.current.set(name, context.getImageData(0, 0, canvas.width, canvas.height));
  };

  const roomAtPointer = event => {
    const candidates = layout.flatMap(room => {
      const element = roomElements.current.get(room.id);
      return element ? [{
        id: room.id, mask: alphaMasks.current.get(room.image),
        rect: element.getBoundingClientRect(),
        zIndex: room.id === focused.id ? 20 : Math.round(room.centerY / 100),
      }] : [];
    });
    const id = pickAlphaRoom(candidates, event.clientX, event.clientY);
    return rooms.find(room => room.id === id);
  };

  const hoverRoomAtPointer = event => {
    if (event.pointerType === 'touch') return;
    lastPointer.current = { clientX: event.clientX, clientY: event.clientY };
    const room = roomAtPointer(event);
    setHoveredId(room?.id ?? null);
  };

  const selectRoom = room => {
    setHoveredId(room.id);
    if (!expanded || room.id !== focused.id) { setFocusedId(room.id); setExpanded(true); return; }
    if (!room.locked) onSelect(room.sector);
  };

  return (
    <ScreenStage zIndex={9500} stageClassName="overflow-hidden" shadow={false}>
      <StageBox x={0} y={0} width={3200} height={1800}>
        <section
          className="sector-select-screen"
          aria-label="Выбор сектора"
          onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onBack(); } }}
          onPointerLeave={() => { lastPointer.current = null; setHoveredId(null); }}
        >
          <img className="sector-select-background" src={`${ASSETS}background.png`} alt="" draggable={false} />
          <div className="sector-select-rooms" role="group" aria-label="Сектора подземелья"
            style={{ cursor: hovered ? hovered.locked ? 'not-allowed' : 'pointer' : 'default' }}
            onPointerMove={hoverRoomAtPointer}
            onPointerLeave={() => { lastPointer.current = null; setHoveredId(null); }}
            onTransitionEnd={() => {
              if (lastPointer.current) setHoveredId(roomAtPointer(lastPointer.current)?.id ?? null);
            }}
            onClick={event => {
              if (event.detail === 0) return; // Keyboard activation is handled by the room button.
              const room = roomAtPointer(event);
              if (room) selectRoom(room);
            }}>
            {layout.map(room => (
              <button
                key={room.id}
                ref={element => { if (element) roomElements.current.set(room.id, element); else roomElements.current.delete(room.id); }}
                type="button"
                className="sector-select-room"
                data-sector={room.sector ?? `future-${room.id}`}
                data-sector-state={room.locked ? 'locked' : room.completed ? 'completed' : 'available'}
                data-focused={room.id === focused.id}
                data-hovered={room.id === hoveredId}
                aria-label={`${room.name}${room.sector ? `, сектор ${room.sector}` : ''}. ${room.status}`}
                aria-disabled={room.locked}
                aria-describedby={room.id === hoveredId ? 'sector-select-description' : undefined}
                onFocus={event => {
                  if (event.target.matches(':focus-visible')) { lastPointer.current = null; setHoveredId(room.id); }
                }}
                onBlur={() => { if (!lastPointer.current) setHoveredId(null); }}
                onClick={event => { if (event.detail === 0) selectRoom(room); }}
                style={{
                  left: room.centerX - ROOM_SIZE / 2, top: room.centerY - ROOM_SIZE / 2,
                  transform: `scale(${room.size / ROOM_SIZE})`,
                  filter: room.id === hoveredId ? 'none' : `blur(${room.blur}px)`,
                  opacity: room.id === hoveredId ? 1 : room.opacity,
                  zIndex: room.id === focused.id ? 20 : Math.round(room.centerY / 100),
                  cursor: room.locked ? 'not-allowed' : 'pointer',
                }}
              >
                <ShaderOutlineWrapper active={room.id === hoveredId} interactive={false} mode="svg"
                  color="#ffd900" thickness={7} hoverScale={1}>
                  <img src={`${ASSETS}${room.image}`} alt="" width={552} height={552} draggable={false}
                    onLoad={event => rememberAlpha(room.image, event.currentTarget)} />
                </ShaderOutlineWrapper>
                {room.locked ? (
                  <span className="sector-select-lock" aria-hidden="true">
                    <img src={`${ASSETS}symbols.png`} alt="" draggable={false} />
                  </span>
                ) : room.completed ? (
                  <span className="sector-select-completed" aria-hidden="true">
                    <UiSprite name="sector_map_completed_bg" width={148.401} height={148.401} />
                    <img src={`${ASSETS}completed-check.svg`} alt="" draggable={false} />
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          {/* Native SVG dimensions are preserved. The wrapper positions the exported effect. */}
          <div className="sector-select-vignette" aria-hidden="true">
            <img src={`${ASSETS}vignette.svg`} alt="" draggable={false} />
          </div>
          <button type="button" className="sector-select-back" onClick={onBack} aria-label="Назад в таверну" autoFocus>
            <UiSprite name="sector_map_back_button" width={172} height={172} />
            <UiSprite name="sector_map_back_icon" width={122} height={122} style={{ position: 'absolute', left: 25, top: 25 }} />
          </button>
          <div className="sector-select-header">
            <UiSprite name="sector_map_header" width={589} height={95} />
            <h1>Карта подземелья</h1>
          </div>
          {hovered && <div key={hovered.id} className="sector-select-tooltip" data-side={tooltipOnLeft ? 'left' : 'right'}
            style={{ left: tooltipLeft, top: tooltipTop }}
            id="sector-select-description" role="status" aria-live="polite">
            <NineSlice name="icon_bg" width={514} height={tooltipHeight}>
              <div className="sector-select-tooltip-content">
                <h2>{hovered.name}</h2>
                <p>{hovered.sector ? `Сектор ${hovered.sector}` : 'Неизведано'}</p>
                <p className="sector-select-status" data-completed={!hovered.locked && hovered.completed}>{hovered.status}</p>
                <p className="sector-select-description">{hovered.description}</p>
              </div>
            </NineSlice>
            <img className="sector-select-tooltip-pointer" src={`${ASSETS}tooltip-pointer.svg`} alt="" draggable={false} />
          </div>}
        </section>
      </StageBox>
    </ScreenStage>
  );
}
