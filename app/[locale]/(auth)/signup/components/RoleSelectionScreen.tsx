'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Hand, HardHat, User } from 'lucide-react';
import { GrUserWorker } from 'react-icons/gr';
import { FaPersonShelter } from 'react-icons/fa6';
import Logo from '@/components/Logo';
import { ProRoleScopeNotice } from '@/components/auth/ProRoleScopeNotice';
import type { ProAccountRole } from '@/lib/utils/proAccountRole';

interface RoleSelectionScreenProps {
  onRoleSelect: (role: 'customer' | 'contractor' | 'realtor' | 'installer' | 'handyman') => void;
  isLoading?: boolean;
}

function ProRoleCard({
  role,
  title,
  invitationLabel,
  description,
  icon,
  disabled,
  onSelect,
}: {
  role: ProAccountRole;
  title: string;
  invitationLabel: string;
  description: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <div className="w-full border-2 border-black rounded-lg bg-white overflow-hidden transition-all duration-300 hover:scale-[1.02]">
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="w-full p-2 bg-white hover:bg-gray-50 active:bg-gray-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left group"
      >
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-lg border-2 border-black bg-white flex items-center justify-center group-hover:bg-gray-100 transition-colors">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-black leading-snug">{title}</h3>
            <p className="text-xs font-normal text-red-500">{invitationLabel}</p>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>
      </button>
      <div className="px-2 pb-2">
        <ProRoleScopeNotice role={role} compact />
      </div>
    </div>
  );
}

export function RoleSelectionScreen({ onRoleSelect, isLoading = false }: RoleSelectionScreenProps) {
  const t = useTranslations('auth.signup.roleSelection');
  const router = useRouter();
  const locale = useLocale();

  return (
    <div className="w-full max-w-md mx-auto flex flex-col text-black md:pt-12">
      {/* Logo (with Pro Bot) */}
      <div className="flex items-center justify-center h-[40px] md:h-[95px] mt-8 md:mt-0 mb-6 md:mb-0 pb-4 md:pb-2 md:w-full animate-fade-in">
        <Link href={`/${locale}/businesslist`} className="cursor-pointer flex-shrink-0 w-full md:w-full">
          <Logo src="/hph-logo-with-pro-bot-mobile.png" width={400} height={100} className="h-full w-full md:w-full max-w-full object-contain" />
        </Link>
      </div>
      
      {/* Title */}
      <div className="flex items-center justify-center gap-3 mb-4 md:mb-6 md:pt-4 animate-slide-in-right">
        <h2 className="text-3xl font-semibold text-center">
          {t('title')}
        </h2>
      </div>

      {/* Role Selection Cards: Customer first, then Contractor, then Realtor */}
      <div className="space-y-4">
        {/* Customer Option */}
        <button
          type="button"
          onClick={() => onRoleSelect('customer')}
          disabled={isLoading}
          className="w-full p-2 border-2 border-black rounded-lg bg-white hover:bg-gray-50 active:bg-gray-100 transition-all duration-300 hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-left group"
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

        <ProRoleCard
          role="contractor"
          title={t('contractor.title')}
          invitationLabel={t('contractor.invitationCodeRequired')}
          description={t('contractor.description')}
          icon={<GrUserWorker className="w-6 h-6 text-red-500" />}
          disabled={isLoading}
          onSelect={() => onRoleSelect('contractor')}
        />

        <ProRoleCard
          role="installer"
          title={t('installer.title')}
          invitationLabel={t('installer.invitationCodeRequired')}
          description={t('installer.description')}
          icon={<HardHat className="w-6 h-6 text-red-500" />}
          disabled={isLoading}
          onSelect={() => onRoleSelect('installer')}
        />

        <ProRoleCard
          role="handyman"
          title={t('handyman.title')}
          invitationLabel={t('handyman.invitationCodeRequired')}
          description={t('handyman.description')}
          icon={<Hand className="w-6 h-6 text-red-500" />}
          disabled={isLoading}
          onSelect={() => onRoleSelect('handyman')}
        />

        <ProRoleCard
          role="realtor"
          title={t('realtor.title')}
          invitationLabel={t('realtor.invitationCodeRequired')}
          description={t('realtor.description')}
          icon={<FaPersonShelter className="w-6 h-6 text-red-500" />}
          disabled={isLoading}
          onSelect={() => onRoleSelect('realtor')}
        />
      </div>

      {/* Already have an account */}
      <div className="mt-3 flex flex-col gap-3">
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
