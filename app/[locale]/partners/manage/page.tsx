'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { businessStorage } from '@/lib/storage/businessStorage';
import { partnerStorage, Partnership } from '@/lib/storage/partnerStorage';
import { ProCardData } from '@/components/proscard/ProCard';
import { Building2, Clock, CheckCircle2, UserMinus, ChevronRight, Users, Settings } from 'lucide-react';
import { Breadcrumb } from '@/components/ui/Breadcrumb';

export default function ManagePartnersPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const userBusinesses = useMemo<ProCardData[]>(() => {
    if (!userId) return [];
    return businessStorage.getBusinessesByUserId(userId);
  }, [userId]);

  const [selection, setSelection] = useState<{ userId: string; businessId: string }>(() => ({
    userId,
    businessId: '',
  }));
  const selectedBusinessId = selection.userId === userId ? selection.businessId : '';
  const effectiveSelectedBusinessId = selectedBusinessId || userBusinesses[0]?.id || '';

  const [, setRefresh] = useState(0);

  const partnerships: Partnership[] = (() => {
    if (!effectiveSelectedBusinessId) return [];

    const bizPartnerships = partnerStorage.getPartnershipsByBusinessId(effectiveSelectedBusinessId);

    // Filter out partnerships where the partner business doesn't exist in our storage
    // This automatically removes any old mock data that doesn't correspond to real businesses
    const allBusinesses = businessStorage.getAllBusinesses();
    return bizPartnerships.filter((p) => {
      const partnerId =
        p.requesterId === effectiveSelectedBusinessId ? p.receiverId : p.requesterId;
      return allBusinesses.some((b) => b.id === partnerId);
    });
  })();

  const requests = useMemo(() => 
    partnerships.filter(p => p.status === 'pending'), 
    [partnerships]
  );

  const activePartners = useMemo(() => 
    partnerships.filter(p => p.status === 'active'), 
    [partnerships]
  );

  const handleStatusUpdate = (partnershipId: string, status: Partnership['status']) => {
    partnerStorage.updateStatus(partnershipId, status);
    setRefresh((v) => v + 1);
  };

  const handleRemove = (partnershipId: string) => {
    if (confirm('Are you sure you want to remove this partner?')) {
      partnerStorage.removePartnership(partnershipId);
      setRefresh((v) => v + 1);
    }
  };

  // Helper to get partner business info (from storage or mock)
  const getPartnerInfo = (partnership: Partnership) => {
    const partnerId = partnership.requesterId === effectiveSelectedBusinessId 
      ? partnership.receiverId 
      : partnership.requesterId;
    
    const business = businessStorage.getAllBusinesses().find(b => b.id === partnerId);
    
    if (business) {
      return {
        name: business.businessName,
        logo: business.logo || business.businessLogo || null,
      };
    }

    return { name: 'Unknown Business', logo: null };
  };

  const getBusinessIcon = (business: ProCardData) => {
    const logo = business.logo || business.businessLogo;
    if (logo) {
      return (
        <div className="w-8 h-8 rounded-lg border border-black flex items-center justify-center shrink-0 overflow-hidden relative aspect-square">
          <Image
            src={logo}
            alt={business.businessName}
            fill
            className="object-cover"
            sizes="32px"
          />
        </div>
      );
    }
    return (
      <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
        <Building2 className="w-5 h-5 text-black" />
      </div>
    );
  };

  return (
    <div className="bg-white pb-12">
      <div className="w-full max-w-[960px] mx-auto p-2 md:p-2 py-2 md:py-4">
        
        {/* Breadcrumbs */}
        <Breadcrumb 
          items={[
            { label: 'Account Management', href: '/account-management', icon: Settings },
            { label: 'Manage Partners', icon: Users }
          ]}
        />

        {/* Select Business Section (Following Account Management Style) */}
        <div className="mb-4 md:mb-6">
          <h2 className="text-lg md:text-xl font-bold text-black mb-4">Select Business</h2>
          <div className="relative">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {userBusinesses.map((business) => (
                <button
                  key={business.id}
                  onClick={() => setSelection({ userId, businessId: business.id })}
                  className={`
                    relative flex items-center gap-3 px-4 py-3 rounded-lg border-2 transition-all flex-shrink-0 cursor-pointer
                    ${effectiveSelectedBusinessId === business.id 
                      ? 'bg-white border-black' 
                      : 'bg-white border-gray-300 hover:border-black'
                    }
                  `}
                >
                  {getBusinessIcon(business)}
                  <span className="text-sm md:text-base font-medium whitespace-nowrap">
                    {business.businessName}
                  </span>
                </button>
              ))}
            </div>
            {/* Scroll indicator */}
            <div className="absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none">
              <ChevronRight className="w-6 h-6 text-gray-400" />
            </div>
          </div>
        </div>

        {/* Partnership Requests Section */}
        <div className="mb-10">
          <h2 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2">
            Partnership Requests
            {requests.length > 0 && (
              <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                {requests.length}
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {requests.length === 0 ? (
              <div className="col-span-full border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
                No pending requests
              </div>
            ) : (
              requests.map((request) => {
                const info = getPartnerInfo(request);
                return (
                  <div key={request.id} className="bg-white border-2 border-black rounded-lg p-4 md:p-6 flex flex-col justify-between hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-4 mb-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative ${info.logo ? 'bg-white border-2 border-black' : 'bg-black'}`}>
                        {info.logo ? (
                          <Image src={info.logo} alt={info.name} fill className="object-cover" sizes="48px" />
                        ) : (
                          <Building2 className="w-6 h-6 text-white" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-800 mb-1 truncate">
                          {info.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wider">
                          <Clock className="w-3 h-3 text-yellow-600" />
                          Waiting Response
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{request.requestDate}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleStatusUpdate(request.id, 'active')}
                        className="flex-1 py-2 px-4 border-2 border-black bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors text-sm"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => handleStatusUpdate(request.id, 'rejected')}
                        className="flex-1 py-2 px-4 border-2 border-black bg-white text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors text-sm"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Business Partners Section */}
        <div>
          <h2 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center gap-2">
            Business Partners
            {activePartners.length > 0 && (
              <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                {activePartners.length}
              </span>
            )}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {activePartners.length === 0 ? (
              <div className="col-span-full border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
                You don&apos;t have any partners yet
              </div>
            ) : (
              activePartners.map((partner) => {
                const info = getPartnerInfo(partner);
                return (
                  <div key={partner.id} className="bg-white border-2 border-black rounded-lg p-4 md:p-6 flex flex-col justify-between hover:shadow-lg transition-shadow">
                    <div className="flex items-start gap-4 mb-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden relative ${info.logo ? 'bg-white border-2 border-black' : 'bg-black'}`}>
                        {info.logo ? (
                          <Image src={info.logo} alt={info.name} fill className="object-cover" sizes="48px" />
                        ) : (
                          <Building2 className="w-6 h-6 text-white" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-800 mb-1 truncate">
                          {info.name}
                        </h3>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-green-700 uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" />
                          Active Partner
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{partner.requestDate}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <button 
                      onClick={() => handleRemove(partner.id)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-4 border-2 border-black bg-white text-red-600 rounded-lg font-bold hover:bg-red-50 transition-colors text-sm"
                    >
                      <UserMinus className="w-4 h-4" />
                      Remove Partner
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
