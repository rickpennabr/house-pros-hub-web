import { ReactNode } from 'react';

interface PageContainerProps {
  children: ReactNode;
}

export default function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="w-full max-w-[1280px] min-h-screen mx-auto border border-black">
      {children}
    </div>
  );
}

