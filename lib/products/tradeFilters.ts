import type { ProProduct } from '@/lib/products/types';

export const PRODUCT_TRADES = ['hardscape'] as const;
export type ProductTrade = (typeof PRODUCT_TRADES)[number];

export type HardscapeFilterKey = 'brand' | 'type' | 'thickness' | 'color';

/** Attribute filters available per trade. Add keys when a new trade joins the catalog. */
export const TRADE_ATTRIBUTE_FILTERS: Record<ProductTrade, readonly HardscapeFilterKey[]> = {
  hardscape: ['brand', 'type', 'thickness', 'color'],
};

/** Until products carry a trade field, everything in the catalog is hardscape. */
export function productTrade(_product: ProProduct): ProductTrade {
  return 'hardscape';
}

export function thicknessLabel(mm: string, inches: string): string {
  const thickMm = mm.trim();
  const thickIn = inches.trim();
  if (!thickMm && !thickIn) return '';
  if (thickMm && thickIn) return `${thickMm}mm (${thickIn}")`;
  if (thickMm) return `${thickMm}mm`;
  return `${thickIn}"`;
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(Array.from(values).map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
}

export function hardscapeFilterOptions(products: ProProduct[]) {
  const brands: string[] = [];
  const types: string[] = [];
  const thicknesses: string[] = [];
  const colors: string[] = [];

  for (const product of products) {
    if (productTrade(product) !== 'hardscape') continue;
    if (product.brand) brands.push(product.brand);
    if (product.product_type) types.push(product.product_type);
    for (const variant of product.variants) {
      const thickness = thicknessLabel(variant.thicknessMm, variant.thicknessIn);
      if (thickness) thicknesses.push(thickness);
      if (variant.color) colors.push(variant.color);
    }
  }

  return {
    brand: uniqueSorted(brands),
    type: uniqueSorted(types),
    thickness: uniqueSorted(thicknesses),
    color: uniqueSorted(colors),
  };
}

export function productMatchesHardscapeFilters(
  product: ProProduct,
  filters: { brand: string; type: string; thickness: string; color: string }
): boolean {
  if (filters.brand && product.brand.toLowerCase() !== filters.brand.toLowerCase()) return false;
  if (filters.type && product.product_type.toLowerCase() !== filters.type.toLowerCase()) return false;
  if (filters.thickness) {
    const ok = product.variants.some(
      (variant) => thicknessLabel(variant.thicknessMm, variant.thicknessIn).toLowerCase() === filters.thickness.toLowerCase()
    );
    if (!ok) return false;
  }
  if (filters.color) {
    const ok = product.variants.some((variant) => variant.color.toLowerCase() === filters.color.toLowerCase());
    if (!ok) return false;
  }
  return true;
}

export function showsHardscapeFilters(trade: string): boolean {
  return trade === '' || trade === 'hardscape';
}
