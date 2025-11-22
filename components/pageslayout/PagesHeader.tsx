import { ReactNode } from 'react';
import Logo from '../Logo';
import ProfileIcon from './ProfileIcon';

interface PageHeaderProps {
  children?: ReactNode;
}

export default function PageHeader({ children }: PageHeaderProps) {
  return (
    <header className="w-full h-[60px] border-b border-black p-2 md:p-4 flex items-center justify-between">
      <Logo width={200} height={50} className="h-10 md:h-10 w-auto" />
      <ProfileIcon />
      {children}
    </header>
  );
}

