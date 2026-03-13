import { ProCardData } from '@/components/proscard/ProCard';

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
  'HANDYMAN': 'Handyman',
  'HANDYMAN INTERIOR': 'Handyman Interior',
  'HANDYMAN_EXTERIOR': 'Handyman Exterior',
};

/**
 * Get all categories from a business's licenses and display fields.
 * Includes both license-derived categories and the actual display names (contractorType, tradeName)
 * so the filter bar shows real business list categories (e.g. "Handyman Interior") not only "General Contractor".
 */
export function getBusinessCategories(business: ProCardData): string[] {
  const categories = new Set<string>();

  // Prefer display names that appear on the card
  if (business.contractorType?.trim()) {
    categories.add(business.contractorType.trim());
  }
  if (business.licenses?.length) {
    business.licenses.forEach((license) => {
      const name = license.tradeName?.trim();
      if (name) categories.add(name);
    });
  }

  // Add the primary category if it exists (license-derived)
  if (business.category) {
    categories.add(business.category);
  }

  // Extract categories from all license codes (for filtering by standard categories)
  if (business.licenses && business.licenses.length > 0) {
    business.licenses.forEach((license) => {
      const raw = license.license || 'GENERAL';
      const licenseCode = typeof raw === 'string' ? raw.toUpperCase().replace(/\s+/g, ' ').trim() : raw;
      const category = licenseToCategoryMap[licenseCode] ?? licenseToCategoryMap[raw] ?? 'General Contractor';
      categories.add(category);
    });
  }

  return Array.from(categories);
}

/**
 * Normalizes a search query by trimming whitespace and converting to lowercase
 */
export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * Extracts keywords from a string by splitting on common separators
 * and removing common words
 */
function extractKeywords(text: string): string[] {
  const commonWords = new Set(['contractor', 'co', 'company', 'inc', 'llc', 'ltd', 'and', 'the', 'of']);
  return text
    .toLowerCase()
    .split(/[\s\-&,]+/)
    .filter(word => word.length > 2 && !commonWords.has(word));
}

/**
 * Checks if a search query matches a business
 * Searches across:
 * - Business name
 * - Contractor type
 * - Category
 * - Extracted keywords from business name and contractor type
 */
export function matchesSearchQuery(business: ProCardData, query: string): boolean {
  if (!query) return true;

  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) return true;

  // Direct matches
  const businessName = business.businessName.toLowerCase();
  const contractorType = business.contractorType.toLowerCase();
  const category = (business.category || '').toLowerCase();

  // Check direct matches
  if (
    businessName.includes(normalizedQuery) ||
    contractorType.includes(normalizedQuery) ||
    category.includes(normalizedQuery)
  ) {
    return true;
  }

  // Match against services (e.g. "Plumbing", "Repairs")
  if (business.services && business.services.length > 0) {
    const serviceMatch = business.services.some(
      (s) => s && s.toLowerCase().includes(normalizedQuery)
    );
    if (serviceMatch) return true;
  }

  // Extract keywords from business data (including services)
  const businessKeywords = [
    ...extractKeywords(business.businessName),
    ...extractKeywords(business.contractorType),
    ...(business.category ? extractKeywords(business.category) : []),
    ...(business.services || []).flatMap((s) => (s ? extractKeywords(s) : [])),
  ];

  // Check if any keyword matches
  const queryKeywords = extractKeywords(query);
  return queryKeywords.some(queryKeyword =>
    businessKeywords.some(businessKeyword => businessKeyword.includes(queryKeyword) || queryKeyword.includes(businessKeyword))
  );
}

/**
 * Filters businesses based on category and search query
 */
export function filterBusinesses(
  businesses: ProCardData[],
  category: string,
  searchQuery: string
): ProCardData[] {
  let filtered = businesses;

  // Filter by category - check all licenses, not just primary category
  if (category && category !== 'All') {
    filtered = filtered.filter(business => {
      const businessCategories = getBusinessCategories(business);
      return businessCategories.includes(category);
    });
  }

  // Filter by search query
  if (searchQuery) {
    filtered = filtered.filter(business => matchesSearchQuery(business, searchQuery));
  }

  return filtered;
}

