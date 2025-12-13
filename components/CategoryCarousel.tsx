'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  TreePine, 
  Square, 
  Grid3x3, 
  Home, 
  Droplet, 
  Zap, 
  Wind, 
  Paintbrush, 
  Layers, 
  RectangleHorizontal, 
  DoorOpen,
  Fence,
  Layout
} from 'lucide-react';

type CategoryItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

const serviceCategories: CategoryItem[] = [
  { label: 'Landscape', icon: TreePine, color: 'text-green-600' },
  { label: 'Pavers', icon: Square, color: 'text-amber-700' },
  { label: 'Tile', icon: Grid3x3, color: 'text-slate-600' },
  { label: 'Roofing', icon: Home, color: 'text-red-600' },
  { label: 'Plumbing', icon: Droplet, color: 'text-blue-500' },
  { label: 'Electrical', icon: Zap, color: 'text-yellow-500' },
  { label: 'HVAC', icon: Wind, color: 'text-cyan-500' },
  { label: 'Painting', icon: Paintbrush, color: 'text-purple-600' },
  { label: 'Flooring', icon: Layers, color: 'text-amber-800' },
  { label: 'Windows', icon: RectangleHorizontal, color: 'text-sky-400' },
  { label: 'Doors', icon: DoorOpen, color: 'text-amber-900' },
  { label: 'Fencing', icon: Fence, color: 'text-gray-600' },
  { label: 'Decking', icon: Layout, color: 'text-orange-700' },
];

export default function CategoryCarousel({ direction = 'right' }: { direction?: 'left' | 'right' }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);

  // Initialize scroll position for left direction
  useEffect(() => {
    if (scrollRef.current && contentRef.current && direction === 'left') {
      const content = contentRef.current;
      const contentWidth = content.scrollWidth / 2;
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = contentWidth;
        scrollPositionRef.current = contentWidth;
      }
    }
  }, [direction]);

  useEffect(() => {
    if (!scrollRef.current || !contentRef.current || isPaused) return;

    const scrollContainer = scrollRef.current;
    const content = contentRef.current;
    let animationFrameId: number;

    const scroll = () => {
      if (isPaused) return;
      
      const scrollSpeed = 1.5; // Increased speed for faster scrolling
      const contentWidth = content.scrollWidth / 2; // Since we duplicate content
      
      if (direction === 'right') {
        // Slide right (increasing scrollLeft)
        scrollPositionRef.current += scrollSpeed;
        if (scrollPositionRef.current >= contentWidth) {
          scrollPositionRef.current = 0;
        }
      } else {
        // Slide left (decreasing scrollLeft)
        scrollPositionRef.current -= scrollSpeed;
        if (scrollPositionRef.current <= 0) {
          scrollPositionRef.current = contentWidth;
        }
      }
      
      if (scrollContainer) {
        scrollContainer.scrollLeft = scrollPositionRef.current;
      }
      
      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isPaused, direction]);

  return (
    <div
      ref={scrollRef}
      className="overflow-x-auto overflow-y-hidden scrollbar-hide mb-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ scrollBehavior: 'auto' }}
    >
      <div ref={contentRef} className="flex gap-8 w-max">
        {/* Render items twice for seamless infinite scroll, excluding "All" */}
        {[...serviceCategories, ...serviceCategories].map((category, index) => {
          const Icon = category.icon;
          return (
            <div
              key={`${category.label}-${index}`}
              className="flex-shrink-0 flex flex-col items-center justify-center w-32 h-32 rounded-lg border-2 border-black bg-white"
            >
              <Icon className={`w-10 h-10 mb-2 ${category.color}`} />
              <span className="text-sm font-medium text-black text-center px-2">
                {category.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

