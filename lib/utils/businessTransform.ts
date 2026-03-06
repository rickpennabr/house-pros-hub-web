/**
 * Utility functions for transforming business data
 */

import { ProCardData } from '@/components/proscard/ProCard';
import { LinkItem } from '@/components/proscard/ProLinks';
import { RESIDENTIAL_CONTRACTOR_LICENSES, HANDYMAN_LICENSE_CODE } from '@/lib/constants/contractorLicenses';

/**
 * Maps license codes to categories
 * These should match the labels in SERVICE_CATEGORIES from @/lib/constants/categories
 */
const licenseToCategoryMap: Record<string, string> = {
  'B-2': 'General Contractor',
  'B-7': 'General Contractor',
  'C-1': 'Plumbing',
  'C-2': 'Electrical',
  'C-2d': 'Smart Home',
  'C-3': 'Carpentry',
  'C-4': 'Painting',
  'C-5': 'Concrete',
  'C-8': 'Windows & Doors',
  'C-10': 'Landscape',
  'C-15': 'Roofing',
  'C-16': 'Flooring',
  'C-17': 'General Contractor',
  'C-18': 'Masonry',
  'C-19': 'Tile',
  'C-20': 'Tile',
  'C-21': 'HVAC',
  'C-25': 'Fencing',
  'C-27': 'Plumbing',
  'C-30': 'Plumbing',
  'C-37': 'Solar',
  'C-39': 'HVAC',
  'C-41': 'Fire Protection',
  'A-7': 'General Contractor',
  'A-10': 'Pools & Spas',
  'GENERAL': 'General Contractor',
  [HANDYMAN_LICENSE_CODE]: 'Handyman',
};

/**
 * Maps license codes to trade icons (lucide-react icon names)
 */
const licenseToIconMap: Record<string, string> = {
  'B-2': 'Home',
  'B-7': 'Home',
  'C-1': 'Droplet',
  'C-2': 'Zap',
  'C-2d': 'Wifi',
  'C-3': 'Hammer',
  'C-4': 'Paintbrush',
  'C-5': 'Box',
  'C-8': 'RectangleHorizontal',
  'C-10': 'TreePine',
  'C-15': 'Home',
  'C-16': 'Layers',
  'C-17': 'Home',
  'C-18': 'Home',
  'C-19': 'Grid3x3',
  'C-20': 'Grid3x3',
  'C-21': 'Wind',
  'C-25': 'Fence',
  'C-27': 'Droplet',
  'C-30': 'Droplet',
  'C-37': 'Sun',
  'C-39': 'Wind',
  'C-41': 'Shield',
  'A-7': 'Layers',
  'A-10': 'Waves',
  'GENERAL': 'Home',
  [HANDYMAN_LICENSE_CODE]: 'Hammer',
};

/**
 * Get category from license code
 */
function getCategoryFromLicense(licenseCode: string): string {
  return licenseToCategoryMap[licenseCode] || 'General Contractor';
}

/**
 * Get trade icon from license code
 */
function getTradeIconFromLicense(licenseCode: string): string {
  return licenseToIconMap[licenseCode] || 'Home';
}

/**
 * Generate a URL-friendly slug from a string
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Optional context for resolving license display names from DB (e.g. license_categories). */
export type TransformBusinessOptions = {
  licenseCategories?: Array<{ code: string; name: string }>;
};

function getLicenseDisplayName(
  code: string,
  licenseCategoriesMap: Map<string, string> | null
): string {
  if (licenseCategoriesMap?.has(code)) {
    return licenseCategoriesMap.get(code)!;
  }
  if (code === 'GENERAL') return 'General Contractor';
  if (code === HANDYMAN_LICENSE_CODE) return 'Handyman';
  const licenseInfo = RESIDENTIAL_CONTRACTOR_LICENSES.find(l => l.code === code);
  return licenseInfo ? licenseInfo.name : 'General Contractor';
}

/**
 * Transform business form data to ProCardData format
 */
export function transformBusinessToProCardData(
  businessData: {
    id: string;
    businessName: string;
    businessLogo?: string | null;
    businessBackground?: string | null;
    businessBackgroundPosition?: string | null;
    slug?: string;
    reactions?: ProCardData['reactions'];
    companyDescription?: string;
    licenses: Array<{ license: string; trade?: string; licenseNumber?: string }>;
    services?: string[] | Array<{ name: string }>;
    images?: string[];
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    apartment?: string;
    address?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    links?: LinkItem[];
    userId: string;
  },
  options?: TransformBusinessOptions
): ProCardData & { userId: string } {
  const licenseCategoriesMap = options?.licenseCategories?.length
    ? new Map(options.licenseCategories.map((c) => [c.code, c.name]))
    : null;

  // Ensure licenses array exists and has at least one license
  const licenses = businessData.licenses || [];
  const primaryLicense = licenses[0];
  const licenseCode = primaryLicense?.license || 'GENERAL';

  let contractorType = getLicenseDisplayName(licenseCode, licenseCategoriesMap);

  // If we have a trade string that isn't just numbers, it might be a custom trade name
  const tradeValue = primaryLicense?.trade;
  if (tradeValue && typeof tradeValue === 'string' && !/^\d+$/.test(tradeValue.trim())) {
    contractorType = tradeValue;
  }

  // Calculate category from license code - always ensure a category is set
  const category = getCategoryFromLicense(licenseCode);
  const tradeIcon = getTradeIconFromLicense(licenseCode);

  // Process all licenses to include trade name and icon (use DB names when available)
  const processedLicenses = businessData.licenses.map(license => {
    const licenseCodeForLicense = license.license || 'GENERAL';
    let tradeName = getLicenseDisplayName(licenseCodeForLicense, licenseCategoriesMap);
    // Card display often uses shortened form (e.g. without "Contractor" suffix) for some codes; keep full name from DB
    if (!licenseCategoriesMap?.has(licenseCodeForLicense)) {
      tradeName = tradeName.replace(/\s*Contractor\s*/gi, ' ').trim() || tradeName;
    }

    // If we have a trade string that isn't just numbers, use it
    const licenseTradeValue = license.trade;
    if (licenseTradeValue && typeof licenseTradeValue === 'string' && !/^\d+$/.test(licenseTradeValue.trim())) {
      tradeName = licenseTradeValue.replace(/\s*Contractor\s*/gi, ' ').trim();
    }

    const tradeIconForLicense = getTradeIconFromLicense(licenseCodeForLicense);

    return {
      license: license.license,
      licenseNumber: license.licenseNumber ?? '',
      tradeName,
      tradeIcon: tradeIconForLicense,
    };
  });

  // Build links array
  const links: LinkItem[] = [...(businessData.links || [])];

  // Sync phone in links
  // We prioritize land phone, then mobile phone for the primary phone link
  const contactPhone = businessData.phone || businessData.mobilePhone;
  if (contactPhone) {
    const existingPhoneIndex = links.findIndex(l => l.type === 'phone');
    if (existingPhoneIndex >= 0) {
      links[existingPhoneIndex] = { ...links[existingPhoneIndex], value: contactPhone };
    } else {
      links.push({
        type: 'phone',
        value: contactPhone,
      });
    }
  }

  // Sync email in links
  if (businessData.email) {
    const existingEmailIndex = links.findIndex(l => l.type === 'email');
    if (existingEmailIndex >= 0) {
      links[existingEmailIndex] = { ...links[existingEmailIndex], value: businessData.email };
    } else {
      links.push({
        type: 'email',
        value: businessData.email,
      });
    }
  }

  // Generate a better slug from the business name if not provided
  // Append a short random string or ID part to ensure uniqueness ONLY if slug is not provided
  const baseSlug = generateSlug(businessData.businessName);
  const shortId = businessData.id.split('_').pop() || Math.random().toString(36).substring(7);
  const slug = businessData.slug?.trim() || `${baseSlug}-${shortId}`;

  const services: string[] = (businessData.services || []).map((s) =>
    typeof s === 'string' ? s : (s as { name?: string })?.name ?? ''
  ).filter(Boolean);

  const images: string[] = Array.isArray(businessData.images) ? businessData.images : [];

  return {
    id: businessData.id,
    logo: businessData.businessLogo || undefined,
    businessLogo: businessData.businessLogo || undefined,
    businessBackground: businessData.businessBackground || undefined,
    businessBackgroundPosition: businessData.businessBackgroundPosition ?? '50% 50%',
    businessName: businessData.businessName,
    contractorType,
    category,
    tradeIcon,
    licenses: processedLicenses,
    services,
    images,
    streetAddress: businessData.streetAddress,
    city: businessData.city,
    state: businessData.state,
    zipCode: businessData.zipCode,
    apartment: businessData.apartment,
    address: businessData.address,
    email: businessData.email,
    phone: businessData.phone,
    mobilePhone: businessData.mobilePhone,
    links,
    slug,
    companyDescription: businessData.companyDescription,
    reactions: businessData.reactions ?? {
      love: 0,
      feedback: 0,
      link: 0,
      save: 0,
    },
    userId: businessData.userId,
  };
}

