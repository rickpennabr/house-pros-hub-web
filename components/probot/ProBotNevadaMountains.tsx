'use client';

/**
 * Nevada-style mountain silhouettes at the bottom of the ProBot viewport.
 * Uses CSS variables (--probot-mountain-far/mid/near/far-back) so colors follow the day/night cycle.
 * Four depth layers with 3D shading (light top-left, shadow right).
 */
export default function ProBotNevadaMountains() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <svg
        className="absolute bottom-0 left-0 w-full min-w-[120%] max-w-none"
        preserveAspectRatio="none"
        viewBox="0 0 1200 420"
        style={{ height: '58%', marginLeft: '-10%' }}
      >
        <defs>
          {/* 3D highlight: light from top-left */}
          <linearGradient
            id="probot-mountain-highlight"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="1200"
            y2="420"
          >
            <stop offset="0%" stopColor="white" stopOpacity="0.42" />
            <stop offset="35%" stopColor="white" stopOpacity="0.12" />
            <stop offset="70%" stopColor="white" stopOpacity="0.02" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
          {/* 3D shadow: darker on the right for volume */}
          <linearGradient
            id="probot-mountain-shadow"
            gradientUnits="userSpaceOnUse"
            x1="1200"
            y1="0"
            x2="0"
            y2="420"
          >
            <stop offset="0%" stopColor="black" stopOpacity="0.22" />
            <stop offset="50%" stopColor="black" stopOpacity="0.06" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Layer 1 – Farthest back */}
        <path
          fill="var(--probot-mountain-far-back)"
          d="M-80 420 L20 360 L140 400 L260 320 L380 380 L500 300 L620 360 L740 280 L860 340 L980 260 L1100 320 L1220 360 L1340 420 Z"
        />
        <path fill="url(#probot-mountain-highlight)" d="M-80 420 L20 360 L140 400 L260 320 L380 380 L500 300 L620 360 L740 280 L860 340 L980 260 L1100 320 L1220 360 L1340 420 Z" />
        <path fill="url(#probot-mountain-shadow)" d="M-80 420 L20 360 L140 400 L260 320 L380 380 L500 300 L620 360 L740 280 L860 340 L980 260 L1100 320 L1220 360 L1340 420 Z" />

        {/* Layer 2 – Far range */}
        <path
          fill="var(--probot-mountain-far)"
          d="M-60 420 L60 340 L180 380 L300 300 L420 360 L540 280 L660 340 L780 260 L900 320 L1020 260 L1140 320 L1260 420 Z"
        />
        <path fill="url(#probot-mountain-highlight)" d="M-60 420 L60 340 L180 380 L300 300 L420 360 L540 280 L660 340 L780 260 L900 320 L1020 260 L1140 320 L1260 420 Z" />
        <path fill="url(#probot-mountain-shadow)" d="M-60 420 L60 340 L180 380 L300 300 L420 360 L540 280 L660 340 L780 260 L900 320 L1020 260 L1140 320 L1260 420 Z" />

        {/* Layer 3 – Mid range: taller peaks */}
        <path
          fill="var(--probot-mountain-mid)"
          d="M-40 420 L80 280 L200 340 L320 220 L440 300 L560 200 L680 280 L800 180 L920 260 L1040 200 L1160 280 L1280 420 Z"
        />
        <path fill="url(#probot-mountain-highlight)" d="M-40 420 L80 280 L200 340 L320 220 L440 300 L560 200 L680 280 L800 180 L920 260 L1040 200 L1160 280 L1280 420 Z" />
        <path fill="url(#probot-mountain-shadow)" d="M-40 420 L80 280 L200 340 L320 220 L440 300 L560 200 L680 280 L800 180 L920 260 L1040 200 L1160 280 L1280 420 Z" />

        {/* Layer 4 – Near range: tallest peaks */}
        <path
          fill="var(--probot-mountain-near)"
          d="M-20 420 L120 320 L240 380 L360 280 L480 360 L600 260 L720 340 L840 240 L960 320 L1080 260 L1200 360 L1320 420 Z"
        />
        <path fill="url(#probot-mountain-highlight)" d="M-20 420 L120 320 L240 380 L360 280 L480 360 L600 260 L720 340 L840 240 L960 320 L1080 260 L1200 360 L1320 420 Z" />
        <path fill="url(#probot-mountain-shadow)" d="M-20 420 L120 320 L240 380 L360 280 L480 360 L600 260 L720 340 L840 240 L960 320 L1080 260 L1200 360 L1320 420 Z" />
      </svg>
    </div>
  );
}
