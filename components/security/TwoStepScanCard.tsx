'use client';

import { ReactNode, useState } from 'react';
import Image from 'next/image';
import { Check, Copy, Lock, ShieldCheck, Smartphone } from 'lucide-react';
import { HphQrCode } from '@/components/qr/HphQrCode';

export type TwoStepScanCopy = {
  title: string;
  heading: string;
  steps: [string, string, string];
  onThisPhone: string;
  openApp: string;
  cantScan: string;
  copyKey: string;
  copied: string;
  footer: string;
};

/** Groups of 4 so the key is easy to type by hand. */
function groupKey(secret: string): string {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}

/**
 * Setup screen for two-step sign-in: numbered steps beside a House Pros Hub QR code (our mark in
 * the middle, error correction H so it still scans), a scan-line animation, the manual key, and an
 * "open in authenticator app" link for people setting up on the same phone. Stacks on narrow
 * containers (phones, the Settings modal) using container queries.
 */
export function TwoStepScanCard({
  uri,
  secret,
  copy,
  children,
  footerAction,
}: {
  /** otpauth:// URI from Supabase enroll. */
  uri: string;
  secret: string;
  copy: TwoStepScanCopy;
  /** The 6-digit code form. */
  children: ReactNode;
  /** Cancel / sign out link under the form. */
  footerAction?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Clipboard blocked: the key is still visible to copy by hand. */
    }
  }

  return (
    <section className="@container overflow-hidden rounded-lg border-2 border-black bg-white text-black">
      <header className="flex items-center gap-3 bg-black px-4 py-3 text-white">
        <Image
          src="/house-pros-hub-logo-simble-bot-v2-white.png"
          alt="House Pros Hub"
          width={36}
          height={36}
          className="h-9 w-9 shrink-0 object-contain"
        />
        <p className="min-w-0 flex-1 truncate font-semibold">{copy.title}</p>
        <ShieldCheck className="h-5 w-5 shrink-0 text-red-500" aria-hidden />
      </header>

      <div className="grid gap-6 p-4 @lg:grid-cols-[1fr_auto] @lg:items-start @lg:p-6">
        <div className="order-2 min-w-0 @lg:order-1">
          <h2 className="text-xl font-bold leading-tight @lg:text-2xl">{copy.heading}</h2>
          <ol className="mt-4 space-y-0">
            {copy.steps.map((step, index) => (
              <li key={index} className="relative flex gap-3 pb-4 last:pb-0">
                {index < copy.steps.length - 1 ? (
                  <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-0.5 bg-gray-300" />
                ) : null}
                <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 border-black bg-white text-sm font-bold">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm leading-snug text-gray-800 @lg:text-base">{step}</p>
              </li>
            ))}
          </ol>
          <div className="mt-5 border-t-2 border-dashed border-gray-200 pt-4">{children}</div>
          {footerAction ? <div className="mt-3">{footerAction}</div> : null}
        </div>

        <div className="order-1 flex flex-col items-center gap-3 @lg:order-2">
          <div className="relative rounded-lg border-2 border-black bg-white p-2 shadow-[4px_4px_0_0_#000]">
            <span aria-hidden className="pointer-events-none absolute -left-1 -top-1 h-5 w-5 rounded-tl-md border-l-4 border-t-4 border-red-600" />
            <span aria-hidden className="pointer-events-none absolute -right-1 -top-1 h-5 w-5 rounded-tr-md border-r-4 border-t-4 border-red-600" />
            <span aria-hidden className="pointer-events-none absolute -bottom-1 -left-1 h-5 w-5 rounded-bl-md border-b-4 border-l-4 border-red-600" />
            <span aria-hidden className="pointer-events-none absolute -bottom-1 -right-1 h-5 w-5 rounded-br-md border-b-4 border-r-4 border-red-600" />
            <div className="relative overflow-hidden rounded-md">
              <HphQrCode value={uri} displaySize={208} className="block max-w-full" />
              <span aria-hidden className="hph-scan-line pointer-events-none absolute inset-x-0 top-0 h-10" />
            </div>
          </div>

          <a
            href={uri}
            className="flex w-full max-w-[232px] items-center justify-center gap-2 rounded-lg border-2 border-black bg-black px-3 py-2 text-sm font-semibold text-white @lg:bg-white @lg:text-black @lg:hover:bg-gray-50"
          >
            <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{copy.openApp}</span>
          </a>
          <p className="-mt-1 max-w-[232px] text-center text-xs text-gray-500">{copy.onThisPhone}</p>

          <details className="w-full max-w-[232px] text-xs text-gray-600">
            <summary className="cursor-pointer text-center font-medium underline">{copy.cantScan}</summary>
            <div className="mt-2 flex items-stretch gap-1.5">
              <code className="min-w-0 flex-1 break-all rounded-lg bg-gray-100 px-2 py-1.5 font-mono text-[13px] text-black">
                {groupKey(secret)}
              </code>
              <button
                type="button"
                onClick={() => void copySecret()}
                aria-label={copied ? copy.copied : copy.copyKey}
                title={copied ? copy.copied : copy.copyKey}
                className="flex w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white hover:bg-gray-50"
              >
                {copied ? <Check className="h-4 w-4 text-green-700" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </details>
        </div>
      </div>

      <footer className="flex items-center justify-center gap-2 border-t-2 border-black bg-gray-50 px-4 py-2.5 text-center text-xs text-gray-600">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {copy.footer}
      </footer>
    </section>
  );
}
