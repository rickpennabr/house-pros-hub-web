'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

/**
 * Hook to show a custom warning modal when user tries to leave the page
 * while on steps 2, 3, 4, or 5 of a form
 * @param currentStep - The current step number
 * @param enabled - Whether the warning should be enabled (default: true)
 * @returns Object with modal state and handlers
 */
export function useBeforeUnloadWarning(currentStep: number, enabled: boolean = true) {
  const [showModal, setShowModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const shouldWarnRef = useRef(false);
  const allowNavigationRef = useRef(false);
  const allowBeforeUnloadRef = useRef(false);

  // Only show warning on steps 2, 3, 4, or 5
  const shouldWarn = enabled && (currentStep === 2 || currentStep === 3 || currentStep === 4 || currentStep === 5);
  
  // Update ref in effect to avoid updating during render
  useEffect(() => {
    shouldWarnRef.current = shouldWarn;
  }, [shouldWarn]);

  // Handle browser refresh/close (beforeunload)
  // Note: For refresh/close, browsers show their own dialog - we can't show a custom modal
  // But we can still trigger the browser's default warning
  useEffect(() => {
    if (!shouldWarn) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Don't show browser warning if user confirmed via custom modal
      if (allowBeforeUnloadRef.current) {
        return;
      }
      if (shouldWarnRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [shouldWarn]);

  // Handle browser back/forward buttons
  useEffect(() => {
    if (!shouldWarn) {
      return;
    }

    // Push a state to track when user tries to go back
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // If we're allowing navigation, don't interfere
      if (allowNavigationRef.current) {
        allowNavigationRef.current = false;
        return;
      }

      if (shouldWarnRef.current) {
        // Prevent navigation by pushing state back
        window.history.pushState(null, '', window.location.href);
        // Show our custom modal
        // Store a flag to allow navigation when confirmed
        setPendingAction(() => () => {
          // Temporarily allow navigation
          allowNavigationRef.current = true;
          // Go back
          window.history.back();
        });
        setShowModal(true);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldWarn]);

  // Intercept link clicks that navigate away
  useEffect(() => {
    if (!shouldWarn) {
      return;
    }

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest('a[href]');
      
      if (link) {
        const href = link.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          const currentPath = window.location.pathname;
          const linkPath = new URL(href, window.location.href).pathname;
          
          // If navigating to a different page and not opening in a new tab
          if (linkPath !== currentPath && link.getAttribute('target') !== '_blank') {
            e.preventDefault();
            e.stopPropagation();
            
            setPendingAction(() => () => {
              window.location.href = href;
            });
            setShowModal(true);
          }
        }
      }
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [shouldWarn]);

  const handleConfirmLeave = useCallback(() => {
    setShowModal(false);
    if (pendingAction) {
      // Temporarily disable beforeunload warning since user confirmed via custom modal
      allowBeforeUnloadRef.current = true;
      pendingAction();
      setPendingAction(null);
      // Reset after a short delay to allow navigation to complete
      setTimeout(() => {
        allowBeforeUnloadRef.current = false;
      }, 100);
    } else {
      // For refresh/close - allow it to proceed
      // The browser's beforeunload will handle it
    }
  }, [pendingAction]);

  const handleCancelLeave = useCallback(() => {
    setShowModal(false);
    setPendingAction(null);
  }, []);

  // Function to manually trigger warning (for programmatic navigation)
  const triggerWarning = useCallback((onConfirm: () => void) => {
    if (shouldWarnRef.current) {
      setPendingAction(() => onConfirm);
      setShowModal(true);
    } else {
      onConfirm();
    }
  }, []);

  // Function to allow navigation without warning
  const allowNavigation = useCallback(() => {
    allowBeforeUnloadRef.current = true;
    allowNavigationRef.current = true;
    // Reset after a short delay to allow navigation to complete
    setTimeout(() => {
      allowBeforeUnloadRef.current = false;
      allowNavigationRef.current = false;
    }, 100);
  }, []);

  return {
    showModal,
    handleConfirmLeave,
    handleCancelLeave,
    triggerWarning,
    allowNavigation,
  };
}

