import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pro Suppliers | House Pros Hub',
  description: 'Find suppliers for your contracting business needs. Connect with trusted suppliers and vendors.',
  openGraph: {
    title: 'Pro Suppliers | House Pros Hub',
    description: 'Find suppliers for your contracting business needs.',
    type: 'website',
  },
};

export default function ProSuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

