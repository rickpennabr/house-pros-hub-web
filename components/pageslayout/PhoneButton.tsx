'use client';

export default function PhoneButton() {
  const phoneNumber = '702-232-0411';
  
  const handlePhoneClick = () => {
    window.location.href = `tel:${phoneNumber.replace(/-/g, '')}`;
  };

  return (
    <button
      onClick={handlePhoneClick}
      className="
        relative h-10 px-2 
        bg-white text-black 
        rounded-lg border-2 border-black 
        font-bold text-[11px] md:text-[13px]
        flex items-center justify-center
        cursor-pointer overflow-hidden
        transition-all duration-300
        hover:bg-gray-50 
        active:scale-95
      "
    >
      <span className="whitespace-nowrap tracking-wider">{phoneNumber}</span>
    </button>
  );
}

