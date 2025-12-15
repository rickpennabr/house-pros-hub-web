'use client';

import { useState } from 'react';

type Language = 'es' | 'en';

interface LanguageSwitcherProps {
  className?: string;
}

export default function LanguageSwitcher({ className = '' }: LanguageSwitcherProps) {
  const [currentLanguage, setCurrentLanguage] = useState<Language>('es');

  const toggleLanguage = () => {
    setCurrentLanguage(prev => prev === 'es' ? 'en' : 'es');
    // TODO: Implement translation logic here
  };

  return (
    <button
      onClick={toggleLanguage}
      className={`
        h-10 px-2 md:px-4 
        bg-white border-2 border-black rounded-lg
        flex items-center justify-center gap-2 md:gap-3
        font-medium text-sm md:text-base
        cursor-pointer
        hover:bg-gray-50 
        active:bg-gray-100
        transition-all duration-200
        ${className}
      `}
      aria-label={`Switch language to ${currentLanguage === 'es' ? 'English' : 'Español'}`}
    >
      {currentLanguage === 'es' ? (
        <>
          {/* Spanish Flag */}
          <div className="flex-shrink-0 w-6 h-5 rounded-sm overflow-hidden border border-black/20 shadow-sm">
            <svg viewBox="0 0 27 18" className="w-full h-full">
              {/* Red stripe */}
              <rect y="0" width="27" height="6" fill="#AA151B" />
              {/* Yellow stripe */}
              <rect y="6" width="27" height="6" fill="#F1BF00" />
              {/* Red stripe */}
              <rect y="12" width="27" height="6" fill="#AA151B" />
            </svg>
          </div>
          <span className="hidden md:inline whitespace-nowrap">Español</span>
        </>
      ) : (
        <>
          {/* English Label */}
          <span className="hidden md:inline whitespace-nowrap">English</span>
          {/* US Flag */}
          <div className="flex-shrink-0 w-6 h-5 rounded-sm overflow-hidden border border-black/20 shadow-sm">
            <svg viewBox="0 0 27 18" className="w-full h-full">
              {/* Background white stripes */}
              <rect y="0" width="27" height="18" fill="#FFFFFF" />
              {/* Blue canton */}
              <rect x="0" y="0" width="11" height="8" fill="#002868" />
              {/* Red stripes (alternating) */}
              <rect y="0" width="27" height="1.4" fill="#BF0A30" />
              <rect y="2.8" width="27" height="1.4" fill="#BF0A30" />
              <rect y="5.6" width="27" height="1.4" fill="#BF0A30" />
              <rect y="8.4" width="27" height="1.4" fill="#BF0A30" />
              <rect y="11.2" width="27" height="1.4" fill="#BF0A30" />
              <rect y="14" width="27" height="1.4" fill="#BF0A30" />
              <rect y="16.8" width="27" height="1.2" fill="#BF0A30" />
              {/* Stars (simplified pattern in canton) */}
              <circle cx="1.5" cy="1.2" r="0.3" fill="#FFFFFF" />
              <circle cx="3.5" cy="1.2" r="0.3" fill="#FFFFFF" />
              <circle cx="5.5" cy="1.2" r="0.3" fill="#FFFFFF" />
              <circle cx="7.5" cy="1.2" r="0.3" fill="#FFFFFF" />
              <circle cx="9.5" cy="1.2" r="0.3" fill="#FFFFFF" />
              <circle cx="1.5" cy="3.2" r="0.3" fill="#FFFFFF" />
              <circle cx="3.5" cy="3.2" r="0.3" fill="#FFFFFF" />
              <circle cx="5.5" cy="3.2" r="0.3" fill="#FFFFFF" />
              <circle cx="7.5" cy="3.2" r="0.3" fill="#FFFFFF" />
              <circle cx="9.5" cy="3.2" r="0.3" fill="#FFFFFF" />
              <circle cx="2.5" cy="2.2" r="0.3" fill="#FFFFFF" />
              <circle cx="4.5" cy="2.2" r="0.3" fill="#FFFFFF" />
              <circle cx="6.5" cy="2.2" r="0.3" fill="#FFFFFF" />
              <circle cx="8.5" cy="2.2" r="0.3" fill="#FFFFFF" />
            </svg>
          </div>
        </>
      )}
    </button>
  );
}

