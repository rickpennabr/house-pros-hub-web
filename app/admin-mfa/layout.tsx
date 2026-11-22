import type { Metadata } from 'next';
import { privateRobots } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  title: 'Admin two-step sign-in',
  robots: privateRobots,
};

export default function AdminMfaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
