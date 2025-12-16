/**
 * Utility functions for transforming business data
 */

import { ProCardData } from '@/components/proscard/ProCard';
import { LinkItem } from '@/components/proscard/ProLinks';

/**
 * Maps license codes to categories
 */
const licenseToCategoryMap: Record<string, string> = {
  'B-2': 'General',
  'B-7': 'General',
  'C-1': 'Plumbing',
  'C-2': 'Electrical',
  'C-3': 'General',
  'C-4': 'Painting',
  'C-5': 'Pavers',
  'C-8': 'Windows',
  'C-10': 'Landscape',
  'C-15': 'Roofing',
  'C-16': 'Flooring',
  'C-17': 'General',
  'C-18': 'General',
  'C-19': 'Tile',
  'C-20': 'Tile',
  'C-21': 'HVAC',
  'C-25': 'Fencing',
  'A-7': 'General',
  'A-10': 'General',
  'GENERAL': 'General',
};

/**
 * Maps license codes to trade icons (lucide-react icon names)
 */
const licenseToIconMap: Record<string, string> = {
  'B-2': 'Home',
  'B-7': 'Home',
  'C-1': 'Droplet',
  'C-2': 'Zap',
  'C-3': 'Wrench',
  'C-4': 'Paintbrush',
  'C-5': 'Square',
  'C-8': 'RectangleHorizontal',
  'C-10': 'TreePine',
  'C-15': 'Home',
  'C-16': 'Layers',
  'C-17': 'Wrench',
  'C-18': 'Wrench',
  'C-19': 'Grid3x3',
  'C-20': 'Grid3x3',
  'C-21': 'Wind',
  'C-25': 'Fence',
  'A-7': 'Layers',
  'A-10': 'Droplet',
  'GENERAL': 'Home',
};

/**
 * Get category from license code
 */
function getCategoryFromLicense(licenseCode: string): string {
  return licenseToCategoryMap[licenseCode] || 'General';
}

/**
 * Get trade icon from license code
 */
function getTradeIconFromLicense(licenseCode: string): string {
  return licenseToIconMap[licenseCode] || 'Home';
}

/**
 * Transform business form data to ProCardData format
 */
export function transformBusinessToProCardData(
  businessData: {
    id: string;
    businessName: string;
    businessLogo?: string | null;
    licenses: Array<{ license: string; trade: string; licenseNumber: string }>;
    email?: string;
    phone?: string;
    links?: LinkItem[];
    userId: string;
  }
): ProCardData & { userId: string } {
  // Use the first license to determine category and trade icon
  const primaryLicense = businessData.licenses[0];
  const licenseCode = primaryLicense?.license || 'GENERAL';
  const contractorType = primaryLicense?.trade || 'General Contractor';
  const category = getCategoryFromLicense(licenseCode);
  const tradeIcon = getTradeIconFromLicense(licenseCode);

  // Build links array
  const links: LinkItem[] = [...(businessData.links || [])];

  // Add phone if provided and not already in links
  if (businessData.phone && !links.find(l => l.type === 'phone')) {
    links.push({
      type: 'phone',
      value: businessData.phone,
    });
  }

  // Add email if provided and not already in links
  if (businessData.email && !links.find(l => l.type === 'email')) {
    links.push({
      type: 'email',
      value: businessData.email,
    });
  }

  return {
    id: businessData.id,
    logo: businessData.businessLogo || undefined,
    businessName: businessData.businessName,
    contractorType,
    category,
    tradeIcon,
    links,
    reactions: {
      love: 0,
      feedback: 0,
      link: 0,
      save: 0,
    },
    userId: businessData.userId,
  };
}

