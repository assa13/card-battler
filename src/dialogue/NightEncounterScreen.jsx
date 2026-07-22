import DialogueScriptOverlay from './DialogueScriptOverlay';
import ScreenStage from '../ScreenStage';
import AtlasSprite from '../AtlasSprite';
import { resolveEncounterGuest } from './encounterCharacters';

// Экран ночной встречи: полноэкранная «сцена разговора» с гостем за дверью.
// Компоновка — Figma фрейм `dialogue` 3721:13570 (холст 3200×1800):
//   • bg                          0,0        3200×1800 — чёрный фон
//   • LAYER / monster behind — из encounter-конфига истории (персонаж по id
//     из реестра ENCOUNTER_CHARACTERS + offset от центра холста)
//   • ART / door_window.webp   2048×2048     cx=50%,    cy=44.89%, h=113.78%
//   • shadow                   3200×745      top=58.61%, h=41.39%
//   • text_block, text_button×2 — DialogueScriptOverlay variant="plate"

const WINDOW = { left: '50%', top: '44.89%', height: '113.78%', aspectRatio: '1' };
const OPENING = { left: '27%', top: '21%', width: '46%', height: '45%' };

const NightEncounterScreen = ({ script, onCommand, onComplete }) => {
  const guest = resolveEncounterGuest(script?.encounter);

  return (
    <div
      className="fixed inset-0 select-none animate-in fade-in duration-500"
      style={{ zIndex: 9500 }}
    >
      <ScreenStage backgroundColor="#000">
        <div
          className="absolute"
          style={{
            left: guest.left,
            top: guest.top,
            height: guest.height,
            aspectRatio: '1',
            transform: `translate(-50%, -50%) scaleX(${guest.flipX ? -1 : 1})`,
            zIndex: 0,
          }}
        >
          <AtlasSprite sprite={guest.sprite} assetUrl={guest.assetUrl} alt="" />
        </div>

        <div
          className="absolute"
          style={{
            left: WINDOW.left,
            top: WINDOW.top,
            height: WINDOW.height,
            aspectRatio: WINDOW.aspectRatio,
            transform: 'translate(-50%, -50%)',
            zIndex: 1,
          }}
        >
          <img
            src="./assets/encounters/door_window.webp"
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
          <div data-entity-id="encounter_visitor" className="absolute pointer-events-none" style={OPENING} />
        </div>

        <div
          className="absolute pointer-events-none"
          style={{
            left: 0,
            right: 0,
            top: '58.61%',
            height: '41.39%',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0) 11.831%, #000000 60.845%)',
            zIndex: 2,
          }}
        />
      </ScreenStage>

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.8) 100%)' }}
      />

      <DialogueScriptOverlay
        script={script}
        onCommand={onCommand}
        onComplete={onComplete}
        variant="plate"
      />
    </div>
  );
};

export default NightEncounterScreen;
