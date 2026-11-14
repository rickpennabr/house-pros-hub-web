import type { LinkItem } from '@/components/proscard/ProLinks';

/**
 * The owner’s saved order is the order on the card and the details page.
 * QR and the booking calendar are part of that list when they are not stored yet,
 * so both screens show the same buttons before the next save.
 */
export function cardLinks(
  links: LinkItem[],
  slug: string | undefined,
  showCalendar: boolean
): LinkItem[] {
  const next = [...links];
  if (!next.some((link) => link.type === 'qrcode')) {
    const qrCode: LinkItem = { type: 'qrcode', value: 'HPH QRcode' };
    const phoneIndex = next.findIndex((link) => link.type === 'phone');
    if (phoneIndex === -1) next.unshift(qrCode);
    else next.splice(phoneIndex + 1, 0, qrCode);
  }

  const bookUrl = slug ? `/book/${slug}` : '';
  if (!showCalendar || !bookUrl) return next;

  const calendarIndex = next.findIndex((link) => link.type === 'calendar' && link.url?.startsWith('/book/'));
  if (calendarIndex >= 0) {
    next[calendarIndex] = { ...next[calendarIndex], url: bookUrl, value: bookUrl };
  } else {
    next.push({ type: 'calendar', url: bookUrl, value: bookUrl });
  }
  return next;
}
