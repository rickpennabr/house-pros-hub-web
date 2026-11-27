export type DocsFigureRole =
  | 'guide'
  | 'business'
  | 'customer'
  | 'plumber'
  | 'landscaper'
  | 'electrician'
  | 'painter'
  | 'crew';

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
  /** Short story beat — ProBot in this role tells what happens. */
  story: string;
  /** Which ProBot figure appears for this beat. */
  role: DocsFigureRole;
  /** Optional role label under the figure (e.g. "ProBot the plumber"). */
  roleLabel?: string;
  steps?: string[];
  links?: DocsLink[];
}

export interface DocsPage {
  slug: string;
  title: string;
  lead: string;
  /** Hero figure at the top of the page. */
  heroRole?: DocsFigureRole;
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
