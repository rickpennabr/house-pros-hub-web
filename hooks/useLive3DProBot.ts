'use client';

import { useEffect, useState } from 'react';

/** PC with a mouse, motion allowed and WebGL: show the live 3D ProBot. Phones keep the light image. */
export function useLive3DProBot(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 768px) and (pointer: fine)');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    let webgl = false;
    try {
      webgl = Boolean(document.createElement('canvas').getContext('webgl2'));
    } catch {
      webgl = false;
    }
    const update = () => setOk(webgl && wide.matches && !calm.matches);
    update();
    wide.addEventListener('change', update);
    calm.addEventListener('change', update);
    return () => {
      wide.removeEventListener('change', update);
      calm.removeEventListener('change', update);
    };
  }, []);
  return ok;
}
