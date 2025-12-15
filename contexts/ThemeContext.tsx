'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Theme = 'default' | 'colorful';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  getThemeClasses: (component: string) => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('default');

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme === 'default' || savedTheme === 'colorful') {
      setThemeState(savedTheme);
    }
  }, []);

  // Update CSS variables and document class based on theme
  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'colorful') {
      root.classList.add('theme-colorful');
      root.classList.remove('theme-default');
    } else {
      root.classList.add('theme-default');
      root.classList.remove('theme-colorful');
    }
  }, [theme]);

  // Monitor color changes for colorful theme and sync to CSS variable
  useEffect(() => {
    if (theme === 'colorful') {
      const updateColor = () => {
        const element = document.querySelector('.color-changing-bg') as HTMLElement;
        if (element) {
          const computedStyle = window.getComputedStyle(element);
          const bgColor = computedStyle.backgroundColor;
          document.documentElement.style.setProperty('--current-theme-color', bgColor || '#d4c5b9');
        }
      };

      // Update immediately
      updateColor();

      // Update periodically to sync with animation
      const interval = setInterval(updateColor, 300);
      return () => clearInterval(interval);
    } else {
      document.documentElement.style.setProperty('--current-theme-color', '#000000');
    }
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const getThemeClasses = (component: string): string => {
    if (theme === 'default') {
      return getDefaultClasses(component);
    } else {
      return getColorfulClasses(component);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, getThemeClasses }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Default theme classes (black borders, no background)
function getDefaultClasses(component: string): string {
  const classes: Record<string, string> = {
    background: 'bg-transparent',
    container: 'border-2 border-black',
    header: 'border-b-2 border-black',
    menu: 'border-b-2 border-black',
    categories: 'border-b-2 border-black',
    button: 'border-2 border-black',
    input: 'border-2 border-black',
  };
  return classes[component] || '';
}

// Colorful theme classes (synced colors - only for container, header, menu, and categories section)
function getColorfulClasses(component: string): string {
  const classes: Record<string, string> = {
    background: 'color-changing-bg',
    container: 'border-2 border-changing',
    header: 'border-b-2 border-changing',
    menu: 'border-b-2 border-changing',
    categories: 'border-b-2 border-changing', // Categories section border changes color
    button: 'border-2 border-black', // Buttons keep black border
    input: 'border-2 border-black', // Inputs keep black border
  };
  return classes[component] || '';
}

