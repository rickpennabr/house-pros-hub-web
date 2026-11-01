'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'hph-install-dismissed';

function runningStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = 'standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Offers Add to Home Screen in a modal. Chrome gives a native prompt. iPhone shows the Share steps.
 * Hidden once the site is already opened as an installed app.
 */
export function InstallAppButton() {
  const t = useTranslations('procam');
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (runningStandalone()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === '1') return;
    const apple = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      sessionStorage.setItem(DISMISS_KEY, '1');
      setDismissed(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const timer = window.setTimeout(() => {
      setIos(apple);
      setEligible(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    await promptEvent.userChoice;
    setPromptEvent(null);
    dismiss();
  };

  const show = eligible && !dismissed && (ios || Boolean(promptEvent));

  return (
    <Modal isOpen={show} onClose={dismiss} title={t('installTitle')} showHeader showCloseButton maxWidth="sm">
      <div className="space-y-3">
        <p className="text-sm">{ios ? t('installIos') : t('installHint')}</p>
        {promptEvent && (
          <Button type="button" onClick={() => void install()}>
            {t('install')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
