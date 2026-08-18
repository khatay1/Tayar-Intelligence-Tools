interface AstronautLogoProps {
  size?: number;
  className?: string;
}

export default function AstronautLogo({ size = 36, className = '' }: AstronautLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="astroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="visorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#0f0f24" />
        </linearGradient>
      </defs>
      {/* Helmet */}
      <ellipse cx="24" cy="22" rx="15" ry="16" fill="url(#astroGrad)" />
      {/* Visor */}
      <ellipse cx="24" cy="22" rx="10" ry="11" fill="url(#visorGrad)" />
      {/* Visor reflection */}
      <ellipse cx="20" cy="18" rx="3.5" ry="4" fill="#a78bfa" opacity="0.4" />
      <ellipse cx="19" cy="17" rx="1.5" ry="2" fill="#e0e7ff" opacity="0.6" />
      {/* Antenna */}
      <line x1="24" y1="6" x2="24" y2="2" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="2" r="1.5" fill="#c4b5fd" />
      {/* Body suit */}
      <path d="M12 36 Q12 42 24 42 Q36 42 36 36 L36 40 Q36 46 24 46 Q12 46 12 40 Z" fill="url(#astroGrad)" />
      {/* Chest panel */}
      <rect x="20" y="37" width="8" height="5" rx="1.5" fill="#1e1b4b" opacity="0.6" />
      <circle cx="22" cy="39.5" r="0.8" fill="#34d399" />
      <circle cx="24" cy="39.5" r="0.8" fill="#fbbf24" />
      <circle cx="26" cy="39.5" r="0.8" fill="#f87171" />
    </svg>
  );
}
