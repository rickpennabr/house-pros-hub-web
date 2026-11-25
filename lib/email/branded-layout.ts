import { COMPANY_INFO } from '@/lib/constants/company';
import { PRODUCTION_SITE_URL } from '@/lib/utils/publicSiteUrl';

/**
 * The standard email layout (same as the invoice email): logo on top, a tinted panel with the
 * heading and a highlighted number, the message, one button, then the sender's details.
 *
 * Emails a pro sends to their customers use the pro's brand (loadInvoiceEmailBranding).
 * Emails House Pros Hub sends (sign-in, ProDrive, leads, admin) use hubEmailBrand().
 */
export interface EmailBrand {
  businessName: string;
  logoUrl?: string | null;
  themeColor?: string | null;
  businessAddress?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  footerText?: string | null;
}

export interface BrandedEmailOptions {
  brand: EmailBrand;
  heading: string;
  /** Short line under the heading, e.g. "Estimate #EST-12 · $1,500.00". */
  subheading?: string | null;
  /** Big number in the panel. */
  highlight?: { label: string; value: string; color?: string } | null;
  /** Paragraphs (plain text, escaped here). */
  paragraphs?: Array<string | null | undefined>;
  /** Extra HTML after the paragraphs (already escaped by the caller). */
  bodyHtml?: string | null;
  /** Label/value rows (plain text, escaped here). */
  details?: Array<{ label: string; value: string; strong?: boolean }>;
  button?: { label: string; url: string } | null;
  /** Small grey line at the very bottom (plain text). */
  finePrint?: string | null;
  /** Hidden preview text shown by inboxes next to the subject. */
  preheader?: string | null;
}

export function escapeEmail(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function emailMoneyText(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function safeColor(value: string | null | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
}

function tintOf(color: string, strength = 0.1): string {
  if (color === '#000000') return '#f3f4f6';
  const hex = color.replace('#', '');
  const mix = (offset: number) =>
    Math.round(255 - (255 - parseInt(hex.slice(offset, offset + 2), 16)) * strength)
      .toString(16)
      .padStart(2, '0');
  return '#' + mix(0) + mix(2) + mix(4);
}

/** House Pros Hub as the sender: logo, black and red, the hub's contact details. */
export function hubEmailBrand(): EmailBrand {
  return {
    businessName: COMPANY_INFO.name,
    logoUrl: `${PRODUCTION_SITE_URL}/hph-logo-2.3.png`,
    themeColor: '#000000',
    businessEmail: COMPANY_INFO.email.contact,
    businessPhone: COMPANY_INFO.phone || null,
    businessWebsite: PRODUCTION_SITE_URL.replace(/^https?:\/\//, ''),
  };
}

export function brandedEmail(options: BrandedEmailOptions): string {
  const { brand } = options;
  const color = safeColor(brand.themeColor);
  const tint = tintOf(color);
  const name = escapeEmail(brand.businessName);
  const header = brand.logoUrl
    ? '<img src="' + escapeEmail(brand.logoUrl) + '" alt="' + name + '" height="64" style="display:block;margin:0 auto;max-height:64px;max-width:240px;border-radius:8px;" />'
    : '<p style="margin:0;font-size:22px;font-weight:bold;color:' + color + ';">' + name + '</p>';
  const paragraphs = (options.paragraphs ?? [])
    .filter((text): text is string => Boolean(text && text.trim()))
    .map((text) => '<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#111827;white-space:pre-line;">' + escapeEmail(text.trim()) + '</p>')
    .join('');
  const details = options.details?.length
    ? '<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0 0;">' +
      options.details
        .map(
          (row) =>
            '<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">' + escapeEmail(row.label) + '</td>' +
            '<td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;' + (row.strong ? 'font-weight:bold;' : '') + '">' + escapeEmail(row.value) + '</td></tr>'
        )
        .join('') +
      '</table>'
    : '';
  const url = options.button ? escapeEmail(options.button.url) : '';
  const button = options.button
    ? '<tr><td align="center" style="padding:20px 24px 8px 24px;"><a href="' + url + '" style="display:inline-block;padding:14px 40px;background-color:' + color + ';color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">' + escapeEmail(options.button.label) + '</a></td></tr>'
    : '';
  const address = brand.businessAddress?.trim()
    ? '<p style="margin:4px 0 0 0;font-size:14px;line-height:1.5;color:#111827;white-space:pre-line;">' + escapeEmail(brand.businessAddress.trim()) + '</p>'
    : '';
  const website = brand.businessWebsite?.trim() || '';
  const websiteHref = website && !/^https?:\/\//i.test(website) ? 'https://' + website : website;
  const link = (href: string, text: string) => '<a href="' + escapeEmail(href) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmail(text) + '</a>';
  const contacts = [
    brand.businessEmail?.trim() ? link('mailto:' + brand.businessEmail.trim(), brand.businessEmail.trim()) : '',
    brand.businessPhone?.trim() ? link('tel:' + brand.businessPhone.replace(/[^\d+]/g, ''), brand.businessPhone.trim()) : '',
    website ? link(websiteHref, website) : '',
  ].filter(Boolean);
  const footer = brand.footerText?.trim()
    ? '<p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;white-space:pre-line;">' + escapeEmail(brand.footerText.trim()) + '</p>'
    : '';
  const isHub = brand.businessName === COMPANY_INFO.name;
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;background-color:#f3f4f6;">',
    options.preheader ? '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + escapeEmail(options.preheader) + '</div>' : '',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">',
    '<tr><td align="center" style="padding:24px 24px 20px 24px;">' + header + '</td></tr>',
    '<tr><td align="center" style="background-color:' + tint + ';padding:28px 24px;">',
    '<p style="margin:0 0 6px 0;font-size:22px;font-weight:bold;color:#111827;">' + escapeEmail(options.heading) + '</p>',
    options.subheading ? '<p style="margin:0;font-size:14px;color:#111827;">' + escapeEmail(options.subheading) + '</p>' : '',
    options.highlight
      ? '<p style="margin:24px 0 4px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#374151;">' + escapeEmail(options.highlight.label) + '</p>' +
        '<p style="margin:0;font-size:34px;color:' + safeColor(options.highlight.color ?? '#111827') + ';">' + escapeEmail(options.highlight.value) + '</p>'
      : '',
    '</td></tr>',
    paragraphs || details || options.bodyHtml ? '<tr><td style="padding:28px 24px 0 24px;">' + paragraphs + (options.bodyHtml ?? '') + details + '</td></tr>' : '',
    button,
    '<tr><td align="center" style="padding:24px 24px 28px 24px;">',
    '<table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;"><tr><td style="width:160px;border-top:1px solid #d1d5db;font-size:0;line-height:0;">&nbsp;</td></tr></table>',
    '<p style="margin:0;font-size:14px;font-weight:bold;color:#111827;">' + name + '</p>',
    address,
    contacts.length ? '<p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;">' + contacts.join('<br>') + '</p>' : '',
    footer,
    '</td></tr></table>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">',
    '<tr><td align="center" style="padding:16px 24px;font-size:11px;line-height:1.5;color:#6b7280;">',
    options.finePrint ? escapeEmail(options.finePrint) : '',
    options.button ? (options.finePrint ? '<br>' : '') + 'Button not working? Open: <a href="' + url + '" style="color:#2563eb;word-break:break-all;">' + url + '</a>' : '',
    isHub ? '' : '<p style="margin:12px 0 0 0;color:#9ca3af;">Sent with House Pros Hub</p>',
    '</td></tr></table>',
    '</body></html>',
  ].join('\n');
}
