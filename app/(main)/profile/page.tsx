'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { User, Mail, Building2, Briefcase } from 'lucide-react';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect to signin if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/signin?returnUrl=/profile');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg border-2 border-black p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-6 text-black">My Profile</h1>
        
        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-center gap-4 pb-6 border-b-2 border-black">
            <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center text-white text-2xl font-bold">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-black">
                {user.firstName} {user.lastName}
              </h2>
              {user.companyName && (
                <p className="text-gray-600 mt-1">{user.companyName}</p>
              )}
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-4 mt-1">
            <h2 className="text-xl font-bold text-black mb-4">Personal Information</h2>
            
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Mail className="w-5 h-5 text-black mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-600">Email</div>
                <div className="text-base text-black">{user.email}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <User className="w-5 h-5 text-black mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-gray-600">Full Name</div>
                <div className="text-base text-black">
                  {user.firstName} {user.lastName}
                </div>
              </div>
            </div>
          </div>

          {/* Company Information */}
          {(user.companyName || user.companyRole) && (
            <div className="space-y-4 pt-4 border-t-2 border-gray-200">
              <h2 className="text-xl font-semibold text-black mb-4">Company Information</h2>
              
              {user.companyName && (
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Building2 className="w-5 h-5 text-black mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-600">Company Name</div>
                    <div className="text-base text-black">{user.companyName}</div>
                  </div>
                </div>
              )}

              {user.companyRole && (
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <Briefcase className="w-5 h-5 text-black mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-600">Role</div>
                    <div className="text-base text-black">{user.companyRole}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

