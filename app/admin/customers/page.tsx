'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/lib/types/supabase';
import { Button } from '@/components/ui/Button';
import { Plus } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        const supabase = createClient();

        // Get all users with customer role
        const { data: userRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'customer')
          .eq('is_active', true);

        if (rolesError) throw rolesError;

        if (!userRoles || userRoles.length === 0) {
          setCustomers([]);
          setIsLoading(false);
          return;
        }

        const userIds = userRoles.map((r) => r.user_id);

        // Get profiles for these users
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds)
          .order('created_at', { ascending: false });

        if (profilesError) throw profilesError;

        setCustomers(profiles || []);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch customers');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="mb-2 md:mb-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h1 className="text-xl md:text-3xl font-semibold text-black">Customers</h1>
            <Button variant="primary" size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>
        <p className="text-gray-600">Loading customers...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full">
        <div className="mb-2 md:mb-6">
          <div className="flex items-center justify-between gap-4 mb-2">
            <h1 className="text-xl md:text-3xl font-semibold text-black">Customers</h1>
            <Button variant="primary" size="sm" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
        </div>
        <div className="p-4 bg-red-50 border-2 border-red-500 rounded-lg text-red-800">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-2 md:mb-6">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-xl md:text-3xl font-semibold text-black">Customers</h1>
            <p className="text-gray-600">
              Total: {customers.length} customer{customers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button variant="primary" size="sm" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add
          </Button>
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="p-8 text-center border-2 border-gray-200 rounded-lg">
          <p className="text-gray-600">No customers found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="p-6 border-2 border-black rounded-lg bg-white"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold text-black">
                    {customer.first_name} {customer.last_name}
                  </h3>
                  <p className="text-gray-600 mt-1">ID: {customer.id}</p>
                  {customer.phone && (
                    <p className="text-gray-600">Phone: {customer.phone}</p>
                  )}
                  {customer.city && customer.state && (
                    <p className="text-gray-600">
                      Location: {customer.city}, {customer.state}
                    </p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  Joined: {new Date(customer.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

