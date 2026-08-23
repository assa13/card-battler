const RIPPLE_COUNT = 3;

export default function EnemyDefenseRipples({ variant, durationMs, targetNode }) {
  const isPerfect = variant === 'perfect';
  const isMiss = variant === 'miss';
  const color = isMiss
    ? 'rgba(239, 68, 68, 0.95)'
    : isPerfect
      ? 'rgba(255, 255, 255, 1)'
      : 'rgba(255, 255, 255, 0.95)';
  const glow = isMiss
    ? 'rgba(239, 68, 68, 0.95)'
    : isPerfect
      ? 'rgba(255, 255, 255, 1)'
      : 'rgba(255, 255, 255, 0.9)';
  const transparentGlow = isMiss ? 'rgba(239, 68, 68, 0)' : 'rgba(255, 255, 255, 0)';

  return (
    <div
      className="fixed pointer-events-none z-[8001]"
      style={{
        left: targetNode.x,
        top: targetNode.y,
        width: 166,
        height: 166,
        transform: 'translate(-50%, -50%)',
      }}
      data-qte-realtime="true"
      aria-hidden="true"
    >
      <div
        className="absolute rounded-full"
        style={{
          left: '50%',
          top: '50%',
          width: 150,
          height: 150,
          background: `radial-gradient(circle, ${glow} 0%, ${glow} 24%, ${transparentGlow} 72%)`,
          animation: `enemyDefenseGlow ${Math.max(40, durationMs)}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
        }}
      />
      {Array.from({ length: RIPPLE_COUNT }, (_, index) => (
        <div
          key={index}
          className="absolute rounded-full"
          style={{
            left: '50%',
            top: '50%',
            width: 48 + index * 24,
            height: 48 + index * 24,
            border: `${isPerfect ? 7 : 5}px solid ${color}`,
            boxShadow: `0 0 ${isPerfect ? 42 : 30}px ${glow}, inset 0 0 18px ${glow}`,
            animation: `enemyDefenseRipple ${Math.max(40, durationMs)}ms cubic-bezier(0.16, 1, 0.3, 1) forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes enemyDefenseRipple {
          0% {
            transform: translate(-50%, -50%) scale(0.4);
            opacity: 1;
          }
          18% {
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(4.2);
            opacity: 0;
          }
        }
        @keyframes enemyDefenseGlow {
          0% {
            transform: translate(-50%, -50%) scale(0.72);
            opacity: 1;
          }
          22% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.65);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
