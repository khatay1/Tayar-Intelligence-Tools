interface AstronautLogoProps {
  size?: number;
  className?: string;
}

export default function AstronautLogo({ size = 36, className = '' }: AstronautLogoProps) {
  return (
    <img
      src="/brand/tayar-logo.jpg"
      width={size}
      height={size}
      alt="Tayar Intelligence Tools"
      className={`block rounded-[22%] object-cover ${className}`}
      decoding="async"
    />
  );
}