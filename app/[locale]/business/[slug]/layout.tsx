'use client';

import { ReactNode } from 'react';

export default function BusinessDetailsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-transparent">
      <div className="w-full max-w-[960px] min-h-screen mx-auto border-2 border-black bg-white">
        {children}
      </div>
    </div>
  );
}
