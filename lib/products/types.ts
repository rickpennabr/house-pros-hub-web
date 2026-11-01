export interface ProductVariant {
  id: number;
  color: string;
  size: string;
  thicknessMm: string;
  thicknessIn: string;
  sqftPallet: number;
  sqftLayer: number;
  lnftPallet: number;
  layerPallet: number;
  pcsPallet: number;
  images: string[];
}

export interface ProProduct {
  id: string;
  name: string;
  slug: string;
  brand: string;
  product_type: string;
  description: string;
  image_url: string | null;
  images: string[];
  variants: ProductVariant[];
  published: boolean;
  created_at: string;
  updated_at: string;
}
