import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductDetail } from '@/components/products/ProductDetail';
import { getPublishedProduct } from '@/lib/products/queries';
import { absoluteUrl, jsonLdScript, localizedPath } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  const image = product?.image_url?.startsWith('https://') ? product.image_url : undefined;
  return {
    title: product?.name ?? 'ProProducts',
    description: product?.description || undefined,
    openGraph: {
      title: product?.name ?? 'ProProducts',
      description: product?.description || undefined,
      images: image ? [{ url: image, alt: product?.name ?? 'ProProducts' }] : undefined,
    },
  };
}

export default async function ProProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug } = await params;
  const product = await getPublishedProduct(slug);
  if (!product) notFound();
  const image = product.image_url?.startsWith('https://') ? product.image_url : undefined;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image,
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    url: absoluteUrl(localizedPath('en', `/proproducts/${product.slug}`)),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(productJsonLd) }} />
      <ProductDetail product={product} />
    </>
  );
}
