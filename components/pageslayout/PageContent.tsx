import { ReactNode } from 'react';

interface PageContentProps {
  children?: ReactNode;
  /** Keep long pages inside the card so the footer stays below the content. */
  scroll?: boolean;
  /** Let the content set the card height so the window can scroll to the bottom. */
  grow?: boolean;
  /** Skip top padding so a page toolbar sits against the menu. */
  flushTop?: boolean;
}

export default function PageContent({ children, scroll = false, grow = false, flushTop = false }: PageContentProps) {
  const padding = flushTop ? 'px-1 pb-1 md:px-2 md:pb-2' : 'p-1 md:p-2';
  const desktop = grow
    ? 'md:shrink-0'
    : `md:min-h-0 md:flex-1 ${scroll ? 'md:overflow-y-auto' : ''}`;
  return (
    <main
      id="main-content"
      className={`w-full flex flex-col ${padding} max-md:grow max-md:shrink-0 ${desktop}`}
    >
      {children}
    </main>
  );
}

