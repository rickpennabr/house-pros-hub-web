'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';
import {
  clearAllLocalData,
  clearAuthData,
  clearBusinessData,
} from '@/lib/utils/clearLocalData';

export default function ClearDataPage() {
  const [status, setStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleClearAll = () => {
    if (
      !confirm(
        'Are you sure you want to clear ALL local data? This cannot be undone.'
      )
    ) {
      return;
    }

    setIsLoading(true);
    setStatus('Clearing all data...');

    try {
      clearAllLocalData();
      setStatus('✅ All local data cleared successfully!');
    } catch (error) {
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAuth = () => {
    if (!confirm('Are you sure you want to clear authentication data?')) {
      return;
    }

    setIsLoading(true);
    setStatus('Clearing auth data...');

    try {
      clearAuthData();
      setStatus('✅ Authentication data cleared!');
    } catch (error) {
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearBusiness = () => {
    if (!confirm('Are you sure you want to clear business data?')) {
      return;
    }

    setIsLoading(true);
    setStatus('Clearing business data...');

    try {
      clearBusinessData();
      setStatus('✅ Business data cleared!');
    } catch (error) {
      setStatus(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <AdminFloatingAddButton href="/admin/customers" ariaLabel="Add customer" />
      <div className="mb-6">
        <h1 className="text-3xl font-semibold mb-2">Clear Local Data</h1>
        <p className="text-gray-600 mb-6">
          Use this page to clear local storage data for testing Supabase
          integration.
        </p>
      </div>

      {status && (
        <div
          className={`p-4 rounded-lg border-2 mb-6 ${
            status.includes('✅')
              ? 'border-green-500 bg-green-50 text-green-800'
              : 'border-red-500 bg-red-50 text-red-800'
          }`}
        >
          {status}
        </div>
      )}

      <div className="space-y-4 mb-8">
        <Button
          onClick={handleClearAll}
          variant="primary"
          disabled={isLoading}
          className="w-full"
        >
          Clear All Local Data
        </Button>

        <Button
          onClick={handleClearAuth}
          variant="secondary"
          disabled={isLoading}
          className="w-full"
        >
          Clear Auth Data Only
        </Button>

        <Button
          onClick={handleClearBusiness}
          variant="secondary"
          disabled={isLoading}
          className="w-full"
        >
          Clear Business Data Only
        </Button>
      </div>

      <div className="mt-8 p-4 bg-yellow-50 border-2 border-yellow-500 rounded-lg">
        <h3 className="font-semibold mb-2">What gets cleared:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
          <li>Authentication data (user, token)</li>
          <li>Business data</li>
          <li>Saved businesses</li>
          <li>Partner data</li>
          <li>Feedback data</li>
          <li>All other localStorage items</li>
          <li>All sessionStorage items</li>
        </ul>
      </div>

      <div className="mt-4 p-4 bg-blue-50 border-2 border-blue-500 rounded-lg">
        <h3 className="font-semibold mb-2">After clearing:</h3>
        <p className="text-sm text-gray-700">
          You&apos;ll need to sign up again using Supabase authentication. Make sure
          your Supabase credentials are configured in{' '}
          <code className="bg-white px-1 rounded">.env.local</code>
        </p>
      </div>
    </div>
  );
}

