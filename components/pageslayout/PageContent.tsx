import { ReactNode } from 'react';

interface PageContentProps {
  children?: ReactNode;
}

export default function PageContent({ children }: PageContentProps) {
  return (
    <div className="w-full flex-1 min-h-0 p-2 md:p-2 flex flex-col">
      {children}
    </div>
  );
}

