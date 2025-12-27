'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import BusinessHeroImage from '@/components/businessdetails/BusinessHeroImage';
import ProReactions from '@/components/proscard/ProReactions';
import BusinessDetailsTabs from '@/components/businessdetails/BusinessDetailsTabs';
import BusinessContactIcons from '@/components/businessdetails/BusinessContactIcons';
import BusinessContactInfo from '@/components/businessdetails/BusinessContactInfo';
import BusinessLinksTab from '@/components/businessdetails/BusinessLinksTab';
import BusinessAboutTab from '@/components/businessdetails/BusinessAboutTab';
import { ProCardData } from '@/components/proscard/ProCard';
import StructuredData from '@/components/seo/StructuredData';
import { createClient } from '@/lib/supabase/client';

type TabType = 'contact' | 'links' | 'about';

import { getBusinessData } from '@/lib/mockData/mockBusinessData';
import { businessStorage } from '@/lib/storage/businessStorage';

interface OwnerProfile {
  first_name?: string | null;
  last_name?: string | null;
  user_picture?: string | null;
  company_role?: string | null;
}

type BusinessWithMeta = ProCardData & {
  userId?: string;
  business_background?: string;
};

export default function BusinessDetailsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [business, setBusiness] = useState<BusinessWithMeta | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('contact');
  const [loading, setLoading] = useState(true);
  
  // Refs for tab content sections for auto-scrolling
  const contactRef = useRef<HTMLDivElement>(null);
  const linksRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to active tab content
  useAutoScroll({ ref: contactRef, shouldScroll: activeTab === 'contact' });
  useAutoScroll({ ref: linksRef, shouldScroll: activeTab === 'links' });
  useAutoScroll({ ref: aboutRef, shouldScroll: activeTab === 'about' });

  useEffect(() => {
    const fetchBusiness = async () => {
      if (!slug) return;
      setLoading(true);
      
      try {
        // First, try to fetch from API (database)
        let data: BusinessWithMeta | null = null;
        let ownerProfile: OwnerProfile | null = null;
        
        try {
          const response = await fetch(`/api/businesses/${slug}`);
          if (response.ok) {
            const result = await response.json();
            data = result.business;
            
            // Fetch owner profile if we have userId
            if (data?.userId) {
              try {
                const supabase = createClient();
                const { data: profile, error: profileError } = await supabase
                  .from('profiles')
                  .select('first_name, last_name, user_picture, company_role')
                  .eq('id', data.userId)
                  .single();
                
                if (!profileError && profile) {
                  ownerProfile = profile;
                }
              } catch (profileError) {
                console.error('Error fetching owner profile:', profileError);
              }
            }
          }
        } catch (apiError) {
          console.error('Error fetching from API:', apiError);
        }
        
        // Fallback to localStorage if API fetch failed
        if (!data) {
          data = businessStorage.getBusinessBySlug(slug);
          if (data) {
            // Try to fetch owner profile from localStorage business data
            if (data.userId) {
              try {
                const supabase = createClient();
                const { data: profile, error: profileError } = await supabase
                  .from('profiles')
                  .select('first_name, last_name, user_picture, company_role')
                  .eq('id', data.userId)
                  .single();
                
                if (!profileError && profile) {
                  ownerProfile = profile;
                }
              } catch (profileError) {
                console.error('Error fetching owner profile:', profileError);
              }
            }
          }
        }
        
        // Fallback to mock data if still not found
        if (!data) {
          data = await getBusinessData(slug);
        }
        
        // Merge owner profile data if available
        if (data && ownerProfile) {
          const fullName = ownerProfile.first_name && ownerProfile.last_name 
            ? `${ownerProfile.first_name} ${ownerProfile.last_name}`.trim()
            : ownerProfile.first_name || ownerProfile.last_name || '';
          
          data = {
            ...data,
            ownerImage: ownerProfile.user_picture || data.ownerImage,
            ownerName: fullName || data.ownerName,
            ownerTitle: ownerProfile.company_role || data.ownerTitle,
            ownerDescription: data.ownerDescription, // Keep existing description if any
          };
        }
        
        // Ensure logo field uses businessLogo if logo is not available
        if (data && !data.logo && data.businessLogo) {
          data.logo = data.businessLogo;
        }
        
        // Ensure businessBackground is properly set
        if (data && !data.businessBackground && data.business_background) {
          data.businessBackground = data.business_background;
        }
        
        setBusiness(data);
      } catch (error) {
        console.error('Error fetching business:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBusiness();
  }, [slug]);

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
      {/* JSON-LD Structured Data for SEO */}
      <StructuredData business={business} />
      
      <BusinessDetailsHeader
        logo={business.logo || business.businessLogo}
        businessName={business.businessName}
        contractorType={business.contractorType}
      />
      
      <BusinessHeroImage 
        imageUrl={business.businessBackground} 
        businessName={business.businessName} 
      />
      
      <div className="flex flex-col md:flex-row md:items-center h-auto md:h-[60px] p-2 bg-white border-b-2 border-black">
        <div className="w-full md:w-1/2 md:pr-4">
          <ProReactions
            initialReactions={business.reactions}
            businessName={business.businessName}
            contractorType={business.contractorType}
            logo={business.logo || business.businessLogo}
            businessId={business.id}
            layout="around"
            gap="gap-1"
            onReaction={() => {
              // Refresh business data to get updated reactions
              const allBusinesses = businessStorage.getAllBusinesses();
              const updatedBusiness = allBusinesses.find((b) => b.id === business.id);
              if (updatedBusiness) {
                setBusiness(updatedBusiness);
              }
            }}
          />
        </div>
        {/* Divider: horizontal on mobile, vertical on desktop */}
        <div className="w-full h-px bg-black my-2 md:hidden"></div>

        {/* On mobile, show icon links under reactions */}
        <div className="w-full md:w-1/2 flex justify-center md:justify-center md:border-l md:border-black md:pl-4">
          <BusinessContactIcons
            phone={phoneLink?.value}
            website={websiteLink?.url}
            instagram={instagramLink?.url}
          />
        </div>
      </div>
      
      <div className="flex items-center h-[60px]">
        <BusinessDetailsTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      </div>

      <div className="w-full p-2 md:p-2">
        {activeTab === 'contact' && (
          <div ref={contactRef}>
            <BusinessContactInfo
              phone={phoneLink?.value}
              email={emailLink?.value}
            />
          </div>
        )}
        
        {activeTab === 'links' && (
          <div ref={linksRef}>
            <BusinessLinksTab links={business.links} />
          </div>
        )}
        
        {activeTab === 'about' && (
          <div ref={aboutRef}>
            <BusinessAboutTab
              businessName={business.businessName}
              contractorType={business.contractorType}
              logo={business.logo || business.businessLogo}
              licenses={business.licenses}
              ownerImage={business.ownerImage}
              ownerName={business.ownerName}
              ownerTitle={business.ownerTitle}
              ownerDescription={business.ownerDescription}
              companyDescription={business.companyDescription}
            />
          </div>
        )}
      </div>
    </div>
  );
}
