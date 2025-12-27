'use client';

import { Phone } from 'lucide-react';

export default function FloatingPhoneButton() {
  const phoneNumber = '702-232-0411';
  
  const handlePhoneClick = () => {
    window.location.href = `tel:${phoneNumber.replace(/-/g, '')}`;
  };

  return (
    <button
      onClick={handlePhoneClick}
      className="
        fixed bottom-25 right-10 
        w-14 h-14 
        rounded-lg border-2 border-black 
        bg-black 
        flex items-center justify-center 
        cursor-pointer 
        hover:bg-gray-900 
        transition-all duration-300
        active:scale-95
        shadow-lg
        z-50
        md:hidden
      "
      aria-label={`Call ${phoneNumber}`}
    >
      <Phone className="h-6 w-6 text-white" />
    </button>
  );
}

