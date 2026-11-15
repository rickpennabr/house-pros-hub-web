'use client';

import { useCallback, useEffect, useRef, type MouseEvent, type RefObject } from 'react';

const HOVER_QUERY = '(hover: hover) and (pointer: fine)';

function pointerCanHover(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(HOVER_QUERY).matches;
}

function isInside(target: EventTarget | null, nodes: Array<HTMLElement | null>): boolean {
  if (!(target instanceof Node)) return false;
  return nodes.some((node) => node?.contains(target));
}

/**
 * Desktop hover for a button whose menu is portaled below it.
 * Touch keeps click-to-toggle. A short delay lets the pointer cross the gap.
 */
export function useHoverMenu(
  setOpen: (open: boolean) => void,
  refs: Array<RefObject<HTMLElement | null>>,
  enabled = true,
) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refsRef = useRef(refs);
  refsRef.current = refs;

  const cancelClose = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const openOnHover = useCallback(() => {
    if (!enabled || !pointerCanHover()) return;
    cancelClose();
    setOpen(true);
  }, [enabled, cancelClose, setOpen]);

  const closeOnHover = useCallback(
    (event: MouseEvent) => {
      if (!enabled || !pointerCanHover()) return;
      const nodes = refsRef.current.map((ref) => ref.current);
      if (isInside(event.relatedTarget, nodes)) return;
      cancelClose();
      timer.current = setTimeout(() => setOpen(false), 180);
    },
    [enabled, cancelClose, setOpen],
  );

  useEffect(() => () => cancelClose(), [cancelClose]);

  return { openOnHover, closeOnHover, cancelClose };
}
