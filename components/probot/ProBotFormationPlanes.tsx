'use client';

/**
 * Four propeller planes in staggered diagonal formation with thick white
 * jagged contrails, like a sky demonstration / airshow.
 */
const PROPELLER_PLANE = (
  <path
    fill="currentColor"
    d="M2 10 L6 10 L10 6 L18 8 L26 10 L30 10 L28 12 L20 12 L14 14 L8 12 Z"
  />
);

/** Thick white contrail with jagged/irregular edges (extends behind plane). */
const CONTRAIL = (
  <path
    fill="rgba(255,255,255,0.88)"
    d="M100 6 L96 4 L92 7 L88 3 L84 6 L80 5 L76 8 L72 4 L68 7 L64 5 L60 8 L56 4 L52 7 L48 5 L44 8 L40 4 L36 7 L32 5 L28 8 L24 4 L20 7 L16 5 L12 8 L8 4 L4 7 L0 6 L2 8 L6 9 L10 7 L14 9 L18 8 L22 10 L26 7 L30 9 L34 8 L38 10 L42 7 L46 9 L50 8 L54 10 L58 7 L62 9 L66 8 L70 10 L74 7 L78 9 L82 8 L86 10 L90 7 L94 9 L98 8 L100 6 Z"
  />
);

export default function ProBotFormationPlanes() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[15] overflow-hidden"
      aria-hidden
    >
      <div className="probot-formation-container">
        {/* Plane 1 (lead) */}
        <div className="probot-formation-plane probot-formation-plane-1">
          <svg className="probot-formation-contrail" viewBox="0 0 100 12" preserveAspectRatio="none">
            {CONTRAIL}
          </svg>
          <svg className="probot-formation-aircraft" viewBox="0 0 32 16" fill="currentColor" style={{ color: 'rgba(0,0,0,0.45)' }}>
            {PROPELLER_PLANE}
          </svg>
        </div>
        {/* Plane 2 */}
        <div className="probot-formation-plane probot-formation-plane-2">
          <svg className="probot-formation-contrail" viewBox="0 0 100 12" preserveAspectRatio="none">
            {CONTRAIL}
          </svg>
          <svg className="probot-formation-aircraft" viewBox="0 0 32 16" fill="currentColor" style={{ color: 'rgba(0,0,0,0.4)' }}>
            {PROPELLER_PLANE}
          </svg>
        </div>
        {/* Plane 3 */}
        <div className="probot-formation-plane probot-formation-plane-3">
          <svg className="probot-formation-contrail" viewBox="0 0 100 12" preserveAspectRatio="none">
            {CONTRAIL}
          </svg>
          <svg className="probot-formation-aircraft" viewBox="0 0 32 16" fill="currentColor" style={{ color: 'rgba(0,0,0,0.42)' }}>
            {PROPELLER_PLANE}
          </svg>
        </div>
        {/* Plane 4 */}
        <div className="probot-formation-plane probot-formation-plane-4">
          <svg className="probot-formation-contrail" viewBox="0 0 100 12" preserveAspectRatio="none">
            {CONTRAIL}
          </svg>
          <svg className="probot-formation-aircraft" viewBox="0 0 32 16" fill="currentColor" style={{ color: 'rgba(0,0,0,0.38)' }}>
            {PROPELLER_PLANE}
          </svg>
        </div>
      </div>
    </div>
  );
}
