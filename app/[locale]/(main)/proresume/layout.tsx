import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ProResume',
  description: 'Build or upload one résumé and use it for ProJobs Easy Apply.',
};

export default function ProResumeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
