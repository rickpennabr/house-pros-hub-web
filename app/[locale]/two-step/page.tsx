import type { Metadata } from 'next';
import { TwoStepChallenge } from '@/components/security/TwoStep';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Code page for accounts with two-step sign-in on (proxy.ts sends aal1 sessions here). */
export default async function TwoStepPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <main className="min-h-screen px-4">
      <TwoStepChallenge locale={locale} />
    </main>
  );
}
