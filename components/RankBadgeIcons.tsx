"use client";

import { useId } from "react";

/** Iron rank badge - LoL-style hexagon with wings */
export function IronRankBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const ironGradId = `ironGrad-${id}`;
  const innerFaceGradId = `innerFaceGrad-${id}`;
  const filterId = `heavyShadow-${id}`;
  return (
    <svg
      viewBox="0 0 200 150"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={ironGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#3a3f45", stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: "#2a2f35", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#1c2024", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={innerFaceGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#4a4f55", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#2a2f35", stopOpacity: 1 }} />
        </linearGradient>
        <filter id={filterId} x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.5" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#${ironGradId})`} stroke="#1a1e22" strokeWidth="2" filter={`url(#${filterId})`}>
        <path d="M70,80 Q30,85 20,60 Q40,55 70,70 Z" />
        <path d="M75,95 Q35,115 25,90 Q45,85 75,95 Z" />
      </g>
      <g fill={`url(#${ironGradId})`} stroke="#1a1e22" strokeWidth="2" filter={`url(#${filterId})`}>
        <path d="M130,80 Q170,85 180,60 Q160,55 130,70 Z" />
        <path d="M125,95 Q165,115 175,90 Q155,85 125,95 Z" />
      </g>
      <g filter={`url(#${filterId})`}>
        <path
          d="M100,30 L145,55 L145,105 L100,130 L55,105 L55,55 Z"
          fill="#1c2024"
          stroke="#101316"
          strokeWidth="5"
        />
        <path d="M100,40 L135,60 L135,100 L100,120 L65,100 L65,60 Z" fill={`url(#${innerFaceGradId})`} />
        <line
          x1="72"
          y1="65"
          x2="72"
          y2="95"
          stroke="#101316"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
        />
        <line
          x1="128"
          y1="65"
          x2="128"
          y2="95"
          stroke="#101316"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
    </svg>
  );
}

/** Bronze rank badge - LoL-style hexagon with wings */
export function BronzeRankBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const bronzeGradId = `bronzeGrad-${id}`;
  const innerFaceGradId = `innerFaceGradBronze-${id}`;
  const filterId = `bronzeShadow-${id}`;
  return (
    <svg
      viewBox="0 0 200 150"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={bronzeGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#d7b57a", stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: "#b08d57", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#9a7647", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={innerFaceGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#e0c19a", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#b08d57", stopOpacity: 1 }} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#${bronzeGradId})`} stroke="#806241" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M70,80 Q30,85 20,60 Q40,55 70,70 Z" />
        <path d="M75,95 Q35,115 25,90 Q45,85 75,95 Z" />
      </g>
      <g fill={`url(#${bronzeGradId})`} stroke="#806241" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M130,80 Q170,85 180,60 Q160,55 130,70 Z" />
        <path d="M125,95 Q165,115 175,90 Q155,85 125,95 Z" />
      </g>
      <g filter={`url(#${filterId})`}>
        <path
          d="M100,30 L145,55 L145,105 L100,130 L55,105 L55,55 Z"
          fill="#b08d57"
          stroke="#9a7647"
          strokeWidth="4.5"
        />
        <path d="M100,40 L135,60 L135,100 L100,120 L65,100 L65,60 Z" fill={`url(#${innerFaceGradId})`} />
        <line
          x1="72"
          y1="65"
          x2="72"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.3"
        />
        <line
          x1="128"
          y1="65"
          x2="128"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.3"
        />
      </g>
    </svg>
  );
}

/** Gold rank badge - LoL-style hexagon with wings */
export function GoldRankBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const goldGradId = `goldGrad-${id}`;
  const innerFaceGradId = `innerFaceGradGold-${id}`;
  const filterId = `goldShadow-${id}`;
  return (
    <svg
      viewBox="0 0 200 150"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={goldGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#fce38d", stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: "#f7b733", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#e0a324", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={innerFaceGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#fdebb3", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#f7b733", stopOpacity: 1 }} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dx="0" dy="2.5" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.35" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#${goldGradId})`} stroke="#c2901a" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M70,80 Q30,85 20,60 Q40,55 70,70 Z" />
        <path d="M75,95 Q35,115 25,90 Q45,85 75,95 Z" />
      </g>
      <g fill={`url(#${goldGradId})`} stroke="#c2901a" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M130,80 Q170,85 180,60 Q160,55 130,70 Z" />
        <path d="M125,95 Q165,115 175,90 Q155,85 125,95 Z" />
      </g>
      <g filter={`url(#${filterId})`}>
        <path
          d="M100,30 L145,55 L145,105 L100,130 L55,105 L55,55 Z"
          fill="#f7b733"
          stroke="#e0a324"
          strokeWidth="4.5"
        />
        <path d="M100,40 L135,60 L135,100 L100,120 L65,100 L65,60 Z" fill={`url(#${innerFaceGradId})`} />
        <line
          x1="72"
          y1="65"
          x2="72"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.4"
        />
        <line
          x1="128"
          y1="65"
          x2="128"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.4"
        />
      </g>
    </svg>
  );
}

/** Platinum rank badge - LoL-style hexagon with wings */
export function PlatinumRankBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const platinumGradId = `platinumGrad-${id}`;
  const innerFaceGradId = `innerFaceGradPlat-${id}`;
  const filterId = `premiumShadow-${id}`;
  return (
    <svg
      viewBox="0 0 200 150"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={platinumGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#e0f7fa", stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: "#b2ebf2", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#80deea", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={innerFaceGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#ffffff", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#e0f7fa", stopOpacity: 1 }} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.4" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#${platinumGradId})`} stroke="#4dd0e1" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M70,80 Q30,85 20,60 Q40,55 70,70 Z" />
        <path d="M75,95 Q35,115 25,90 Q45,85 75,95 Z" />
      </g>
      <g fill={`url(#${platinumGradId})`} stroke="#4dd0e1" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M130,80 Q170,85 180,60 Q160,55 130,70 Z" />
        <path d="M125,95 Q165,115 175,90 Q155,85 125,95 Z" />
      </g>
      <g filter={`url(#${filterId})`}>
        <path
          d="M100,30 L145,55 L145,105 L100,130 L55,105 L55,55 Z"
          fill="#e0f7fa"
          stroke="#4dd0e1"
          strokeWidth="4.5"
        />
        <path d="M100,40 L135,60 L135,100 L100,120 L65,100 L65,60 Z" fill={`url(#${innerFaceGradId})`} />
        <line
          x1="72"
          y1="65"
          x2="72"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.6"
        />
        <line
          x1="128"
          y1="65"
          x2="128"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>
    </svg>
  );
}

/** Diamond rank badge - LoL-style hexagon with wings */
export function DiamondRankBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const diamondGradId = `diamondGrad-${id}`;
  const innerFaceGradId = `innerFaceGradDiam-${id}`;
  const filterId = `brilliantShadow-${id}`;
  return (
    <svg
      viewBox="0 0 200 150"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={diamondGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#ffffff", stopOpacity: 1 }} />
          <stop offset="30%" style={{ stopColor: "#e0f7fa", stopOpacity: 1 }} />
          <stop offset="60%" style={{ stopColor: "#81d4fa", stopOpacity: 1 }} />
          <stop offset="85%" style={{ stopColor: "#29b6f6", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#01579b", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={innerFaceGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#ffffff", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#e0f7fa", stopOpacity: 1 }} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.45" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#${diamondGradId})`} stroke="#01579b" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M70,80 Q30,85 20,60 Q40,55 70,70 Z" />
        <path d="M75,95 Q35,115 25,90 Q45,85 75,95 Z" />
      </g>
      <g fill={`url(#${diamondGradId})`} stroke="#01579b" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M130,80 Q170,85 180,60 Q160,55 130,70 Z" />
        <path d="M125,95 Q165,115 175,90 Q155,85 125,95 Z" />
      </g>
      <g filter={`url(#${filterId})`}>
        <path
          d="M100,30 L145,55 L145,105 L100,130 L55,105 L55,55 Z"
          fill="#81d4fa"
          stroke="#01579b"
          strokeWidth="4.5"
        />
        <path d="M100,40 L135,60 L135,100 L100,120 L65,100 L65,60 Z" fill={`url(#${innerFaceGradId})`} />
        <line
          x1="72"
          y1="65"
          x2="72"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        <line
          x1="128"
          y1="65"
          x2="128"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
    </svg>
  );
}

/** Master rank badge - LoL-style hexagon with wings */
export function MasterRankBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const masterGradId = `masterGrad-${id}`;
  const innerFaceGradId = `innerFaceGradMaster-${id}`;
  const filterId = `brilliantShadowMaster-${id}`;
  return (
    <svg
      viewBox="0 0 200 150"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={masterGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#dfa9ff", stopOpacity: 1 }} />
          <stop offset="30%" style={{ stopColor: "#c180ff", stopOpacity: 1 }} />
          <stop offset="60%" style={{ stopColor: "#9f5aff", stopOpacity: 1 }} />
          <stop offset="85%" style={{ stopColor: "#813aff", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#5a15c7", stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id={innerFaceGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#ffffff", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#dfa9ff", stopOpacity: 1 }} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
          <feOffset dx="0" dy="3" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.45" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#${masterGradId})`} stroke="#5a15c7" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M70,80 Q30,85 20,60 Q40,55 70,70 Z" />
        <path d="M75,95 Q35,115 25,90 Q45,85 75,95 Z" />
      </g>
      <g fill={`url(#${masterGradId})`} stroke="#5a15c7" strokeWidth="1.8" filter={`url(#${filterId})`}>
        <path d="M130,80 Q170,85 180,60 Q160,55 130,70 Z" />
        <path d="M125,95 Q165,115 175,90 Q155,85 125,95 Z" />
      </g>
      <g filter={`url(#${filterId})`}>
        <path
          d="M100,30 L145,55 L145,105 L100,130 L55,105 L55,55 Z"
          fill="#9f5aff"
          stroke="#5a15c7"
          strokeWidth="4.5"
        />
        <path d="M100,40 L135,60 L135,100 L100,120 L65,100 L65,60 Z" fill={`url(#${innerFaceGradId})`} />
        <line
          x1="72"
          y1="65"
          x2="72"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
        <line
          x1="128"
          y1="65"
          x2="128"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
    </svg>
  );
}

/** Silver rank badge - LoL-style hexagon with wings */
export function SilverRankBadge({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  const gradId = `silverGrad-${id}`;
  const filterId = `softShadow-${id}`;
  return (
    <svg
      viewBox="0 0 200 150"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#f0faff", stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: "#d1e8f5", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#b8d6e8", stopOpacity: 1 }} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="2" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#${gradId})`} stroke="#a3c4d9" strokeWidth="1.5" filter={`url(#${filterId})`}>
        <path d="M70,80 Q30,85 20,60 Q40,55 70,70 Z" />
        <path d="M75,95 Q35,115 25,90 Q45,85 75,95 Z" />
      </g>
      <g fill={`url(#${gradId})`} stroke="#a3c4d9" strokeWidth="1.5" filter={`url(#${filterId})`}>
        <path d="M130,80 Q170,85 180,60 Q160,55 130,70 Z" />
        <path d="M125,95 Q165,115 175,90 Q155,85 125,95 Z" />
      </g>
      <g filter={`url(#${filterId})`}>
        <path
          d="M100,30 L145,55 L145,105 L100,130 L55,105 L55,55 Z"
          fill="#e6f2f8"
          stroke="#a3c4d9"
          strokeWidth="4"
        />
        <path d="M100,40 L135,60 L135,100 L100,120 L65,100 L65,60 Z" fill={`url(#${gradId})`} />
        <line
          x1="72"
          y1="65"
          x2="72"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
        <line
          x1="128"
          y1="65"
          x2="128"
          y2="95"
          stroke="#ffffff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>
    </svg>
  );
}
