export interface DocsHeading {
  id: string;
  title: string;
}

export interface DocsLink {
  label: string;
  href: string;
}

export interface DocsSection {
  id: string;
  title: string;
  paragraphs?: string[];
  steps?: string[];
  links?: DocsLink[];
}

export interface DocsPage {
  slug: string;
  title: string;
  lead: string;
  sections: DocsSection[];
}

export interface DocsNavPage {
  slug: string;
  title: string;
}

export interface DocsNavSection {
  id: string;
  label: string;
  pages: DocsNavPage[];
}
