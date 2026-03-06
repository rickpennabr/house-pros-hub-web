'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { createLocalePath } from '@/lib/redirect';

interface SignInRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal shown when a signed-out user tries to use a ProCard action other than Share
 * (e.g. view details, message, phone, links, reactions). Offers Go Sign in and Sign up Now.
 */
export default function SignInRequiredModal({ isOpen, onClose }: SignInRequiredModalProps) {
  const router = useRouter();
  const locale = useLocale() as 'en' | 'es';
  const t = useTranslations('auth.signInRequiredModal');

  const handleGoSignIn = () => {
    onClose();
    router.push(createLocalePath(locale, `signin`));
  };

  const handleSignUpNow = () => {
    onClose();
    router.push(createLocalePath(locale, `signup`));
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
      <div className="flex flex-col p-6 text-center">
        <p className="text-gray-700 mb-6 whitespace-pre-line">{t('message')}</p>
        <div className="flex flex-col gap-3">
          <Button type="button" variant="primary" onClick={handleGoSignIn} className="w-full">
            {t('goSignIn')}
          </Button>
          <Button type="button" variant="secondary" onClick={handleSignUpNow} className="w-full">
            {t('signUpNow')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
