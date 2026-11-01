'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface CategoryContextType {
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  /** Mobile header and main menu hide while the category search bar is open. */
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <CategoryContext.Provider value={{ activeCategory, setActiveCategory, searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen }}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategory() {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
}

