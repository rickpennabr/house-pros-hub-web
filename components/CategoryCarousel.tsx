'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
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

// Pro pictures from public/thepros directory
const proPictures = [
  '/thepros/pro-1.jpg',
  '/thepros/ai_model_1.png',
  '/thepros/ai_model_2.png',
  '/thepros/pro-gemini-1.png',
  '/thepros/pro-gemini-2.png',
  '/thepros/pro-gemini-3.png',
  '/thepros/pro-gemini-4.png',
  '/thepros/pro-grok-1.png',
  '/thepros/pro-grok-2.png',
  '/thepros/pro-grok-3.png',
];

// Helper function to get a deterministic pro picture based on seed (index)
const getProPictureBySeed = (seed: number): string => {
  // Simple seeded "random" function for deterministic selection
  const pseudoRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  const index = Math.floor(pseudoRandom(seed) * proPictures.length);
  return proPictures[index];
};

// Helper function to get a random pro picture (for client-side updates)
const getRandomProPicture = (): string => {
  const picture = proPictures[Math.floor(Math.random() * proPictures.length)];
  return picture;
};

interface TradeCardProps {
  category: CategoryItem;
  index: number;
}

function TradeCard({ category, index }: TradeCardProps) {
  // Use deterministic values based on index for SSR/hydration consistency
  // Simple seeded "random" function for deterministic boolean
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };
  
  // Deterministic initial state based on index to prevent hydration mismatch
  const [showProPicture, setShowProPicture] = useState(() => seededRandom(index) > 0.5);
  const [currentProPicture, setCurrentProPicture] = useState<string>(() => getProPictureBySeed(index));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  // Deterministic delay based on index (0-10 seconds)
  const initialDelayRef = useRef<number>(seededRandom(index * 2) * 10000);

  useEffect(() => {
    // Set initial random delay for this card
    const initialTimeout = setTimeout(() => {
      // Start alternating every 10 seconds after initial delay
      intervalRef.current = setInterval(() => {
        setShowProPicture((prev) => {
          const newState = !prev;
          // When switching to pro picture, get a new random one from thepros directory
          if (newState) {
            setCurrentProPicture(getRandomProPicture());
          }
          return newState;
        });
      }, 10000);
    }, initialDelayRef.current);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const Icon = category.icon;

  return (
    <div
      className="flex-shrink-0 flex flex-col items-center justify-center w-32 h-32 rounded-lg border-2 border-black bg-white relative overflow-hidden"
    >
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${
          showProPicture ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <Icon className={`w-10 h-10 mb-2 ${category.color}`} />
        <span className="text-sm font-medium text-black text-center px-2">
          {category.label}
        </span>
      </div>
      <div
        className={`absolute inset-0 h-full w-full transition-opacity duration-500 ${
          showProPicture ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Image
          src={currentProPicture}
          alt="Professional"
          fill
          className="object-cover"
          sizes="128px"
          unoptimized
          onError={() => {
            // If image fails to load, try another random one from thepros directory
            setCurrentProPicture(getRandomProPicture());
          }}
        />
      </div>
    </div>
  );
}

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
      className="overflow-x-auto overflow-y-hidden scrollbar-category mb-3"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ scrollBehavior: 'auto' }}
    >
      <div ref={contentRef} className="flex gap-8 w-max">
        {/* Render items twice for seamless infinite scroll */}
        {[...serviceCategories, ...serviceCategories].map((category, index) => (
          <TradeCard key={`${category.label}-${index}`} category={category} index={index} />
        ))}
      </div>
    </div>
  );
}

