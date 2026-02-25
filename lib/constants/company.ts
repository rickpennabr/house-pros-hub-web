/**
 * Company information constants
 * Update these values with your actual business information
 */

export const COMPANY_INFO = {
  name: 'House Pros Hub',
  email: {
    contact: 'contact@houseproshub.com',
    privacy: 'privacy@houseproshub.com',
    legal: 'legal@houseproshub.com',
  },
  phone: '+1 (702) 555-0123', // Update with your business phone
  /** E.164 format for wa.me link (e.g. 17025550123). Leave empty to hide WhatsApp CTA. */
  whatsapp: '17025550123',
  address: '6323 Silverfield Dr, Las Vegas, Nevada 89103',
} as const;

/** WhatsApp URL for contact (wa.me without + or spaces). */
export const COMPANY_WHATSAPP_URL = COMPANY_INFO.whatsapp
  ? `https://wa.me/${COMPANY_INFO.whatsapp.replace(/\D/g, '')}`
  : '';

