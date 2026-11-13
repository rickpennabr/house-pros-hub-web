'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CustomerEstimatePreview, type CustomerEstimatePreviewData } from '@/components/estimates/CustomerEstimatePreview';

function PublicEstimateViewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData] = useState<CustomerEstimatePreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);

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

  const handleApprove = async () => {
    if (!token || !data) return;
    setApproveLoading(true);
    setApproveMessage(null);
    try {
      const res = await fetch('/api/estimates/public/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to approve estimate');
      if (payload.status === 'already_accepted') {
        setApproveMessage('This estimate is already approved.');
      } else {
        const depositNote = payload.depositError
          ? `Estimate approved. The deposit invoice could not be created. ${payload.depositError}`
          : payload.depositInvoiceId
            ? 'Estimate approved. The deposit is the first invoice on this estimate.'
            : 'Estimate approved successfully. Thank you.';
        setApproveMessage(depositNote);
      }
      setData((prev) => (prev ? { ...prev, status: 'accepted' } : prev));
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
    <CustomerEstimatePreview
      data={data}
      variant="public"
      onApprove={handleApprove}
      approveLoading={approveLoading}
      alreadyAccepted={alreadyAccepted}
      approveMessage={approveMessage}
    />
  );
}

export default function PublicEstimateViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-8 text-gray-500">Loading...</div>}>
      <PublicEstimateViewContent />
    </Suspense>
  );
}
