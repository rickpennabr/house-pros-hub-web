'use client';

import { ReactNode, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Mountain, Trees } from 'lucide-react';
import { useCategory } from '@/contexts/CategoryContext';
import ExpandableSearchbar from './ExpandableSearchbar';
import {
  ALL_CATEGORY,
  SERVICE_CATEGORIES,
  getCategoryItemForLabel,
} from '@/lib/constants/categories';
import { useBusinessCategories } from '@/hooks/useBusinessCategories';
import { directoryPath } from '@/lib/data/directoryParams';
import { sendAnalyticsIngest } from '@/lib/utils/analyticsIngest';

interface ServiceCategoriesProps {
  children?: ReactNode;
}

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const { overflowY } = window.getComputedStyle(node);
    if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') return node;
    node = node.parentElement;
  }
  return null;
}

/** Put the search bar on the top edge of the screen, or of the scrolling card on desktop. */
function scrollSearchBarToTop(bar: HTMLElement) {
  const scroller = findScrollParent(bar);
  const barTop = bar.getBoundingClientRect().top;
  const portTop = scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0;
  const delta = barTop - portTop;
  if (Math.abs(delta) <= 1) return;
  if (scroller) scroller.scrollBy({ top: delta, behavior: 'auto' });
  else window.scrollBy({ top: delta, behavior: 'auto' });
}

function hidesCategoryBar(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname.includes('/prosuppliers') ||
    pathname.includes('/proproducts') ||
    pathname.includes('/projobs') ||
    pathname.includes('/proresume') ||
    pathname.includes('/quick-repair')
  );
}

export default function ServiceCategories({ children }: ServiceCategoriesProps) {
  const pathname = usePathname();
  if (hidesCategoryBar(pathname)) return null;
  return <ServiceCategoriesBar>{children}</ServiceCategoriesBar>;
}

function ServiceCategoriesBar({ children }: ServiceCategoriesProps) {
  const { activeCategory, setActiveCategory, setSearchQuery, isSearchOpen, setIsSearchOpen } = useCategory();
  const categoriesRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('categories');
  const tBlog = useTranslations('blog');
  const isHelpPage = pathname?.includes('/help');
  const isBlogPage = pathname?.includes('/blog') ?? false;
  const isBlogArticle = /\/blog\/[^/]+/.test(pathname ?? '');
  const locale = pathname?.split('/').filter(Boolean)[0] || 'en';
  const isBusinessList = pathname?.includes('/businesslist') ?? false;
  const urlCategory = searchParams.get('category') || 'All';
  const selectedCategory = isBusinessList ? urlCategory : activeCategory;

  const { categories: activeBusinessCategories, isLoading: categoriesLoading } = useBusinessCategories();

  useEffect(() => {
    if (isBlogPage) {
      if (activeCategory !== 'All' && activeCategory !== 'hardscape' && activeCategory !== 'landscape') {
        const timeoutId = window.setTimeout(() => setActiveCategory('All'), 0);
        return () => window.clearTimeout(timeoutId);
      }
      return;
    }
    if (categoriesLoading) return;
    if (activeCategory !== 'All' && !activeBusinessCategories.includes(activeCategory)) {
      const timeoutId = window.setTimeout(() => setActiveCategory('All'), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [activeBusinessCategories, activeCategory, categoriesLoading, isBlogPage, setActiveCategory]);

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
      setSearchQuery('');
    }
  };

  useLayoutEffect(() => {
    if (!isSearchOpen) return;
    const bar = categoriesRef.current;
    if (!bar) return;
    scrollSearchBarToTop(bar);
    const frame = requestAnimationFrame(() => scrollSearchBarToTop(bar));
    return () => cancelAnimationFrame(frame);
  }, [isSearchOpen]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !process.env.NEXT_PUBLIC_DEBUG_LOGGING) return;
    if (typeof window === 'undefined') return;
    const categoriesEl = categoriesRef.current;
    if (!categoriesEl) return;

    const checkDimensions = () => {
      sendAnalyticsIngest({
        location: 'PageCategories.tsx:70',
        message: 'Categories dimensions',
        data: {
          categoriesWidth: categoriesEl.offsetWidth,
          categoriesHeight: categoriesEl.offsetHeight,
          categoriesScrollWidth: categoriesEl.scrollWidth,
          categoriesClientWidth: categoriesEl.clientWidth,
          windowWidth: window.innerWidth,
          hasHorizontalOverflow: categoriesEl.scrollWidth > categoriesEl.clientWidth,
          isMobile: window.innerWidth < 768,
          isSearchOpen,
        },
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
    const baseClasses =
      'group h-10 border-2 transition-all duration-300 font-medium flex items-center justify-center px-1.5 md:px-2 gap-1 whitespace-nowrap shrink-0 cursor-pointer hover:scale-105';
    const activeClasses = 'bg-black border-black text-white rounded-lg';
    const inactiveClasses = 'bg-transparent border-transparent text-black hover:border-gray-400 rounded-lg';

    return selectedCategory === categoryLabel
      ? `${baseClasses} ${activeClasses}`
      : `${baseClasses} ${inactiveClasses}`;
  };

  return (
    <div
      ref={categoriesRef}
      className="relative flex h-[60px] min-h-[60px] w-full flex-shrink-0 items-center overflow-hidden border-b-2 border-black p-1 md:px-2 md:py-0"
    >
      <ExpandableSearchbar
        onSearchChange={handleSearchChange}
        onSearchToggle={handleSearchToggle}
        placeholder={isBlogPage ? tBlog('search') : undefined}
        placeholderKey={isHelpPage ? 'help' : 'businesses'}
      />

      <div
        className={`flex h-full min-w-0 flex-1 items-center gap-1 overflow-x-auto pr-[52px] transition-opacity duration-300 scrollbar-custom md:ml-1 md:gap-2 md:pr-[56px] ${
          isSearchOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        {isBlogPage
          ? (
              [
                { id: 'All', label: t('all'), icon: ALL_CATEGORY.icon, color: '!text-black' },
                { id: 'hardscape', label: tBlog('hardscape'), icon: Mountain, color: 'text-stone-700' },
                { id: 'landscape', label: tBlog('landscape'), icon: Trees, color: 'text-green-700' },
              ] as const
            ).map((category) => {
              const Icon = category.icon;
              return (
                <button
                  key={category.id}
                  onClick={() => {
                    setActiveCategory(category.id);
                    if (isBlogArticle) router.push(`/${locale}/blog`);
                  }}
                  className={categoryClasses(category.id)}
                >
                  <Icon
                    className={`h-4 w-4 transition-transform duration-300 group-hover:scale-110 ${
                      category.id === 'All' && activeCategory === 'All' ? 'text-white' : category.color
                    }`}
                  />
                  {category.label}
                </button>
              );
            })
          : filteredCategories.map((category) => {
              const Icon = category.icon;
              const translationKey = category.label.toLowerCase();
              const translatedLabel =
                category.label === 'All'
                  ? t('all')
                  : SERVICE_CATEGORIES.some((c) => c.label === category.label)
                    ? t(translationKey as Parameters<typeof t>[0])
                    : category.label;
              return isBusinessList ? (
                <Link
                  key={category.label}
                  href={`/${locale}${directoryPath(category.label, searchParams.get('city'))}`}
                  scroll={false}
                  onClick={() => setSearchQuery('')}
                  className={categoryClasses(category.label)}
                >
                  <Icon
                    className={`h-4 w-4 transition-transform duration-300 group-hover:scale-110 ${
                      category.label === 'All'
                        ? selectedCategory === 'All'
                          ? 'text-white'
                          : 'text-black'
                        : category.color
                    }`}
                  />
                  {translatedLabel}
                </Link>
              ) : (
                <button
                  key={category.label}
                  onClick={() => setActiveCategory(category.label)}
                  className={categoryClasses(category.label)}
                >
                  <Icon
                    className={`h-4 w-4 transition-transform duration-300 group-hover:scale-110 ${
                      category.label === 'All'
                        ? selectedCategory === 'All'
                          ? 'text-white'
                          : 'text-black'
                        : category.color
                    }`}
                  />
                  {translatedLabel}
                </button>
              );
            })}
      </div>
      {children}
    </div>
  );
}
