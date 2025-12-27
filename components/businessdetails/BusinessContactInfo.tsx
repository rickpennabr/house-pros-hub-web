'use client';

import { Phone, Mail } from 'lucide-react';

interface BusinessContactInfoProps {
  phone?: string;
  email?: string;
}

export default function BusinessContactInfo({ phone, email }: BusinessContactInfoProps) {
  const handlePhoneClick = () => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleEmailClick = () => {
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  };

  return (
    <div className="p-4 bg-white">
      <h2 className="text-xl font-bold text-black mb-4">Contact Information</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {phone && (
          <div 
            className="border-2 border-black rounded-lg bg-white p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={handlePhoneClick}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Phone</p>
                <p className="text-lg font-semibold text-black break-all">{phone}</p>
              </div>
            </div>
          </div>
        )}

        {email && (
          <div 
            className="border-2 border-black rounded-lg bg-white p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={handleEmailClick}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600 mb-1">Email</p>
                <p className="text-lg font-semibold text-black break-all">{email}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

