'use client';

import { ReactNode } from 'react';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutProps {
  children: ReactNode;
  userEmail: string;
}

export function AdminLayout({ children, userEmail }: AdminLayoutProps) {
  return (
    <div className="w-full h-screen flex flex-col bg-white overflow-hidden">
      <AdminHeader userEmail={userEmail} />
      <div className="flex flex-1 overflow-hidden relative">
        <AdminSidebar />
        <main className="flex-1 min-w-0 overflow-y-auto bg-white flex flex-col md:pt-0 pt-[60px]">
          <div className="px-2 md:px-[100px] py-2 md:py-4 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}

