'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Phone } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { createLocalePath } from '@/lib/redirect';
import { COMPANY_INFO, HUB_WHATSAPP_URL } from '@/lib/constants/company';

interface SignInRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HUB_PHONE = COMPANY_INFO.supportPhone;
const HUB_TEL_URL = HUB_PHONE ? `tel:${HUB_PHONE.replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '+1$1$2$3')}` : '';

/**
 * Modal shown when a signed-out user tries to use a ProCard action other than Share
 * (e.g. view details, message, phone, links, reactions). Offers sign in, sign up,
 * phone, WhatsApp, and Chat with ProBot.
 */
export default function SignInRequiredModal({ isOpen, onClose }: SignInRequiredModalProps) {
  const router = useRouter();
  const locale = useLocale() as 'en' | 'es';
  const t = useTranslations('auth.signInRequiredModal');

  const signInPath = createLocalePath(locale, 'signin');
  const signUpPath = createLocalePath(locale, 'signup');
  const probotPath = createLocalePath(locale, 'probot') + '?contact=probot';

  const handleGoSignIn = () => {
    onClose();
    router.push(signInPath);
  };

  const handleSignUpNow = () => {
    onClose();
    router.push(signUpPath);
  };

  const handleProBotClick = () => {
    onClose();
    router.push(probotPath);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showHeader={true}
      title={t('title')}
      showCloseButton={true}
      maxWidth="md"
      preventCloseOnOverlayClick={true}
    >
      <div className="flex flex-col p-6">
        <p className="text-gray-700 mb-5 whitespace-pre-line">{t('message')}</p>
        <div className="grid grid-cols-2 gap-3">
          {/* Row 1: Sign in | Sign up */}
          <Button type="button" variant="primary" onClick={handleGoSignIn} className="w-full">
            {t('goSignIn')}
          </Button>
          <Button type="button" variant="secondary" onClick={handleSignUpNow} className="w-full">
            {t('signUpNow')}
          </Button>
        </div>
        {/* Divider: line — "Or for any other help contact the Hub" — line */}
        <div className="flex items-center gap-3 my-3 w-full" aria-hidden>
          <span className="flex-1 h-px bg-gray-300 min-w-0" />
          <span className="shrink-0 px-2 py-1 text-center text-sm text-gray-600 bg-white">
            {t('orContactHub')}
          </span>
          <span className="flex-1 h-px bg-gray-300 min-w-0" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {/* Row 2: Phone | WhatsApp */}
          {HUB_TEL_URL ? (
            <a
              href={HUB_TEL_URL}
              onClick={onClose}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-lg border-2 border-black bg-white px-4 py-2.5 text-sm font-medium text-black hover:bg-gray-50 transition-colors"
              aria-label={t('callTheHub')}
            >
              <Phone className="w-4 h-4 shrink-0" />
              {t('callTheHub')}
            </a>
          ) : null}
          {HUB_WHATSAPP_URL ? (
            <a
              href={HUB_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 rounded-lg border-2 border-black bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#20bd5a] transition-colors"
              aria-label={t('whatsapp')}
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              {t('whatsapp')}
            </a>
          ) : null}
        </div>
        {/* Row 3: ProBot button full width, icon left - navigates to probot with ProBot selected and input focused */}
        <Link
          href={probotPath}
          onClick={(e) => {
            e.preventDefault();
            handleProBotClick();
          }}
          className="mt-3 w-full flex items-center gap-3 rounded-lg border-2 border-black bg-gray-100 px-4 py-3 text-left font-medium text-black hover:bg-gray-200 transition-colors"
        >
          <span className="relative w-10 h-10 shrink-0 rounded-lg overflow-hidden bg-white border border-black">
            <Image
              src="/pro-bot-solo.png"
              alt=""
              fill
              className="object-contain"
              sizes="40px"
            />
          </span>
          <span>{t('chatWithProBot')}</span>
        </Link>
      </div>
    </Modal>
  );
}
