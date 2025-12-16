import { ReactNode } from 'react';

interface PageContentProps {
  children?: ReactNode;
}

export default function PageContent({ children }: PageContentProps) {
  return (
    <div className="w-full flex-1 p-2 md:p-2">
      {children}
    </div>
  );
}

