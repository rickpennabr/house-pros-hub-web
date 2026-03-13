'use client';

/**
 * F-35 silhouettes flying through the ProBot sky.
 * Uses CSS animation; jets are non-interactive (pointer-events-none).
 */
const F35_SILHOUETTE = (
  <path
    fill="currentColor"
    d="M2 20 L14 20 L22 12 L36 14 L50 18 L62 16 L78 18 L92 20 L104 18 L114 20 L120 20 L116 22 L102 22 L84 24 L66 22 L50 24 L34 26 L20 24 L8 26 L2 22 Z"
  />
);

export default function ProBotSkyJets() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[15] overflow-hidden"
      aria-hidden
    >
      {/* F-35 side-view silhouettes flying left-to-right */}
      <svg
        className="probot-sky-jet probot-sky-jet-1"
        viewBox="0 0 120 40"
        fill="currentColor"
        style={{ width: 140, height: 47, color: 'rgba(0,0,0,0.4)' }}
      >
        {F35_SILHOUETTE}
      </svg>
      <svg
        className="probot-sky-jet probot-sky-jet-2"
        viewBox="0 0 120 40"
        fill="currentColor"
        style={{ width: 100, height: 33, color: 'rgba(0,0,0,0.32)' }}
      >
        {F35_SILHOUETTE}
      </svg>
      <svg
        className="probot-sky-jet probot-sky-jet-3"
        viewBox="0 0 120 40"
        fill="currentColor"
        style={{ width: 120, height: 40, color: 'rgba(0,0,0,0.36)' }}
      >
        {F35_SILHOUETTE}
      </svg>
    </div>
  );
}
