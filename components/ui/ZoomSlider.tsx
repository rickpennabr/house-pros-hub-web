'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ZoomSliderProps {
  /** Initial zoom value (0-100) */
  initialZoom?: number;
  /** Callback when zoom changes */
  onZoomChange: (zoom: number) => void;
  /** Optional className */
  className?: string;
}

/**
 * ZoomSlider component provides a zoom control slider with a black track and red handle.
 */
export function ZoomSlider({ initialZoom = 50, onZoomChange, className = '' }: ZoomSliderProps) {
  const [zoom, setZoom] = useState(initialZoom);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updateZoom = useCallback((e: MouseEvent | React.MouseEvent | TouchEvent | React.TouchEvent) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : ('clientX' in e ? e.clientX : 0);
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    
    setZoom(percentage);
    onZoomChange(percentage);
  }, [onZoomChange]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    updateZoom(e);
  }, [updateZoom]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    updateZoom(e);
  }, [updateZoom]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      updateZoom(e);
    }
  }, [isDragging, updateZoom]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging) {
      e.preventDefault();
      updateZoom(e);
    }
  }, [isDragging, updateZoom]);

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
          style={{ left: `${zoom}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDragging(true);
          }}
        />
      </div>
    </div>
  );
}

