'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import BusinessHeroImage from '@/components/businessdetails/BusinessHeroImage';
import ProReactions from '@/components/proscard/ProReactions';
import BusinessDetailsTabs from '@/components/businessdetails/BusinessDetailsTabs';
import BusinessContactIcons from '@/components/businessdetails/BusinessContactIcons';
import BusinessContactInfo from '@/components/businessdetails/BusinessContactInfo';
import BusinessLinksTab from '@/components/businessdetails/BusinessLinksTab';
import BusinessAboutTab from '@/components/businessdetails/BusinessAboutTab';
import { ProCardData } from '@/components/proscard/ProCard';

type TabType = 'contact' | 'links' | 'about';

import { getBusinessData } from '@/lib/mockData/mockBusinessData';
import { businessStorage } from '@/lib/storage/businessStorage';

export default function BusinessDetailsPage() {
  const params = useParams();
  const id = params.id as string;
  const { getThemeClasses } = useTheme();
  const tabsBorderClass = getThemeClasses('categories');
  const [business, setBusiness] = useState<ProCardData | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('contact');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBusiness = async () => {
      setLoading(true);
      
      // First, try to get from localStorage
      const allBusinesses = businessStorage.getAllBusinesses();
      let data = allBusinesses.find((b: ProCardData) => b.id === id);
      
      // Remove userId from business data if it exists (for display purposes)
      if (data) {
        const { userId, ...businessData } = data as ProCardData & { userId?: string };
        data = businessData;
      }
      
      // If not found in localStorage, try mock data
      if (!data) {
        data = await getBusinessData(id);
      }
      
      setBusiness(data || null);
      setLoading(false);
    };

    if (id) {
      fetchBusiness();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <p className="text-black">Loading...</p>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="w-full flex items-center justify-center min-h-[400px]">
        <p className="text-black">Business not found</p>
      </div>
    );
  }

  const phoneLink = business.links.find(l => l.type === 'phone');
  const emailLink = business.links.find(l => l.type === 'email');
  const websiteLink = business.links.find(l => l.type === 'website');
  const instagramLink = business.links.find(l => l.type === 'instagram');

  return (
    <div className="w-full">
      <BusinessDetailsHeader
        logo={business.logo}
        businessName={business.businessName}
        contractorType={business.contractorType}
      />
      
      <BusinessHeroImage businessName={business.businessName} />
      
      <div className={`flex items-center justify-between h-[60px] p-2 bg-white ${tabsBorderClass}`}>
        <div className="flex-1">
          <ProReactions
            initialReactions={business.reactions}
            businessName={business.businessName}
            contractorType={business.contractorType}
            logo={business.logo}
            businessId={business.id}
            layout="around"
            gap="gap-1"
            onReaction={(type) => {
              // Refresh business data to get updated reactions
              const allBusinesses = businessStorage.getAllBusinesses();
              const updatedBusiness = allBusinesses.find((b: ProCardData & { userId?: string }) => b.id === business.id);
              if (updatedBusiness) {
                const { userId, ...businessData } = updatedBusiness;
                setBusiness(businessData);
              }
            }}
          />
        </div>
        <div className="w-px h-8 bg-black"></div>
        <BusinessContactIcons
          phone={phoneLink?.value}
          website={websiteLink?.url}
          instagram={instagramLink?.url}
        />
      </div>
      
      <div className="flex items-center h-[60px]">
        <BusinessDetailsTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="w-full p-2 md:p-2">
        {activeTab === 'contact' && (
          <BusinessContactInfo
            phone={phoneLink?.value}
            email={emailLink?.value}
          />
        )}
        
        {activeTab === 'links' && (
          <BusinessLinksTab links={business.links} />
        )}
        
        {activeTab === 'about' && (
          <BusinessAboutTab
            businessName={business.businessName}
            contractorType={business.contractorType}
          />
        )}
      </div>
    </div>
  );
}

