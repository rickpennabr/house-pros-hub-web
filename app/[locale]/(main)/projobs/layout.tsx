import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ProJobs',
  description: 'Trade job openings posted by House Pros Hub contractors.',
  openGraph: {
    title: 'ProJobs | House Pros Hub',
    description: 'Trade job openings posted by contractors.',
    type: 'website',
  },
};

export default function ProJobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
