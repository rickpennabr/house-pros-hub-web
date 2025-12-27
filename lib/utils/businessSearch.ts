import { ProCardData } from '@/components/proscard/ProCard';

/**
 * Maps license codes to categories
 * These should match the labels in SERVICE_CATEGORIES from @/lib/constants/categories
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
  'C-18': 'Masonry',
  'C-19': 'Tile',
  'C-20': 'Tile',
  'C-21': 'HVAC',
  'C-25': 'Fencing',
  'A-7': 'General',
  'A-10': 'General',
  'GENERAL': 'General',
};

/**
 * Get all categories from a business's licenses
 */
export function getBusinessCategories(business: ProCardData): string[] {
  const categories = new Set<string>();
  
  // Add the primary category if it exists
  if (business.category) {
    categories.add(business.category);
  }
  
  // Extract categories from all licenses
  if (business.licenses && business.licenses.length > 0) {
    business.licenses.forEach(license => {
      const licenseCode = license.license || 'GENERAL';
      const category = licenseToCategoryMap[licenseCode] || 'General';
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

  // Extract keywords from business data
  const businessKeywords = [
    ...extractKeywords(business.businessName),
    ...extractKeywords(business.contractorType),
    ...(business.category ? extractKeywords(business.category) : []),
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

