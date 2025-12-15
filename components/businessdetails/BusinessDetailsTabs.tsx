'use client';

import { useState } from 'react';
import { CheckSquare, Link as LinkIcon, Building2 } from 'lucide-react';

type TabType = 'contact' | 'links' | 'about';

interface BusinessDetailsTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function BusinessDetailsTabs({ activeTab, onTabChange }: BusinessDetailsTabsProps) {
  const tabs = [
    { 
      id: 'contact' as TabType, 
      label: 'Contact', 
      icon: CheckSquare 
    },
    { 
      id: 'links' as TabType, 
      label: 'Links', 
      icon: LinkIcon 
    },
    { 
      id: 'about' as TabType, 
      label: 'About', 
      icon: Building2 
    },
  ];

  return (
    <div className="flex w-full h-full border-b-2 border-black">
      {tabs.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex-1 flex items-center justify-center gap-2 h-full px-4 font-medium transition-colors cursor-pointer ${
              isActive
                ? 'border-b-4 border-black bg-white'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

