'use client';

import { Phone, Mail, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import MakeAppointmentCard from '@/components/businessdetails/MakeAppointmentCard';

interface BusinessContactInfoProps {
  phone?: string;
  email?: string;
  streetAddress?: string;
  apartment?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  appointmentHref?: string;
}

function locationLines(props: BusinessContactInfoProps): string[] {
  const street = props.streetAddress?.trim();
  const apartment = props.apartment?.trim();
  const cityLine = [props.city?.trim(), props.state?.trim()].filter(Boolean).join(', ');
  const cityStateZip = [cityLine, props.zipCode?.trim()].filter(Boolean).join(' ');
  return [street, apartment, cityStateZip].filter((line): line is string => Boolean(line));
}

export default function BusinessContactInfo({
  phone,
  email,
  streetAddress,
  apartment,
  city,
  state,
  zipCode,
  appointmentHref,
}: BusinessContactInfoProps) {
  const t = useTranslations('common.label');
  const lines = locationLines({ streetAddress, apartment, city, state, zipCode });
  const mapQuery = lines.join(', ');

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

  const handleLocationClick = () => {
    if (!mapQuery) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white md:p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {phone && (
          <div
            className="border-2 border-black rounded-lg bg-white p-2 md:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={handlePhoneClick}
          >
            <div className="flex items-center gap-2 md:gap-4">
              <div className="w-12 h-12 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0">
                <Phone className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-1">{t('phone')}</p>
                <p className="text-lg font-semibold text-black break-all">{phone}</p>
              </div>
            </div>
          </div>
        )}

        {email && (
          <div
            className="border-2 border-black rounded-lg bg-white p-2 md:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={handleEmailClick}
          >
            <div className="flex items-center gap-2 md:gap-4">
              <div className="w-12 h-12 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-black" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-1">{t('email')}</p>
                <p className="text-lg font-semibold text-black break-all">{email}</p>
              </div>
            </div>
          </div>
        )}

        {lines.length > 0 && (
          <div
            className="border-2 border-black rounded-lg bg-white p-2 md:p-4 cursor-pointer hover:bg-gray-50 transition-colors md:col-span-2"
            onClick={handleLocationClick}
          >
            <div className="flex items-center gap-2 md:gap-4">
              <div className="w-12 h-12 rounded-lg bg-white border-2 border-black flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-black" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-sm text-gray-600">{t('location')}</p>
                <p className="hidden whitespace-nowrap text-lg font-semibold text-black md:block">
                  {lines.join(' ')}
                </p>
                <div className="md:hidden">
                  {lines.map((line) => (
                    <p key={line} className="break-words text-lg font-semibold text-black">{line}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {appointmentHref ? (
          <div className="flex justify-end md:col-span-2">
            <MakeAppointmentCard href={appointmentHref} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
