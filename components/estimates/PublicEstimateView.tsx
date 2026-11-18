'use client';

import { useEffect, useState } from 'react';
import { CustomerEstimatePreview, type CustomerEstimatePreviewData } from '@/components/estimates/CustomerEstimatePreview';

interface PublicEstimateViewProps {
  token: string | null;
  presentMode?: boolean;
  /** Inside the chat viewer: no full-page height, the deposit bar sticks to the panel. */
  embedded?: boolean;
  /** The pro looking from the chat: no approve form. */
  readOnly?: boolean;
  onApproved?: () => void;
}

/** The customer's estimate from a public link: the /estimates/view page and the in-chat viewer. */
export function PublicEstimateView({ token, presentMode = false, embedded = false, readOnly = false, onApproved }: PublicEstimateViewProps) {
  const [data, setData] = useState<CustomerEstimatePreviewData | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState<string | null>(token ? null : 'Missing link. Use the link from your estimate email.');
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);
  const [depositPaymentUrl, setDepositPaymentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/estimates/public?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        if (!cancelled) setData(res as CustomerEstimatePreviewData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load estimate');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const alreadyAccepted = data?.status === 'accepted';
  const fill = embedded ? 'py-16' : 'min-h-screen';

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
      onApproved?.();
    } catch (err) {
      setApproveMessage(err instanceof Error ? err.message : 'Failed to approve estimate');
    } finally {
      setApproveLoading(false);
    }
  };

  if (loading) return <div className={`${fill} flex items-center justify-center p-8 text-gray-500`}>Loading estimate...</div>;
  if (error || !data) {
    return (
      <div className={`${fill} flex items-center justify-center p-8`}>
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
        variant={readOnly ? 'preview' : 'public'}
        presentMode={presentMode}
        embedded={embedded}
        onApprove={handleApprove}
        approveLoading={approveLoading}
        alreadyAccepted={alreadyAccepted}
        approveMessage={approveMessage}
      />
      {depositPaymentUrl ? (
        <div
          className={`${embedded ? 'sticky' : 'fixed inset-x-0'} bottom-0 z-20 border-t border-amber-200 bg-amber-50 p-4`}
        >
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
