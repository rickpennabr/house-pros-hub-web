'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface VerticalSliderProps {
  /** Initial position value (0-100) */
  initialPosition?: number;
  /** Callback when position changes */
  onPositionChange: (position: number) => void;
  /** Optional className */
  className?: string;
}

/**
 * VerticalSlider component provides a vertical position control slider with a black track and red handle.
 */
export function VerticalSlider({ initialPosition = 50, onPositionChange, className = '' }: VerticalSliderProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((e: MouseEvent | React.MouseEvent | TouchEvent) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const clientY = 'touches' in e ? e.touches[0].clientY : ('clientY' in e ? e.clientY : 0);
    const y = clientY - rect.top;
    const percentage = Math.max(0, Math.min(100, (y / rect.height) * 100));
    
    setPosition(percentage);
    onPositionChange(percentage);
  }, [onPositionChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    updatePosition(e);
  }, [updatePosition]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    updatePosition(e);
  }, [updatePosition]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      updatePosition(e);
    }
  }, [isDragging, updatePosition]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      updatePosition(e);
    }
  }, [isDragging, updatePosition]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  return (
    <div className={`h-full ${className}`}>
      <div
        ref={sliderRef}
        className="relative w-1 h-full bg-black rounded cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Slider handle */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-4 h-4 bg-red-500 rounded -translate-y-1/2 cursor-grab active:cursor-grabbing transition-transform hover:scale-110 z-10 touch-none"
          style={{ top: `${position}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDragging(true);
          }}
        />
      </div>
    </div>
  );
}

