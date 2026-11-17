'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CustomerEstimatePreview, type CustomerEstimatePreviewData } from '@/components/estimates/CustomerEstimatePreview';

function PublicEstimateViewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const presentMode = searchParams.get('present') === '1';
  const [data, setData] = useState<CustomerEstimatePreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [depositPaymentUrl, setDepositPaymentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing link. Use the link from your estimate email.');
      setLoading(false);
      return;
    }
    fetch(`/api/estimates/public?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        setData(res as CustomerEstimatePreviewData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load estimate'))
      .finally(() => setLoading(false));
  }, [token]);

  const alreadyAccepted = data?.status === 'accepted';

  const handleApprove = async ({ signerName }: { signerName: string }) => {
    if (!token || !data) return;
    setApproveLoading(true);
    setApproveMessage(null);
    try {
      const res = await fetch('/api/estimates/public/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, signerName, signatureData: signerName }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to approve estimate');
      if (payload.status === 'already_accepted') {
        setApproveMessage('This estimate is already approved.');
      } else {
        const depositNote = payload.depositError
          ? `Estimate approved. The deposit invoice could not be created. ${payload.depositError}`
          : payload.depositPaymentUrl
            ? 'Estimate approved. Pay the deposit below to get started.'
            : payload.depositInvoiceId
              ? 'Estimate approved. The deposit is the first invoice on this estimate.'
              : 'Estimate approved successfully. Thank you.';
        const maintenanceNote =
          typeof payload.maintenanceError === 'string' && payload.maintenanceError
            ? ` ${payload.maintenanceError}`
            : payload.maintenancePlanId
              ? ' Maintenance visits are now on your place.'
              : '';
        setApproveMessage(`${depositNote}${maintenanceNote}`);
      }
      if (typeof payload.depositPaymentUrl === 'string' && payload.depositPaymentUrl) {
        setDepositPaymentUrl(payload.depositPaymentUrl);
      }
      setData((prev) =>
        prev
          ? {
              ...prev,
              status: 'accepted',
              signerName,
              signedAt: new Date().toISOString(),
            }
          : prev
      );
    } catch (err) {
      setApproveMessage(err instanceof Error ? err.message : 'Failed to approve estimate');
    } finally {
      setApproveLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center p-8 text-gray-500">Loading estimate...</div>;
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium">{error ?? 'Estimate not found.'}</p>
          <p className="text-sm text-gray-500 mt-2">Links expire after 30 days. Ask the sender for a new link.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CustomerEstimatePreview
        data={data}
        variant="public"
        presentMode={presentMode}
        onApprove={handleApprove}
        approveLoading={approveLoading}
        alreadyAccepted={alreadyAccepted}
        approveMessage={approveMessage}
      />
      {depositPaymentUrl ? (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-amber-200 bg-amber-50 p-4">
          <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-950">
              Payment is ready. Pay by card to start the work.
            </p>
            <a
              href={depositPaymentUrl}
              className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900"
            >
              Pay now
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function PublicEstimateViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-8 text-gray-500">Loading...</div>}>
      <PublicEstimateViewContent />
    </Suspense>
  );
}
