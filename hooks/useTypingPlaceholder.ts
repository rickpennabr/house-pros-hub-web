import { useState, useEffect, useRef } from 'react';

interface UseTypingPlaceholderOptions {
  placeholders: string[];
  typingSpeed?: number; // milliseconds per character
  delayBetweenFields?: number; // milliseconds between fields
  startDelay?: number; // milliseconds before starting animation
}

/**
 * Hook that manages typing animation for multiple placeholders in sequence
 * @returns Array of animated placeholder strings, one per input field
 */
export function useTypingPlaceholder({
  placeholders,
  typingSpeed = 100,
  delayBetweenFields = 300,
  startDelay = 500,
}: UseTypingPlaceholderOptions): string[] {
  // Initialize with empty strings matching the number of placeholders
  const [animatedPlaceholders, setAnimatedPlaceholders] = useState<string[]>(() => 
    placeholders.map(() => '')
  );
  
  const currentFieldIndexRef = useRef(0);
  const currentCharIndexRef = useRef(0);
  const timeoutRefsRef = useRef<NodeJS.Timeout[]>([]);
  const isCompleteRef = useRef(false);
  const placeholdersRef = useRef<string[]>(placeholders);
  const typingSpeedRef = useRef(typingSpeed);
  const delayBetweenFieldsRef = useRef(delayBetweenFields);

  // Update refs when props change
  placeholdersRef.current = placeholders;
  typingSpeedRef.current = typingSpeed;
  delayBetweenFieldsRef.current = delayBetweenFields;

  useEffect(() => {
    // Always reset and start fresh when component mounts or placeholders change
    currentFieldIndexRef.current = 0;
    currentCharIndexRef.current = 0;
    isCompleteRef.current = false;
    setAnimatedPlaceholders(placeholders.map(() => ''));

    // Clear any existing timeouts
    timeoutRefsRef.current.forEach(clearTimeout);
    timeoutRefsRef.current = [];

    function typeNextCharacter() {
      if (isCompleteRef.current) return;

      const fieldIndex = currentFieldIndexRef.current;
      const currentPlaceholders = placeholdersRef.current;
      
      // If we've completed all fields, mark as complete
      if (fieldIndex >= currentPlaceholders.length) {
        isCompleteRef.current = true;
        return;
      }

      const charIndex = currentCharIndexRef.current;
      const targetPlaceholder = currentPlaceholders[fieldIndex];

      // If we've completed current field, remove cursor and move to next field
      if (charIndex >= targetPlaceholder.length) {
        // Remove cursor from completed field
        setAnimatedPlaceholders((prev) => {
          const newPlaceholders = [...prev];
          newPlaceholders[fieldIndex] = targetPlaceholder;
          return newPlaceholders;
        });
        
        currentFieldIndexRef.current++;
        currentCharIndexRef.current = 0;

        // Add delay before starting next field
        const nextFieldTimeout = setTimeout(() => {
          typeNextCharacter();
        }, delayBetweenFieldsRef.current);
        timeoutRefsRef.current.push(nextFieldTimeout);
        return;
      }

      // Type next character with cursor
      setAnimatedPlaceholders((prev) => {
        const newPlaceholders = [...prev];
        const text = targetPlaceholder.substring(0, charIndex + 1);
        newPlaceholders[fieldIndex] = text + '|';
        return newPlaceholders;
      });

      currentCharIndexRef.current++;

      // Schedule next character
      const nextCharTimeout = setTimeout(() => {
        typeNextCharacter();
      }, typingSpeedRef.current);
      timeoutRefsRef.current.push(nextCharTimeout);
    }

    // Start animation after startDelay
    const startTimeout = setTimeout(() => {
      typeNextCharacter();
    }, startDelay);

    timeoutRefsRef.current.push(startTimeout);

    // Cleanup function
    return () => {
      timeoutRefsRef.current.forEach(clearTimeout);
      timeoutRefsRef.current = [];
    };
  }, [placeholders, startDelay]); // Only depend on placeholders and startDelay

  // Return the animated placeholders (empty string initially, then animated character by character)
  return animatedPlaceholders;
}
