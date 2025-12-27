import { useState, useCallback } from 'react';

export type AccordionName = 
  | 'customerInfo' 
  | 'projectInfo' 
  | 'projectType' 
  | 'trades' 
  | 'description' 
  | 'budgetTimeline' 
  | 'contactMethod' 
  | 'notes';

const NESTED_ACCORDIONS: AccordionName[] = [
  'projectType',
  'trades',
  'description',
  'budgetTimeline',
  'contactMethod',
  'notes',
];

interface AccordionState {
  customerInfo: boolean;
  projectInfo: boolean;
  projectType: boolean;
  trades: boolean;
  description: boolean;
  budgetTimeline: boolean;
  contactMethod: boolean;
  notes: boolean;
}

const initialAccordionState: AccordionState = {
  customerInfo: false,
  projectInfo: true, // Start with projectInfo open
  projectType: false,
  trades: false,
  description: false,
  budgetTimeline: false,
  contactMethod: false,
  notes: false,
};

/**
 * Custom hook for managing accordion state
 * Handles nested accordion logic (projectInfo contains nested accordions)
 */
export function useAccordionState(initialState?: Partial<AccordionState>) {
  const [state, setState] = useState<AccordionState>({
    ...initialAccordionState,
    ...initialState,
  });

  const toggleAccordion = useCallback((accordionName: AccordionName) => {
    setState((prev) => {
      const isCurrentlyOpen = prev[accordionName];
      const isNestedAccordion = NESTED_ACCORDIONS.includes(accordionName);

      if (isNestedAccordion) {
        // For nested accordions, close other nested accordions but keep projectInfo open
        if (!isCurrentlyOpen) {
          return {
            ...prev,
            projectType: accordionName === 'projectType',
            trades: accordionName === 'trades',
            description: accordionName === 'description',
            budgetTimeline: accordionName === 'budgetTimeline',
            contactMethod: accordionName === 'contactMethod',
            notes: accordionName === 'notes',
            projectInfo: true, // Keep parent open
            customerInfo: false, // Close other top-level
          };
        } else {
          // If already open, just close it (keep projectInfo open)
          return {
            ...prev,
            [accordionName]: false,
          };
        }
      } else {
        // For top-level accordions, close all other accordions
        if (!isCurrentlyOpen) {
          return {
            ...initialAccordionState,
            [accordionName]: true,
            // If opening projectInfo, keep it open but close nested
            projectInfo: accordionName === 'projectInfo',
          };
        } else {
          // If already open, close it and all nested accordions
          return {
            ...prev,
            [accordionName]: false,
            // If closing projectInfo, also close all nested
            ...(accordionName === 'projectInfo' ? {
              projectType: false,
              trades: false,
              description: false,
              budgetTimeline: false,
              contactMethod: false,
              notes: false,
            } : {}),
          };
        }
      }
    });
  }, []);

  const closeAll = useCallback(() => {
    setState({
      customerInfo: false,
      projectInfo: false,
      projectType: false,
      trades: false,
      description: false,
      budgetTimeline: false,
      contactMethod: false,
      notes: false,
    });
  }, []);

  return {
    state,
    toggleAccordion,
    isOpen: (name: AccordionName) => state[name],
    closeAll,
  };
}

