// Alpha and UVs match the visible frame; empty pixels receive no rectangular glow.
export default function SpriteLightLayers({ layers, url, maskSize, maskPosition: [mx, my] }) {
  const maskImage = `url("${url}")`;
  const maskPosition = `${mx}% ${my}%`;
  return layers.map((layer, index) => (
    <div key={index} className="absolute inset-0 pointer-events-none" style={{
      mixBlendMode: layer.blend, background: layer.background, animation: layer.animation,
      maskImage, WebkitMaskImage: maskImage,
      maskSize, WebkitMaskSize: maskSize,
      maskPosition, WebkitMaskPosition: maskPosition,
      maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat',
    }} />
  ));
}
