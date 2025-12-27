import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Find Local Contractors | Business Directory',
  description: 'Browse our network of trusted local contractors and service providers. Find the right professional for your home improvement, repair, or renovation project.',
  openGraph: {
    title: 'Find Local Contractors | House Pros Hub Business Directory',
    description: 'Browse our network of trusted local contractors and service providers for all your home improvement needs.',
    type: 'website',
  },
};

export default function BusinessListLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
