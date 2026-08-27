import { useState } from 'react';
import { CardTiltContext } from './cardTilt';

/**
 * Слот карты с 3D-наклоном за курсором, бликом по кромке и подъёмом на ховере.
 * Общий для старой вёрстки боя и экрана на холсте.
 *
 * globalShake — тряска экрана: слот подхватывает её вместе со всей сценой,
 * иначе на ударе он один стоял бы неподвижно.
 *
 * tilt — внешнее состояние наклона (см. useCardTilt). Если оно передано, свою
 * мышь обёртка не слушает: на холсте её ловит плоский слой поверх слота.
 */
const TiltWrapper = ({ children, className, isDisabled, globalShake = { x: 0, y: 0, rot: 0 }, tilt }) => {
  const [ownRotation, setOwnRotation] = useState({ x: 0, y: 0 });
  const [ownGlare, setOwnGlare] = useState({ x: 50, y: 50, opacity: 0 });
  const [ownHovered, setOwnHovered] = useState(false);

  const controlled = Boolean(tilt);
  const rotation = controlled ? tilt.rotation : ownRotation;
  const glare = controlled ? tilt.glare : ownGlare;
  const isHovered = controlled ? tilt.isHovered : ownHovered;

  const handleMouseMove = (e) => {
    if (isDisabled) return;
    const card = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - card.left;
    const y = e.clientY - card.top;
    const centerX = card.width / 2;
    const centerY = card.height / 2;

    const rotateX = ((centerY - y) / centerY) * 16;
    const rotateY = ((x - centerX) / centerX) * 16;

    setOwnRotation({ x: rotateX, y: rotateY });
    setOwnGlare({ x: (x / card.width) * 100, y: (y / card.height) * 100, opacity: 0.18 });
  };

  const handleMouseEnter = () => { if (!isDisabled) setOwnHovered(true); };
  const handleMouseLeave = () => { setOwnHovered(false); setOwnRotation({ x: 0, y: 0 }); setOwnGlare(prev => ({ ...prev, opacity: 0 })); };

  const borderMask = {
    WebkitMaskImage: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
    WebkitMaskComposite: 'xor',
    maskComposite: 'exclude',
    padding: '3px',
  };

  return (
    <CardTiltContext.Provider value={{ x: rotation.x, y: rotation.y, isHovered: isHovered && !isDisabled }}>
    <div
      className={`relative ${className}`}
      onMouseMove={controlled ? undefined : handleMouseMove}
      onMouseEnter={controlled ? undefined : handleMouseEnter}
      onMouseLeave={controlled ? undefined : handleMouseLeave}
      style={{
        transform: `scale(${isHovered && !isDisabled ? 1.14 : 1}) translate(${globalShake.x * 0.5}px, ${globalShake.y * 0.5}px)`,
        transition: 'transform 200ms cubic-bezier(0.22, 1, 0.36, 1)',
        transformStyle: 'preserve-3d',
        zIndex: isHovered ? 50 : 1,
      }}
    >
      <div
        className="relative w-full h-full"
        style={{
          transform: `perspective(1000px) rotateX(${rotation.x + globalShake.rot}deg) rotateY(${rotation.y + globalShake.rot}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
      <div
        className="absolute -inset-[2px] pointer-events-none rounded-2xl z-50 transition-opacity duration-300"
        style={{
          ...borderMask,
          opacity: isHovered ? 1 : 0,
          background: `radial-gradient(220px circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,${glare.opacity}) 0%, rgba(255,255,255,${glare.opacity * 0.3}) 40%, transparent 100%)`,
        }}
      />
      <div
        className="absolute -inset-[12px] pointer-events-none rounded-3xl z-40 transition-opacity duration-500"
        style={{
          opacity: isHovered ? 0.15 : 0,
          background: `radial-gradient(180px circle at ${glare.x}% ${glare.y}%, rgba(255,255,255,0.2) 0%, transparent 100%)`,
          filter: 'blur(15px)',
        }}
      />
      {children}
      </div>
    </div>
    </CardTiltContext.Provider>
  );
};

export default TiltWrapper;
