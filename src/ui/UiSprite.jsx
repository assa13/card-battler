import { UI_ATLAS, getSprite } from './uiAtlas';

// Цельный регион ui_atlas без разрезов. По умолчанию рисуется в натуральную
// величину; заданные width/height растягивают картинку целиком, поэтому для
// рамок нужен NineSlice, а не этот компонент.
const UiSprite = ({ name, width, height, className = '', style, children }) => {
  const sprite = getSprite(name);
  if (!sprite) {
    if (import.meta.env.DEV) console.error(`UiSprite: в ui_atlas нет спрайта «${name}».`);
    return null;
  }

  const { region } = sprite;
  const boxWidth = width ?? region.width;
  const boxHeight = height ?? region.height;
  const scaleX = boxWidth / region.width;
  const scaleY = boxHeight / region.height;

  return (
    <div
      className={className}
      style={{ position: 'relative', width: boxWidth, height: boxHeight, ...style }}
      data-ui-sprite={name}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `url(${UI_ATLAS.image})`,
          backgroundSize: `${UI_ATLAS.width * scaleX}px ${UI_ATLAS.height * scaleY}px`,
          backgroundPosition: `${-region.x * scaleX}px ${-region.y * scaleY}px`,
          imageRendering: UI_ATLAS.filtering === 'pixelated' ? 'pixelated' : 'auto',
        }}
      />
      {children}
    </div>
  );
};

export default UiSprite;
