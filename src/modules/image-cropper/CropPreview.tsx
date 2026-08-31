import { CropRect } from './crop-types';

interface CropPreviewProps {
  imageUrl: string;
  sourceWidth: number;
  sourceHeight: number;
  crop: CropRect;
  alt: string;
}

export default function CropPreview({
  imageUrl,
  sourceWidth,
  sourceHeight,
  crop,
  alt,
}: CropPreviewProps) {
  const left = (crop.x / sourceWidth) * 100;
  const top = (crop.y / sourceHeight) * 100;
  const width = (crop.width / sourceWidth) * 100;
  const height = (crop.height / sourceHeight) * 100;

  return (
    <div className="relative inline-block max-w-full overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <img src={imageUrl} alt={alt} className="block max-h-[520px] max-w-full object-contain" />
      <div
        className="pointer-events-none absolute border-2 border-violet-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]"
        style={{
          left: `${left}%`,
          top: `${top}%`,
          width: `${width}%`,
          height: `${height}%`,
        }}
      />
    </div>
  );
}
