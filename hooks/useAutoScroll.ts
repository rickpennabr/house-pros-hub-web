import { useEffect, RefObject, useRef } from 'react';

interface UseAutoScrollOptions {
  /**
   * The ref to the element to scroll to
   */
  ref: RefObject<HTMLElement | null>;
  /**
   * Whether the element should be scrolled to (usually a state that triggers the scroll)
   */
  shouldScroll: boolean;
  /**
   * Offset in pixels from the top of the viewport (default: 20)
   */
  offset?: number;
  /**
   * Delay in milliseconds before scrolling (default: 100)
   */
  delay?: number;
}

/**
 * Reusable hook for auto-scrolling to an element when a condition is met
 * Similar to the estimate page accordion scrolling behavior
 * Only scrolls when shouldScroll changes from false to true
 */
export function useAutoScroll({ 
  ref, 
  shouldScroll, 
  offset = 20,
  delay = 100 
}: UseAutoScrollOptions) {
  const prevShouldScroll = useRef(false);

  useEffect(() => {
    // Only scroll when shouldScroll changes from false to true (tab becomes active)
    const justBecameActive = shouldScroll && !prevShouldScroll.current;
    
    if (!justBecameActive || !ref.current) {
      prevShouldScroll.current = shouldScroll;
      return;
    }

    prevShouldScroll.current = shouldScroll;

    const scrollToElement = () => {
      if (!ref.current) return;
      
      const elementPosition = ref.current.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    };

    const timeoutId = setTimeout(scrollToElement, delay);

    return () => clearTimeout(timeoutId);
  }, [shouldScroll, ref, offset, delay]);
}

