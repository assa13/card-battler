import { BASE_ASPECT, stageHeightCss } from './screenScale';

/**
 * Полноэкранная обёртка сцены: чёрный letterbox, по центру — холст 16∶9,
 * масштаб от высоты viewport (см. screenScale.js).
 *
 * children — контент внутри сцены (позиции в % от 3200×1800).
 */
const ScreenStage = ({
  children,
  fill,
  aspectRatio = BASE_ASPECT,
  className = '',
  style = {},
  stageClassName = '',
  stageStyle = {},
  backgroundColor = '#000',
  zIndex,
}) => (
  <div
    className={`fixed inset-0 w-screen h-screen flex items-center justify-center overflow-hidden ${className}`}
    style={{ backgroundColor, zIndex, ...style }}
  >
    <div
      className={`relative shadow-[0_0_60px_rgba(0,0,0,0.9)] ${stageClassName}`}
      style={{
        aspectRatio: String(aspectRatio),
        height: stageHeightCss(fill, aspectRatio),
        backgroundColor: '#0a0608',
        ...stageStyle,
      }}
    >
      {children}
    </div>
  </div>
);

export default ScreenStage;
