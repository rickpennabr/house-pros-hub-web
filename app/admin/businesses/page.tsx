'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Business } from '@/lib/types/supabase';

export default function BusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();

        const { data, error: businessesError } = await supabase
          .from('businesses')
          .select('*')
          .order('created_at', { ascending: false });

        if (businessesError) throw businessesError;

        setBusinesses(data || []);
      } catch (err) {
        console.error('Error fetching businesses:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch businesses');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBusinesses();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-black mb-2">Businesses</h1>
        </div>
        <p className="text-gray-600">Loading businesses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-black mb-2">Businesses</h1>
        </div>
        <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg text-red-800">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-semibold text-black mb-2">Businesses</h1>
        <p className="text-gray-600">
          Total: {businesses.length} business{businesses.length !== 1 ? 'es' : ''}
        </p>
      </div>

      {businesses.length === 0 ? (
        <div className="p-8 text-center border-2 border-gray-200 rounded-lg">
          <p className="text-gray-600">No businesses found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {businesses.map((business) => (
            <div
              key={business.id}
              className="p-6 border-2 border-black rounded-lg bg-white"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-black">
                    {business.business_name}
                  </h3>
                  <p className="text-gray-600 mt-1">ID: {business.id}</p>
                  {business.email && (
                    <p className="text-gray-600">Email: {business.email}</p>
                  )}
                  {business.phone && (
                    <p className="text-gray-600">Phone: {business.phone}</p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        business.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {business.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs rounded ${
                        business.is_verified
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {business.is_verified ? 'Verified' : 'Unverified'}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Created: {new Date(business.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

