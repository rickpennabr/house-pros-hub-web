import type { ProCardData } from '@/components/proscard/ProCard';
import { siteOrigin } from '@/lib/agent/constants';

export interface AgentLicense {
  type: string;
  number: string | null;
  name: string | null;
}

export interface AgentPro {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  services: string[];
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  licenses: AgentLicense[];
  profileUrl: string;
  acceptsEstimates: true;
}

interface LicenseLike {
  license: string;
  licenseNumber?: string;
  tradeName?: string;
  trade?: string;
}

function phoneOf(card: ProCardData): string | null {
  if (card.phone) return card.phone;
  if (card.mobilePhone) return card.mobilePhone;
  const link = card.links?.find((item) => item.type === 'phone');
  return link?.value || link?.url?.replace(/^tel:/, '') || null;
}

function licensesOf(card: ProCardData): AgentLicense[] {
  const rows = (card.licenses ?? []) as LicenseLike[];
  return rows
    .map((license) => ({
      type: license.license,
      number: license.licenseNumber?.trim() || null,
      name: license.tradeName?.trim() || license.trade?.trim() || null,
    }))
    .filter((license) => license.type !== 'GENERAL' || license.number || license.name);
}

/** Public pro fields an agent is allowed to repeat. Street address stays off this payload. */
export function presentPro(card: ProCardData, origin = siteOrigin()): AgentPro {
  const slug = card.slug || card.id;
  return {
    id: card.id,
    slug: card.slug ?? null,
    name: card.businessName,
    description: card.companyDescription ?? null,
    category: card.category ?? card.contractorType ?? null,
    services: card.services ?? [],
    city: card.city ?? null,
    state: card.state ?? null,
    postalCode: card.zipCode ?? null,
    phone: phoneOf(card),
    email: card.email ?? null,
    licenses: licensesOf(card),
    profileUrl: `${origin}/en/business/${slug}`,
    acceptsEstimates: true,
  };
}
