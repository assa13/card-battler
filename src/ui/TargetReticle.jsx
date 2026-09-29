export default function TargetReticle({ damage, lethal }) {
  return <div className="relative h-full w-full pointer-events-none" aria-label={`${damage} урона${lethal ? ', добивание' : ''}`}>
    <img src={`./assets/ui/combat/target-${lethal ? 'red' : 'white'}.png`} alt=""
      className="absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated' }} />
    <span className="absolute inset-0 flex items-center justify-center font-black tabular-nums"
      style={{ fontSize: '0.28em', lineHeight: 1, color: lethal ? '#f37979' : '#f6f3e9',
        textShadow: '2px 2px 0 #080b12, -2px -2px 0 #080b12, 2px -2px 0 #080b12, -2px 2px 0 #080b12' }}>
      {damage}
    </span>
  </div>;
}
