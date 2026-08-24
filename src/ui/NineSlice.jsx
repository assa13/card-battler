import { UI_ATLAS, getSlice, getMinSize } from './uiAtlas';

// Рамка из ui_atlas по правилам 9-slice: углы рисуются один в один, левый и
// правый края тянутся только по вертикали, верхний и нижний — только по
// горизонтали, центр добирает остаток.
//
// border-image здесь не годится: он режет изображение целиком, а нам нужен
// прямоугольный регион внутри атласа. Поэтому девять абсолютных сегментов,
// каждый со своим background-size/position — так каждый сегмент сам решает,
// во сколько раз растянуть свою часть картинки.
//
// position задаётся инлайном, а не классом: Tailwind объявляет .relative после
// .absolute, поэтому класс из props проиграл бы внутреннему .relative.
const NineSlice = ({ name, width, height, className = '', style, children }) => {
  const slice = getSlice(name);
  if (!slice) {
    if (import.meta.env.DEV) console.error(`NineSlice: в ui_atlas нет 9-slice «${name}».`);
    return null;
  }

  const { region, borders, innerFill } = slice;
  const min = getMinSize(slice);
  const boxWidth = Math.max(width, min.width);
  const boxHeight = Math.max(height, min.height);
  if (import.meta.env.DEV && (boxWidth !== width || boxHeight !== height)) {
    console.warn(
      `NineSlice «${name}»: ${width}×${height} меньше минимума ${min.width}×${min.height} ` +
      '(сумма границ), размер увеличен — иначе углы налезли бы друг на друга.',
    );
  }

  // Границы сегментов: в исходнике — от края региона, на экране — от края бокса.
  const srcCols = [0, borders.left, region.width - borders.right, region.width];
  const srcRows = [0, borders.top, region.height - borders.bottom, region.height];
  const dstCols = [0, borders.left, boxWidth - borders.right, boxWidth];
  const dstRows = [0, borders.top, boxHeight - borders.bottom, boxHeight];

  const segments = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      const srcWidth = srcCols[col + 1] - srcCols[col];
      const srcHeight = srcRows[row + 1] - srcRows[row];
      const dstWidth = dstCols[col + 1] - dstCols[col];
      const dstHeight = dstRows[row + 1] - dstRows[row];
      if (srcWidth <= 0 || srcHeight <= 0 || dstWidth <= 0 || dstHeight <= 0) continue;

      const scaleX = dstWidth / srcWidth;
      const scaleY = dstHeight / srcHeight;
      segments.push(
        <div
          key={`${row}-${col}`}
          className="absolute"
          style={{
            left: dstCols[col],
            top: dstRows[row],
            width: dstWidth,
            height: dstHeight,
            backgroundImage: `url(${UI_ATLAS.image})`,
            backgroundSize: `${UI_ATLAS.width * scaleX}px ${UI_ATLAS.height * scaleY}px`,
            backgroundPosition: `${-(region.x + srcCols[col]) * scaleX}px ${-(region.y + srcRows[row]) * scaleY}px`,
            imageRendering: UI_ATLAS.filtering === 'pixelated' ? 'pixelated' : 'auto',
          }}
        />,
      );
    }
  }

  return (
    <div
      className={className}
      style={{ position: 'relative', width: boxWidth, height: boxHeight, ...style }}
      data-nine-slice={name}
    >
      <div className="pointer-events-none absolute inset-0">
        {segments}
        {innerFill && (
          <div
            className="absolute"
            style={{
              left: innerFill.x,
              top: innerFill.y,
              right: region.width - innerFill.x - innerFill.width,
              bottom: region.height - innerFill.y - innerFill.height,
              background: innerFill.color,
            }}
          />
        )}
      </div>
      {children}
    </div>
  );
};

export default NineSlice;
