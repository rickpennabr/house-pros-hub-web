import { ProCardData } from '@/components/proscard/ProCard';
import { houseTrade, NV_BUSINESS_LICENSE_CODE } from '@/lib/pros/house-trades';

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
  'HANDYMAN INTERIOR': 'Handyman',
  'HANDYMAN_EXTERIOR': 'Handyman',
  INSTALLER: 'Installer',
};

/** License codes whose mapped category label is `category`. */
export function licenseCodesForCategory(category: string): string[] {
  const label = category.trim();
  return Object.entries(licenseToCategoryMap)
    .filter(([, mapped]) => mapped === label)
    .map(([code]) => code);
}

/** Normalize to a single display category so aliases don't both appear. */
function normalizeCategoryForDisplay(label: string): string {
  const trimmed = label?.trim() || '';
  if (trimmed === 'Landscape Contracting') return 'Landscape';
  if (trimmed === 'Handyman Interior' || trimmed === 'Handyman Exterior') return 'Handyman';
  return trimmed;
}

/**
 * Get all categories from a business's licenses and display fields.
 * Includes license-derived categories, display names, and account role when it is
 * Handyman or Installer so the filter bar matches the roles on Pro Cards.
 */
export function getBusinessCategories(business: ProCardData): string[] {
  const categories = new Set<string>();

  const addCategory = (label: string) => {
    const normalized = normalizeCategoryForDisplay(label);
    if (normalized) categories.add(normalized);
  };

  // Prefer display names that appear on the card
  if (business.contractorType?.trim()) {
    addCategory(business.contractorType.trim());
  }
  if (business.licenses?.length) {
    business.licenses.forEach((license) => {
      const name = license.tradeName?.trim();
      if (name) addCategory(name);
    });
  }

  // Add the primary category if it exists (license-derived)
  if (business.category) {
    addCategory(business.category);
  }

  // The trade the pro picked, plus the other trades they do.
  for (const slug of [business.proTrade, ...(business.trades ?? [])]) {
    const trade = houseTrade(slug);
    if (trade) addCategory(trade.category);
  }

  // Role chips: Handyman / Installer come from the owner account, not a trade license.
  if (business.accountRole === 'handyman') addCategory('Handyman');
  if (business.accountRole === 'installer') addCategory('Installer');

  // Extract categories from all license codes (for filtering by standard categories)
  if (business.licenses && business.licenses.length > 0) {
    business.licenses.forEach((license) => {
      const raw = license.license || 'GENERAL';
      // A Nevada Business License says nothing about the trade; its trade name was added above.
      if (raw === NV_BUSINESS_LICENSE_CODE) return;
      const licenseCode = typeof raw === 'string' ? raw.toUpperCase().replace(/\s+/g, ' ').trim() : raw;
      const category = licenseToCategoryMap[licenseCode] ?? licenseToCategoryMap[raw] ?? 'General Contractor';
      addCategory(category);
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

