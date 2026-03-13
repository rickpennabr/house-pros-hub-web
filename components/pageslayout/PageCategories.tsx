'use client';

import { ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Filter } from 'lucide-react';
import { useCategory } from '@/contexts/CategoryContext';
import ExpandableSearchbar from './ExpandableSearchbar';
import { 
  ALL_CATEGORY,
  SERVICE_CATEGORIES,
  getCategoryItemForLabel,
} from '@/lib/constants/categories';
import { getBusinessCategories } from '@/lib/utils/businessSearch';
import { useBusinesses } from '@/hooks/useBusinesses';
import { sendAnalyticsIngest } from '@/lib/utils/analyticsIngest';

interface ServiceCategoriesProps {
  children?: ReactNode;
}

export default function ServiceCategories({ children }: ServiceCategoriesProps) {
  const { activeCategory, setActiveCategory, setSearchQuery } = useCategory();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const t = useTranslations('categories');
  const isSuppliersPage = pathname?.includes('/prosuppliers');
  const isHelpPage = pathname?.includes('/help');

  const { businesses } = useBusinesses();

  const handleFilterClick = () => {
    // Dispatch custom event to open filter modal in SuppliersList
    window.dispatchEvent(new CustomEvent('openSuppliersFilter'));
  };

  // Extract active categories from businesses
  const activeBusinessCategories = useMemo(() => {
    const categories = new Set<string>();
    businesses.forEach(business => {
      // Get all categories from all licenses, not just the primary category
      const businessCategories = getBusinessCategories(business);
      businessCategories.forEach(cat => categories.add(cat));
    });
    return Array.from(categories).sort();
  }, [businesses]);

  // If active category is no longer available, reset to 'All' (deferred to avoid setState-in-effect)
  useEffect(() => {
    if (activeCategory !== 'All' && !activeBusinessCategories.includes(activeCategory)) {
      const timeoutId = window.setTimeout(() => setActiveCategory('All'), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [activeBusinessCategories, activeCategory, setActiveCategory]);

  // Filter categories to only show those that have businesses.
  // Use real business list categories (contractorType, tradeName) so the bar shows e.g. "Handyman Interior" not only "General Contractor".
  const filteredCategories = useMemo(() => {
    const items = activeBusinessCategories.map((label) => getCategoryItemForLabel(label));
    return [ALL_CATEGORY, ...items];
  }, [activeBusinessCategories]);

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleSearchToggle = (isOpen: boolean) => {
    setIsSearchOpen(isOpen);
    if (!isOpen) {
      setSearchQuery(''); // Clear search when closing
    }
  };

  // Debug logging (development only)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !process.env.NEXT_PUBLIC_DEBUG_LOGGING) return;
    if (typeof window === 'undefined') return;
    const categoriesEl = categoriesRef.current;
    if (!categoriesEl) return;
    
    const checkDimensions = () => {
      const logData = {
        categoriesWidth: categoriesEl.offsetWidth,
        categoriesHeight: categoriesEl.offsetHeight,
        categoriesScrollWidth: categoriesEl.scrollWidth,
        categoriesClientWidth: categoriesEl.clientWidth,
        windowWidth: window.innerWidth,
        hasHorizontalOverflow: categoriesEl.scrollWidth > categoriesEl.clientWidth,
        isMobile: window.innerWidth < 768,
        isSearchOpen,
      };
      
      sendAnalyticsIngest({
        location: 'PageCategories.tsx:70',
        message: 'Categories dimensions',
        data: logData,
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'E',
      });
    };
    
    checkDimensions();
    const resizeObserver = new ResizeObserver(checkDimensions);
    resizeObserver.observe(categoriesEl);
    
    return () => resizeObserver.disconnect();
  }, [isSearchOpen]);

  const categoryClasses = (categoryLabel: string) => {
    // Base classes: same as PagesMenu, with whitespace-nowrap and shrink-0 for horizontal scrolling
    const baseClasses = 'group h-10 border-2 transition-all duration-300 font-medium flex items-center justify-center px-1.5 md:px-2 gap-1 whitespace-nowrap shrink-0 cursor-pointer hover:scale-105';
    // Active item: always use black border (not theme-aware)
    const activeClasses = 'bg-white border-black text-black rounded-lg';
    // Inactive item: use rounded-lg to match active shape, including on hover
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400 rounded-lg';
    
    return activeCategory === categoryLabel 
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div ref={categoriesRef} className="w-full min-h-[60px] h-[60px] border-b-2 border-black p-1 md:px-2 md:py-0 flex items-center relative overflow-hidden flex-shrink-0">
      {/* Filter button - Only on suppliers page, positioned to the right of search button */}
      {isSuppliersPage && (
        <button
          onClick={handleFilterClick}
          className={`absolute right-1 md:right-2 h-10 w-10 rounded-lg bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-all z-30 top-1/2 -translate-y-1/2 ${
            isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-label="Filter"
        >
          <Filter className="w-5 h-5 text-white" />
        </button>
      )}
      {/* Search Component */}
      <ExpandableSearchbar 
        onSearchChange={handleSearchChange}
        onSearchToggle={handleSearchToggle}
        placeholderKey={isHelpPage ? "help" : isSuppliersPage ? "suppliers" : "businesses"}
        shiftRight={isSuppliersPage}
      />

      {/* Categories - Hidden when search is open */}
      <div className={`flex-1 h-full flex items-center gap-1 md:gap-2 overflow-x-auto scrollbar-custom transition-opacity duration-300 pr-[52px] md:pr-[56px] min-w-0 md:ml-1 ${
        isSearchOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}>
        {filteredCategories.map((category) => {
          const Icon = category.icon;
          const translationKey = category.label.toLowerCase();
          const translatedLabel =
            category.label === 'All'
              ? t('all')
              : SERVICE_CATEGORIES.some((c) => c.label === category.label)
                ? t(translationKey as Parameters<typeof t>[0])
                : category.label;
          return (
            <button
              key={category.label}
              onClick={() => setActiveCategory(category.label)}
              className={categoryClasses(category.label)}
            >
              <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${category.label === 'All' ? '!text-black' : category.color}`} />
              {translatedLabel}
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

