import { ProCardData } from '@/components/proscard/ProCard';

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

  // Filter by category
  if (category && category !== 'All') {
    filtered = filtered.filter(business => business.category === category);
  }

  // Filter by search query
  if (searchQuery) {
    filtered = filtered.filter(business => matchesSearchQuery(business, searchQuery));
  }

  return filtered;
}

