'use client';

import { useEffect, useRef, useState } from 'react';

interface JobPhotoMapProps {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
}

const ZOOM = 17;

function worldPoint(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const size = 256 * 2 ** zoom;
  const sine = Math.sin((latitude * Math.PI) / 180);
  const x = ((longitude + 180) / 360) * size;
  const y = (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * size;
  return { x, y };
}

/**
 * Street map with the photo pin and the accuracy rings around it.
 * Tiles come from OpenStreetMap so the phone does not need the Google referrer.
 */
export function JobPhotoMap({ latitude, longitude, accuracyM }: JobPhotoMapProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const center = worldPoint(latitude, longitude, ZOOM);
  const metersPerPixel = (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** ZOOM;
  const accuracy = accuracyM && accuracyM > 0 ? accuracyM : 45;
  const inner = (accuracy * 2) / metersPerPixel;
  const outer = inner * 2.2;
  const tileX = Math.floor(center.x / 256);
  const tileY = Math.floor(center.y / 256);
  const tiles: { key: string; left: number; top: number; src: string }[] = [];
  if (size.width > 0 && size.height > 0) {
    const spanX = Math.ceil(size.width / 256) + 2;
    const spanY = Math.ceil(size.height / 256) + 2;
    for (let row = -spanY; row <= spanY; row += 1) {
      for (let column = -spanX; column <= spanX; column += 1) {
        const x = tileX + column;
        const y = tileY + row;
        const left = x * 256 - center.x + size.width / 2;
        const top = y * 256 - center.y + size.height / 2;
        if (left > size.width || top > size.height || left + 256 < 0 || top + 256 < 0) continue;
        tiles.push({
          key: `${x}-${y}`,
          left,
          top,
          src: `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`,
        });
      }
    }
  }

  return (
    <div ref={frame} className="relative h-full w-full overflow-hidden bg-gray-200">
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          alt=""
          src={tile.src}
          className="absolute h-64 w-64 max-w-none"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}
      <span
        className="absolute rounded-full border-2 border-yellow-400 bg-yellow-300/30"
        style={{
          width: outer,
          height: outer,
          left: size.width / 2 - outer / 2,
          top: size.height / 2 - outer / 2,
        }}
      />
      <span
        className="absolute rounded-full bg-lime-700/25"
        style={{
          width: inner,
          height: inner,
          left: size.width / 2 - inner / 2,
          top: size.height / 2 - inner / 2,
        }}
      />
      <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-2 border-white bg-red-600 text-white shadow">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
          <path fill="currentColor" d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5Z" />
        </svg>
      </span>
    </div>
  );
}
