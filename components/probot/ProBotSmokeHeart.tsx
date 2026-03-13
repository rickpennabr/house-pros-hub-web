'use client';

/**
 * Airshow-style effect: a plane "draws" a heart in the sky with a smoke trail.
 * The heart path is revealed (stroke animation) while a small plane follows the path.
 */
export default function ProBotSmokeHeart() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[14] overflow-hidden"
      aria-hidden
    >
      <div className="probot-smoke-heart-container">
        <svg
          className="probot-smoke-heart-svg"
          viewBox="0 0 100 100"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Heart path — stroke draws on via CSS animation (smoke trail) */}
          <path
            className="probot-smoke-heart-path"
            pathLength={100}
            stroke="rgba(255,255,255,0.85)"
            strokeWidth={2.2}
            d="M 50 88 C 50 88 12 58 12 28 C 12 8 32 8 50 28 C 68 8 88 8 88 28 C 88 58 50 88 50 88"
          />
        </svg>
        {/* Plane follows the heart path (keyframe positions) */}
        <div className="probot-smoke-heart-plane">
          <svg
            viewBox="0 0 32 24"
            fill="currentColor"
            className="probot-smoke-heart-plane-svg"
          >
            {/* Aerobatic plane side view: nose, fuselage, wing, tail */}
            <path
              d="M2 12 L8 12 L12 8 L20 10 L28 12 L30 12 L28 14 L20 14 L14 16 L10 14 L4 14 Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
