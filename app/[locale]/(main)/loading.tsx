'use client';

import { useState, useEffect } from 'react';

const DANCE_GIFS = ['/dance.gif', '/dance-1.gif'];
const DANCE_DURATION_MS = 3000;

/**
 * Route-level loading UI for (main) segment (business list, prosuppliers, etc.).
 * Matches the ProBot welcome screen so the transition is seamless: same black bg,
 * white container, centered ProBot. Cycles dance.gif and dance-1.gif like the sign-in welcome back screen.
 */
export default function MainLoading() {
  const [danceIndex, setDanceIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setDanceIndex((i) => (i + 1) % DANCE_GIFS.length);
    }, DANCE_DURATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black md:bg-black/80"
      aria-hidden
      aria-label="Loading"
    >
      {/* Same frame as welcome overlay: white rounded container */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-full max-w-[960px] h-[calc(100vh-1rem)] md:min-h-screen md:h-auto md:mt-2 md:rounded-lg border-2 border-black bg-white" />
      </div>
      {/* Centered ProBot: alternate dance GIFs in sequence (same as sign-in welcome back) */}
      <div className="fixed flex items-center justify-center z-10 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[144px] h-[144px] relative">
        {DANCE_GIFS.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            width={144}
            height={144}
            className="absolute inset-0 w-full h-full object-contain object-center transition-opacity duration-300"
            style={{ opacity: danceIndex === i ? 1 : 0, pointerEvents: 'none' }}
          />
        ))}
      </div>
    </div>
  );
}
