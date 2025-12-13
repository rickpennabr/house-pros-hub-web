'use client';

import { useState, useEffect, useRef } from 'react';
import Logo from './Logo';
import { 
  Grid, 
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

interface LoginProps {
  onLogin?: (email: string, password: string) => void;
  onForgotPassword?: () => void;
  onSignUp?: (email: string, password: string, confirmPassword: string) => void;
}

type TabType = 'signin' | 'signup';

type CategoryItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const serviceCategories: CategoryItem[] = [
  { label: 'All', icon: Grid },
  { label: 'Landscape', icon: TreePine },
  { label: 'Pavers', icon: Square },
  { label: 'Tile', icon: Grid3x3 },
  { label: 'Roofing', icon: Home },
  { label: 'Plumbing', icon: Droplet },
  { label: 'Electrical', icon: Zap },
  { label: 'HVAC', icon: Wind },
  { label: 'Painting', icon: Paintbrush },
  { label: 'Flooring', icon: Layers },
  { label: 'Windows', icon: RectangleHorizontal },
  { label: 'Doors', icon: DoorOpen },
  { label: 'Fencing', icon: Fence },
  { label: 'Decking', icon: Layout },
];

export default function Login({ 
  onLogin, 
  onForgotPassword, 
  onSignUp 
}: LoginProps) {
  const [activeTab, setActiveTab] = useState<TabType>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      if (onLogin) {
        await onLogin(email, password);
      } else {
        // Default behavior - you can replace this with actual login logic
        console.log('Login attempt:', { email, password });
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (onSignUp) {
        await onSignUp(email, password, confirmPassword);
      } else {
        // Default behavior - you can replace this with actual signup logic
        console.log('Sign up attempt:', { email, password, confirmPassword });
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-full md:h-auto">
      <div className="border-2 border-black md:rounded-lg bg-white overflow-hidden h-full md:h-auto flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left Side - Carousel (Hidden on mobile) */}
          <div className="hidden md:block bg-white px-2 py-4 md:px-3 md:py-6 border-r-2 border-black">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              Sign in or Sign Up to find your House Pro.
            </h2>
            <CategoryCarousel direction="right" />
            <CategoryCarousel direction="left" />
          </div>

          {/* Right Side - Form */}
          <div className="p-6 md:p-8 flex flex-col flex-1 md:flex-none justify-between">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Logo width={200} height={50} className="h-12 w-auto" />
            </div>

            {/* Tab Navigation */}
            <div className="flex mb-6 border-b-2 border-black">
          <button
            type="button"
            onClick={() => setActiveTab('signin')}
            disabled={isLoading}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'signin'
                ? 'border-b-4 border-black bg-white'
                : 'bg-white hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('signup')}
            disabled={isLoading}
            className={`flex-1 py-3 px-4 font-medium transition-colors ${
              activeTab === 'signup'
                ? 'border-b-4 border-black bg-white'
                : 'bg-white hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            Sign Up
          </button>
        </div>

        {/* Sign In Form */}
        {activeTab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
          {/* Email Input */}
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium mb-2"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
              placeholder="Enter your email"
              disabled={isLoading}
            />
          </div>

          {/* Password Input */}
          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                placeholder="Enter your password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors"
                disabled={isLoading}
              >
                {showPassword ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m0 0l-2.4 2.4M21 21l-2.4-2.4M21 21l-3.228-3.228M21 21l-3.228-3.228"
                    />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Forgot Password Link */}
          {onForgotPassword && (
            <div className="text-right">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-gray-600 hover:text-black underline transition-colors"
                disabled={isLoading}
              >
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 border-2 border-black rounded-lg bg-white font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        )}

        {/* Sign Up Form */}
        {activeTab === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            {/* Email Input */}
            <div>
              <label 
                htmlFor="signup-email" 
                className="block text-sm font-medium mb-2"
              >
                Email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>

            {/* Password Input */}
            <div>
              <label 
                htmlFor="signup-password" 
                className="block text-sm font-medium mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="signup-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                  placeholder="Create a password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors"
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m0 0l-2.4 2.4M21 21l-2.4-2.4M21 21l-3.228-3.228M21 21l-3.228-3.228"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <label 
                htmlFor="confirm-password" 
                className="block text-sm font-medium mb-2"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 pr-10 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-black transition-colors"
                  disabled={isLoading}
                >
                  {showConfirmPassword ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228L3 3m0 0l-2.4 2.4M21 21l-2.4-2.4M21 21l-3.228-3.228M21 21l-3.228-3.228"
                      />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 border-2 border-black rounded-lg bg-white font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>
        )}

            {/* Footer */}
            <div className="mt-6 pt-6 border-t border-black">
              <p className="text-xs text-center text-gray-500">
                By {activeTab === 'signin' ? 'signing in' : 'signing up'}, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Category Carousel Component
function CategoryCarousel({ direction = 'right' }: { direction?: 'left' | 'right' }) {
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
      
      const scrollSpeed = 0.5; // Adjust speed here
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
        {[...serviceCategories.filter(cat => cat.label !== 'All'), ...serviceCategories.filter(cat => cat.label !== 'All')].map((category, index) => {
          const Icon = category.icon;
          return (
            <div
              key={`${category.label}-${index}`}
              className="flex-shrink-0 flex flex-col items-center justify-center w-32 h-32 rounded-lg border-2 border-black bg-white hover:bg-gray-50 transition-colors"
            >
              <Icon className="w-10 h-10 mb-2 text-black" />
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

