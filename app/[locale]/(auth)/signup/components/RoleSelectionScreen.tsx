'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User } from 'lucide-react';
import { GrUserWorker } from 'react-icons/gr';

interface RoleSelectionScreenProps {
  onRoleSelect: (role: 'customer' | 'contractor') => void;
  isLoading?: boolean;
}

export function RoleSelectionScreen({ onRoleSelect, isLoading = false }: RoleSelectionScreenProps) {
  const t = useTranslations('auth.signup.roleSelection');
  const router = useRouter();
  const locale = useLocale();

  return (
    <div className="w-full max-w-md mx-auto flex flex-col text-black md:pt-12">
      {/* Logo */}
      <div className="flex items-center justify-center h-[40px] md:h-[95px] mt-8 md:mt-0 mb-6 md:mb-0 pb-4 md:pb-2 md:w-full animate-fade-in">
        <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full md:w-full">
          <Image
            src="/hph-logo-2.3.png"
            alt="House Pros Hub"
            width={400}
            height={100}
            className="h-full w-full md:w-full max-w-full object-contain"
            priority
          />
        </Link>
      </div>
      
      {/* Title */}
      <div className="flex items-center justify-center gap-3 mb-4 md:mb-6 md:pt-4 animate-slide-in-right">
        <h2 className="text-3xl font-semibold text-center">
          {t('title')}
        </h2>
      </div>

      {/* Role Selection Cards */}
      <div className="space-y-4">
        {/* Customer Option */}
        <button
          type="button"
          onClick={() => onRoleSelect('customer')}
          disabled={isLoading}
          className="w-full p-6 border-2 border-black rounded-lg bg-white hover:bg-gray-50 active:bg-gray-100 transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-black bg-white flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <User className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-black mb-1">
                {t('customer.title')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('customer.description')}
              </p>
            </div>
          </div>
        </button>

        {/* Contractor Option */}
        <button
          type="button"
          onClick={() => onRoleSelect('contractor')}
          disabled={isLoading}
          className="w-full p-6 border-2 border-black rounded-lg bg-white hover:bg-gray-50 active:bg-gray-100 transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left group"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-black bg-white flex items-center justify-center group-hover:bg-gray-100 transition-colors">
              <GrUserWorker className="w-6 h-6 text-red-500" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-black mb-1">
                {t('contractor.titleWithCode')}
              </h3>
              <p className="text-sm text-gray-600">
                {t('contractor.description')}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Already have an account */}
      <div className="mt-8 flex flex-col gap-3">
        <p className="text-sm text-gray-600 text-center">
          {t('alreadyHaveAccount')}
        </p>
        <button
          onClick={() => router.push(`/${locale}/signin`)}
          className="
            w-full px-4 md:px-5 py-2 md:py-2.5
            bg-black text-white 
            rounded-lg border-2 border-black 
            font-medium text-sm md:text-base
            flex items-center justify-center
            cursor-pointer
            transition-all
            hover:bg-gray-800
          "
        >
          {t('signInLink')}
        </button>
      </div>
    </div>
  );
}

