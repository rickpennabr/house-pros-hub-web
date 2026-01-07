'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface HorizontalSliderProps {
  /** Initial position value (0-100) */
  initialPosition?: number;
  /** Callback when position changes */
  onPositionChange: (position: number) => void;
  /** Optional className */
  className?: string;
}

/**
 * HorizontalSlider component provides a horizontal position control slider with a black track and red handle.
 */
export function HorizontalSlider({ initialPosition = 50, onPositionChange, className = '' }: HorizontalSliderProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : ('clientX' in e ? e.clientX : 0);
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
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
    <div className={`w-full ${className}`}>
      <div
        ref={sliderRef}
        className="relative w-full h-1 bg-black rounded cursor-pointer"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Slider handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-500 rounded -translate-x-1/2 cursor-grab active:cursor-grabbing transition-transform hover:scale-110 z-10 touch-none"
          style={{ left: `${position}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDragging(true);
          }}
        />
      </div>
    </div>
  );
}

