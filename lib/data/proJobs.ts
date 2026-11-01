export type ProJobEmployment = 'full_time' | 'part_time' | 'contract' | 'hourly';
export type ProJobWorkplace = 'on_site' | 'hybrid';
export type ProJobLanguage = 'en' | 'es' | 'bilingual';

export interface ProJob {
  id: string;
  company: string;
  title: string;
  description: string;
  /** Matches a House Pros Hub service category label. */
  category: string;
  employmentType: ProJobEmployment;
  workplaceType: ProJobWorkplace;
  workplaceLanguage: ProJobLanguage;
  city: string;
  state: string;
  /** Null when the posting does not list pay. */
  pay: string | null;
  phone: string;
  /** True when the signed-in contractor owns this posting. */
  mine: boolean;
}

export function jobInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}
