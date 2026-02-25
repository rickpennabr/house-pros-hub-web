'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { businessStorage } from '@/lib/storage/businessStorage';
import { ProCardData } from '@/components/proscard/ProCard';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';

export default function DeleteBusinessPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('Paver Up');
  const [, setRefresh] = useState(0);
  const businesses: ProCardData[] = businessStorage.getAllBusinesses();
  const [message, setMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const handleDelete = () => {
    if (!businessName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a business name' });
      return;
    }

    // Try to find the business with fuzzy matching
    const searchName = businessName.trim().toLowerCase();
    const foundBusiness = businesses.find(
      (b) =>
        b.businessName.toLowerCase().includes(searchName) ||
        searchName.includes(b.businessName.toLowerCase())
    );

    if (foundBusiness) {
      // If found with fuzzy match, use the exact name
      const deleted = businessStorage.deleteBusinessByName(
        foundBusiness.businessName
      );

      if (deleted) {
        setMessage({
          type: 'success',
          text: `Successfully deleted "${foundBusiness.businessName}"`,
        });
        // Refresh the businesses list
        setRefresh((v) => v + 1);
      } else {
        setMessage({
          type: 'error',
          text: `Failed to delete "${foundBusiness.businessName}"`,
        });
      }
    } else {
      // Show all business names to help user find the right one
      const allNames = businesses.map((b) => `"${b.businessName}"`).join(', ');
      setMessage({
        type: 'error',
        text: `Business "${businessName}" not found. Available businesses: ${
          allNames || 'None'
        }`,
      });
    }
  };

  return (
    <div className="w-full max-w-4xl">
      <AdminFloatingAddButton href="/admin/customers" ariaLabel="Add customer" />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-2">Delete Business</h1>
        <p className="text-gray-600">
          Delete businesses from local storage by entering the business name.
        </p>
      </div>

      <div className="bg-white border-2 border-black rounded-lg p-6 space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Name to Delete
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none"
            placeholder="Enter business name"
          />
        </div>

        {message && (
          <div
            className={`p-4 rounded-lg border-2 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-600 text-green-800'
                : message.type === 'error'
                ? 'bg-red-50 border-red-600 text-red-800'
                : 'bg-blue-50 border-blue-600 text-blue-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex gap-4">
          <button
            onClick={handleDelete}
            className="px-6 py-2 border-2 border-black bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Delete Business
          </button>
          <button
            onClick={() => router.push('/admin')}
            className="px-6 py-2 border-2 border-black bg-white text-black rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {businesses.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-4">All Businesses</h2>
          <div className="space-y-2">
            {businesses.map((business) => (
              <div
                key={business.id}
                className="p-4 border-2 border-gray-200 rounded-lg flex items-center justify-between"
              >
                <div>
                  <div className="font-medium">{business.businessName}</div>
                  <div className="text-sm text-gray-600">
                    {business.contractorType}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setBusinessName(business.businessName);
                  }}
                  className="px-4 py-1 text-sm border-2 border-black rounded-lg hover:bg-gray-50"
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

