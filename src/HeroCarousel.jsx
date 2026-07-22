import { useEffect, useState } from 'react';
import AtlasSprite from './AtlasSprite';

const HeroCarousel = ({ heroes, selectedHeroId, onSelect }) => {
  const [direction, setDirection] = useState('next');
  const selectedIndex = Math.max(0, heroes.findIndex((hero) => hero.id === selectedHeroId));
  const hero = heroes[selectedIndex];

  useEffect(() => {
    if (hero || !heroes.length) return;
    onSelect?.(heroes[0].id);
  }, [hero, heroes, onSelect]);

  if (!hero) return null;

  const switchHero = (step) => {
    setDirection(step > 0 ? 'next' : 'prev');
    onSelect?.(heroes[(selectedIndex + step + heroes.length) % heroes.length].id);
  };
  const portraitByHero = {
    p1: './assets/hero-inventory/warrior-portrait.png',
    p2: './assets/hero-inventory/rogue-portrait.png',
    p3: './assets/hero-inventory/wizard-portrait.png',
  };
  // Заглушки будущих героев (hero.locked): портрет — атлас-спрайт
  // (hero.portraitSprite, анимированный idle), затемнён и обесцвечен,
  // поверх — замок + условие открытия (hero.lockHint).
  return (
    <>
      <aside className="absolute left-0 top-0 h-full w-[30.6875%] overflow-hidden bg-black" style={{ fontFamily: "'Greybeard', sans-serif" }}>
        {hero.portraitSprite ? (
          <div
            key={hero.id}
            className={`absolute inset-0 flex items-center justify-center ${hero.locked ? 'grayscale brightness-[0.6]' : ''} hero-inventory-carousel-${direction}`}
          >
            <div className="h-[72%]">
              <AtlasSprite sprite={hero.portraitSprite} alt={hero.name} />
            </div>
          </div>
        ) : (
          <img
            key={hero.id}
            src={portraitByHero[hero.id]}
            alt={hero.name}
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover ${hero.locked ? 'grayscale brightness-50' : ''} hero-inventory-carousel-${direction}`}
          />
        )}
        {hero.locked && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/55 text-center">
            <span className="text-6xl drop-shadow-[0_0_14px_rgba(0,0,0,0.95)]">{hero.hire?.available ? '⚔' : '🔒'}</span>
            <span className="text-white" style={{ fontSize: 'clamp(20px, 2.2vw, 40px)' }}>{hero.name}</span>
            <span className="px-4 text-amber-300/90" style={{ fontSize: 'clamp(11px, 1vw, 18px)' }}>{hero.lockHint || 'Заблокировано'}</span>
            {hero.hire?.available && (
              <span className="text-amber-200 font-black" style={{ fontSize: 'clamp(14px, 1.2vw, 22px)' }}>
                🪙 {String(hero.hire.cost)}
              </span>
            )}
          </div>
        )}
      </aside>
      <div className="absolute bottom-0 left-0 z-30 flex h-[10.4%] w-full items-center border-t border-white/10 bg-black/90" style={{ fontFamily: "'Greybeard', sans-serif" }}>
        <button type="button" onClick={() => switchHero(-1)} className="flex h-full w-[5.875%] items-center justify-center" aria-label="Предыдущий герой">
          <span className="text-4xl text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.95)]">◀</span>
        </button>
        <div className="ml-[2.125%] text-[7.1vw] leading-none text-white" style={{ fontSize: 'clamp(28px, 4vw, 72px)' }}>{hero.name}{hero.locked ? ' 🔒' : ' lvl1'}</div>
        <button type="button" onClick={() => switchHero(1)} className="ml-auto flex h-full w-[5.875%] items-center justify-center" aria-label="Следующий герой">
          <span className="text-4xl text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.95)]">▶</span>
        </button>
      </div>
    </>
  );
};

export default HeroCarousel;
