import { ReactNode } from 'react';

interface PageContentProps {
  children?: ReactNode;
}

export default function PageContent({ children }: PageContentProps) {
  return (
    <div className="w-full h-full p-2 md:p-4">
      {children}
    </div>
  );
}

