import { ReactNode } from 'react';

interface PageContentProps {
  children?: ReactNode;
  /** Keep long pages inside the card so the footer stays below the content. */
  scroll?: boolean;
  /** Skip top padding so a page toolbar sits against the menu. */
  flushTop?: boolean;
}

export default function PageContent({ children, scroll = false, flushTop = false }: PageContentProps) {
  const padding = flushTop ? 'px-1 pb-1 md:px-2 md:pb-2' : 'p-1 md:p-2';
  return (
    <main
      id="main-content"
      className={`w-full flex-1 min-h-0 ${padding} flex flex-col ${scroll ? 'overflow-y-auto' : ''}`}
    >
      {children}
    </main>
  );
}

