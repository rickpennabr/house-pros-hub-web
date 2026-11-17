'use client';

import { useRef, useState } from 'react';
import { CheckSquare, Clock, Home, Link as LinkIcon, Building2, Images, Package, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  normalizeBusinessTabOrder,
  reorderVisibleTabs,
  type BusinessDetailsTab,
} from '@/lib/constants/businessTabs';
import ShareProSection, { type ProSectionShareTarget } from '@/components/businessdetails/ShareProSection';

export type { BusinessDetailsTab };

interface BusinessDetailsTabsProps {
  activeTab: BusinessDetailsTab;
  onTabChange: (tab: BusinessDetailsTab) => void;
  /** Tabs allowed for this pro role (already filtered). */
  allowedTabs?: BusinessDetailsTab[];
  showServices?: boolean;
  showProducts?: boolean;
  showProperties?: boolean;
  showTrades?: boolean;
  /** Saved order. Missing tabs are filled from the default sequence. */
  tabOrder?: BusinessDetailsTab[];
  /** Owner can drag tabs. The new full order is passed back. */
  canReorder?: boolean;
  onReorder?: (order: BusinessDetailsTab[]) => void;
  /** Shown as an icon on the right of Services or Images while that tab is selected. */
  sectionShare?: ProSectionShareTarget;
}

const TAB_META: Record<
  BusinessDetailsTab,
  { labelKey: string; fallback: string; icon: typeof CheckSquare }
> = {
  contact: { labelKey: 'contact', fallback: 'Contact', icon: CheckSquare },
  hours: { labelKey: 'hours', fallback: 'Hours', icon: Clock },
  services: { labelKey: 'services', fallback: 'Services', icon: Wrench },
  products: { labelKey: 'products', fallback: 'Products', icon: Package },
  properties: { labelKey: 'properties', fallback: 'Properties', icon: Home },
  trades: { labelKey: 'trades', fallback: 'Trades', icon: Wrench },
  links: { labelKey: 'links', fallback: 'Links', icon: LinkIcon },
  images: { labelKey: 'images', fallback: 'Images', icon: Images },
  about: { labelKey: 'about', fallback: 'About', icon: Building2 },
};

export default function BusinessDetailsTabs({
  activeTab,
  onTabChange,
  allowedTabs,
  showServices = false,
  showProducts = false,
  showProperties = false,
  showTrades = false,
  tabOrder,
  canReorder = false,
  onReorder,
  sectionShare,
}: BusinessDetailsTabsProps) {
  const t = useTranslations('businessServices');
  const tHours = useTranslations('businessHours');
  const tTabs = useTranslations('businessTabs');
  const tImages = useTranslations('businessForm.images');
  const tProducts = useTranslations('businessProducts');
  const tProperties = useTranslations('businessProperties');
  const tTrades = useTranslations('businessTrades');
  const dragFrom = useRef<number | null>(null);
  const didDrag = useRef(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fullOrder = (allowedTabs && allowedTabs.length > 0
    ? allowedTabs
    : normalizeBusinessTabOrder(tabOrder)
  ).filter((id) => {
    if (id === 'services') return showServices;
    if (id === 'products') return showProducts;
    if (id === 'properties') return showProperties;
    if (id === 'trades') return showTrades;
    return true;
  });

  const tabs = fullOrder.map((id) => {
    const meta = TAB_META[id];
    let label = meta.fallback;
    try {
      if (id === 'hours') label = tHours('tab');
      else if (id === 'services') label = t('tab');
      else if (id === 'products') label = tProducts('tab');
      else if (id === 'properties') label = tProperties('tab');
      else if (id === 'trades') label = tTrades('tab');
      else if (id === 'images') label = tTabs('images');
      else if (id === 'contact') label = tTabs('contact');
      else if (id === 'links') label = tTabs('links');
      else if (id === 'about') label = tTabs('about');
    } catch {
      label = meta.fallback;
    }
    return { id, label, icon: meta.icon };
  });

  const reorderEnabled = canReorder && Boolean(onReorder) && tabs.length > 1;

  return (
    <div className="flex h-[60px] w-full min-w-0 flex-shrink-0 items-center border-b-2 border-black px-1 md:h-[69px] md:px-[6px]">
      <div className="scrollbar-category h-full min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex h-full w-max items-center gap-2 md:w-full md:justify-between">
          {tabs.map(({ id, label, icon: Icon }, index) => {
            const isActive = activeTab === id;
            const shareSection = id === 'services' || id === 'images' ? id : null;
            const showSectionShare = Boolean(isActive && shareSection && sectionShare);
            const tabClassName = `group flex h-10 min-w-max shrink-0 items-center justify-center rounded-lg border-2 px-2.5 font-medium transition-all duration-300 md:px-4 ${
              reorderEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer hover:scale-[1.02]'
            } ${draggingIndex === index ? 'opacity-40' : ''} ${
              dragOverIndex === index && draggingIndex !== null && draggingIndex !== index
                ? 'outline outline-2 outline-offset-2 outline-black'
                : ''
            } ${
              isActive
                ? 'border-black bg-black text-white'
                : 'border-transparent bg-transparent text-black hover:border-gray-400'
            }`;
            const tabBody = (
              <>
                <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 text-red-500 transition-transform duration-300 group-hover:scale-110 md:h-[1.35rem] md:w-[1.35rem] lg:h-[1.575rem] lg:w-[1.575rem]" />
                <span className="whitespace-nowrap text-sm md:text-base lg:text-lg">{label}</span>
              </>
            );
            if (showSectionShare && shareSection && sectionShare) {
              return (
                <div key={id} className={`${tabClassName} gap-2`}>
                  <button
                    type="button"
                    draggable={reorderEnabled}
                    title={reorderEnabled ? tTabs('dragHint') : undefined}
                    onClick={() => {
                      if (didDrag.current) {
                        didDrag.current = false;
                        return;
                      }
                      onTabChange(id);
                    }}
                    onDragStart={(event) => {
                      if (!reorderEnabled) return;
                      dragFrom.current = index;
                      didDrag.current = true;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', id);
                      const from = index;
                      requestAnimationFrame(() => setDraggingIndex(from));
                    }}
                    onDragOver={(event) => {
                      if (dragFrom.current === null) return;
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                      if (dragOverIndex !== index) setDragOverIndex(index);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const from = dragFrom.current;
                      dragFrom.current = null;
                      setDraggingIndex(null);
                      setDragOverIndex(null);
                      if (from === null || from === index || !onReorder) return;
                      onReorder(reorderVisibleTabs(fullOrder, tabs.map((tab) => tab.id), from, index));
                    }}
                    onDragEnd={() => {
                      dragFrom.current = null;
                      setDraggingIndex(null);
                      setDragOverIndex(null);
                      setTimeout(() => {
                        didDrag.current = false;
                      }, 0);
                    }}
                    className="flex items-center gap-1 bg-transparent font-medium text-inherit md:gap-2.5"
                  >
                    {tabBody}
                  </button>
                  <ShareProSection
                    {...sectionShare}
                    section={shareSection}
                    label=""
                    title={shareSection === 'images' ? tImages('shareTitle') : t('shareTitle')}
                    message={
                      shareSection === 'images'
                        ? tImages('shareMessage', { name: sectionShare.businessName })
                        : t('shareMessage', { name: sectionShare.businessName })
                    }
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white text-black hover:bg-gray-100"
                  />
                </div>
              );
            }
            return (
              <button
                key={id}
                type="button"
                draggable={reorderEnabled}
                title={reorderEnabled ? tTabs('dragHint') : undefined}
                onClick={() => {
                  if (didDrag.current) {
                    didDrag.current = false;
                    return;
                  }
                  onTabChange(id);
                }}
                onDragStart={(event) => {
                  if (!reorderEnabled) return;
                  dragFrom.current = index;
                  didDrag.current = true;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', id);
                  const from = index;
                  requestAnimationFrame(() => setDraggingIndex(from));
                }}
                onDragOver={(event) => {
                  if (dragFrom.current === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = dragFrom.current;
                  dragFrom.current = null;
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                  if (from === null || from === index || !onReorder) return;
                  onReorder(reorderVisibleTabs(fullOrder, tabs.map((tab) => tab.id), from, index));
                }}
                onDragEnd={() => {
                  dragFrom.current = null;
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                  setTimeout(() => {
                    didDrag.current = false;
                  }, 0);
                }}
                className={`${tabClassName} gap-1 md:gap-2.5`}
              >
                {tabBody}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
