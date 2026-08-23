const CUE_FRAME_MS = 140;

export default function EnemyDefenseCue({ targetNode, size = 64, zIndex = 8000 }) {
  const frameStyle = {
    width: size,
    height: size,
    imageRendering: 'pixelated',
    filter: 'drop-shadow(0 0 3px #38bdf8) drop-shadow(0 2px 2px rgba(0,0,0,0.9))',
  };

  return (
    <div
      className="fixed pointer-events-none"
      style={{
        left: targetNode.x,
        top: targetNode.y,
        width: size,
        height: size,
        zIndex,
      }}
      data-qte-realtime="true"
      aria-hidden="true"
    >
      <img
        src="./assets/ui/enemy-defense-cue-1.png"
        alt=""
        className="absolute inset-0"
        style={{
          ...frameStyle,
          animation: `enemyDefenseCueFrameA ${CUE_FRAME_MS * 2}ms steps(1, end) infinite`,
        }}
      />
      <img
        src="./assets/ui/enemy-defense-cue-2.png"
        alt=""
        className="absolute inset-0"
        style={{
          ...frameStyle,
          animation: `enemyDefenseCueFrameB ${CUE_FRAME_MS * 2}ms steps(1, end) infinite`,
        }}
      />
      <style>{`
        @keyframes enemyDefenseCueFrameA {
          0%, 49.99% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes enemyDefenseCueFrameB {
          0%, 49.99% { opacity: 0; }
          50%, 100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
