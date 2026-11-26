'use client';

import { PurchaseOrderList } from '@/components/crm/PurchaseOrderList';

/** CRM → Purchase orders: order materials from suppliers, send, confirm and receive them. */
export default function PurchaseOrdersPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 pb-28">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Purchase orders</h1>
        <p className="text-sm text-gray-600">Order materials from your suppliers. When they arrive, mark them received and the cost goes to the project.</p>
      </div>
      <PurchaseOrderList />
    </div>
  );
}
