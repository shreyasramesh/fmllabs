/** Avatar: The Last Airbender–inspired element symbols + default (classic) */

export function DefaultIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

export function AirIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M12 4a8 8 0 0 1 0 16 8 8 0 0 1 0-16" />
      <path d="M12 8a4 4 0 0 1 0 8 4 4 0 0 1 0-8" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function WaterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4 14s2-4 8-4 8 4 8 4" />
      <path d="M4 10s2-4 8-4 8 4 8 4" />
      <path d="M4 18s2-4 8-4 8 4 8 4" />
    </svg>
  );
}

export function EarthIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M4 12h16" />
      <path d="M12 4v16" />
    </svg>
  );
}

export function FireIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2c0 2-1.5 4-1.5 6.5 0 2.2 1.8 4 4 4s4-1.8 4-4c0-2.5-1.5-4.5-1.5-6.5 0-1.1-.9-2-2-2s-2 .9-2 2z" />
    </svg>
  );
}
