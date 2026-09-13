import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductDetailPage } from "@/components/product-detail-page";
import { publishedCatalogue } from "@/lib/server-catalogue";

export const dynamicParams = false;
export function generateStaticParams() { return publishedCatalogue().map(product => ({ slug: product.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = publishedCatalogue().find(item => item.slug === slug)!;
  const url = `https://eshwe.com/product/${slug}/`;
  const description = (product.description || `Explore ${product.name} at eshwe.`).slice(0, 160);
  const images = product.primaryImageUrl ? [product.primaryImageUrl] : [];
  return { title: product.name, description, alternates: { canonical: url }, openGraph: { title: `${product.name} | eshwe`, description, url, images }, twitter: { card: "summary_large_image", title: product.name, description, images } };
}
export default function ProductPage() {
  return <Suspense fallback={null}><ProductDetailPage /></Suspense>;
}
