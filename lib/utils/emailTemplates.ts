import {
  calendarEmailButtons,
  icsUrlFromManageUrl,
  visitCalendarDescription,
  visitCalendarTitle,
} from '@/lib/booking/calendarLinks';
import { COMPANY_INFO, COMPANY_WHATSAPP_URL } from '@/lib/constants/company';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { brandedEmail, emailMoneyText, hubEmailBrand, type EmailBrand } from '@/lib/email/branded-layout';

/**
 * Footer CTA block: phone, WhatsApp, and email contact buttons for customer-facing emails.
 */
function getFooterContactCta(): string {
  const tel = COMPANY_INFO.phone ? COMPANY_INFO.phone.replace(/\D/g, '') : '';
  const telHref = tel ? `tel:+${tel}` : '';
  const mailHref = `mailto:${COMPANY_INFO.email.contact}`;
  const whatsappHref = COMPANY_WHATSAPP_URL;

  return `
  <table cellpadding="0" cellspacing="0" align="center" style="margin: 16px 0 20px 0; border-collapse: collapse;">
    <tr>
      ${telHref ? `
      <td style="padding: 0 8px;">
        <a href="${telHref}" style="display: inline-block; padding: 10px 18px; background-color: #000000; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 6px;">&#9742; Call</a>
      </td>
      ` : ''}
      ${whatsappHref ? `
      <td style="padding: 0 8px;">
        <a href="${whatsappHref}" style="display: inline-block; padding: 10px 18px; background-color: #25D366; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 6px;">&#128172; WhatsApp</a>
      </td>
      ` : ''}
      <td style="padding: 0 8px;">
        <a href="${mailHref}" style="display: inline-block; padding: 10px 18px; background-color: #000000; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 6px;">&#9993; Email</a>
      </td>
    </tr>
  </table>`;
}

export interface EmailTranslations {
  subject: string;
  subjectAdmin: string;
  greeting: string;
  thankYou: string;
  thankYouAdmin: string;
  proWillContact: string;
  copyBelow: string;
  /** Customer sentence when an agent app opened the request. Contains %%APP%%. */
  agentNotice: string;
  sections: {
    customerInfo: string;
    projectAddress: string;
    projectDetails: string;
    projectType: string;
    trades: string;
    description: string;
    images: string;
    budget: string;
    timeline: string;
    contactPreference: string;
    additionalNotes: string;
    hoaApproval: string;
    wants3D: string;
  };
  footer: {
    companyName: string;
    contactInfo: string;
    unsubscribe: string;
  };
  admin: {
    estimateId: string;
    submittedAt: string;
    userId: string;
    anonymous: string;
    source: string;
    /** Contains %%APP%%. */
    viaAgent: string;
    viaWebsite: string;
    viaQuickRepair: string;
  };
  yes: string;
  no: string;
  noneSelected: string;
  noImagesProvided: string;
}

export interface EstimateEmailData extends EstimateSchema {
  estimateId?: string;
  submittedAt?: string;
  userId?: string | null;
  /** Set when an agent app opened the request. Shown to the homeowner and the admin. */
  agentAppName?: string | null;
}

export interface WelcomeEmailTranslations {
  subject: string;
  greeting: string;
  customerWelcomeMessage: string;
  contractorWelcomeMessage: string;
  bothWelcomeMessage: string;
  nextSteps: string;
  customerNextSteps: string;
  contractorNextSteps: string;
  bothNextSteps: string;
  /** Base URL for the app (e.g. https://houseproshub.com). Used for CTA button link. */
  siteUrl?: string;
  footer: {
    companyName: string;
    contactInfo: string;
    unsubscribe: string;
  };
}

export interface WelcomeEmailData {
  firstName: string;
  lastName: string;
  email: string;
  userType: 'customer' | 'contractor' | 'realtor' | 'installer' | 'handyman' | 'both';
}

export interface SetPasswordEmailTranslations {
  subject: string;
  greeting: string;
  body: string;
  cta: string;
  footer: {
    companyName: string;
    contactInfo: string;
    unsubscribe: string;
  };
}

export interface NewSignupAdminNotificationData {
  type: 'customer' | 'contractor' | 'realtor' | 'installer' | 'handyman' | 'business';
  /** For customer/contractor/realtor: full name. For business: business name. */
  name: string;
  email: string;
  /** Optional: phone (customer/contractor/realtor). */
  phone?: string | null;
}

/**
 * Generate HTML email for admin: new customer, new contractor signup, or new business added.
 */
export function generateNewSignupAdminNotification(data: NewSignupAdminNotificationData): string {
  const title =
    data.type === 'customer'
      ? 'New customer signed up'
      : data.type === 'contractor'
        ? 'New contractor signed up'
        : data.type === 'realtor'
          ? 'New realtor signed up'
          : data.type === 'installer'
            ? 'New installer signed up'
            : data.type === 'handyman'
              ? 'New handyman signed up'
              : 'New business added';
  const typeLabel =
    data.type === 'customer'
      ? 'Customer'
      : data.type === 'contractor'
        ? 'Contractor'
        : data.type === 'realtor'
          ? 'Realtor'
          : data.type === 'installer'
            ? 'Installer'
            : data.type === 'handyman'
              ? 'Handyman'
              : 'Business';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #000000; text-align: center;">
              <img src="https://houseproshub.com/hph-logo-2.3.png" alt="House Pros Hub" height="48" style="display:block;margin:0 auto 12px auto;max-height:48px;max-width:200px;" /><h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #000000;">${title}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 15px; color: #333;">
                <tr>
                  <td style="padding: 8px 0;"><strong>Type:</strong></td>
                  <td style="padding: 8px 0;">${typeLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Name:</strong></td>
                  <td style="padding: 8px 0;">${data.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;"><strong>Email:</strong></td>
                  <td style="padding: 8px 0;">${data.email}</td>
                </tr>
                ${data.phone ? `
                <tr>
                  <td style="padding: 8px 0;"><strong>Phone:</strong></td>
                  <td style="padding: 8px 0;">${data.phone}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px; background-color: #f9fafb; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #666;">House Pros Hub – Admin notification</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export interface IncomingEmailNotificationData {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject?: string;
  textContent?: string;
  htmlContent?: string;
  receivedAt: string;
  hasAttachments: boolean;
  attachmentCount: number;
  emailId?: string;
}

/**
 * Format a value for display in email
 */
function formatValue(value: string | boolean | undefined | null, translations: EmailTranslations): string {
  if (value === undefined || value === null) {
    return 'N/A';
  }
  if (typeof value === 'boolean') {
    return value ? translations.yes : translations.no;
  }
  return String(value);
}

function estimateSourceLabel(estimate: EstimateEmailData, translations: EmailTranslations): string {
  if (estimate.source === 'quick_repair') return translations.admin.viaQuickRepair;
  if (estimate.agentAppName) {
    return translations.admin.viaAgent.replace('%%APP%%', escapeHtml(estimate.agentAppName));
  }
  return translations.admin.viaWebsite;
}

/**
 * Generate HTML email template for estimate confirmation
 */
export function generateEstimateConfirmationEmail(
  estimate: EstimateEmailData,
  translations: EmailTranslations,
  recipientType: 'customer' | 'admin' = 'customer'
): string {
  const isAdmin = recipientType === 'admin';
  const subject = isAdmin ? translations.subjectAdmin : translations.subject;
  const thankYou = isAdmin ? translations.thankYouAdmin : translations.thankYou;

  // Format project type
  const projectTypeMap: Record<string, string> = {
    new_construction: 'New Construction',
    renovation: 'Renovation',
    repair: 'Repair',
    remodel: 'Remodel',
    addition_extension: 'Addition/Extension',
    maintenance: 'Maintenance',
    other: 'Other',
  };
  const projectTypeDisplay = estimate.projectType === 'other' && estimate.projectTypeOther
    ? `${(estimate.projectType != null && projectTypeMap[estimate.projectType]) || estimate.projectType}: ${estimate.projectTypeOther}`
    : (estimate.projectType != null ? projectTypeMap[estimate.projectType] || estimate.projectType : '');

  // Format budget range
  const budgetMap: Record<string, string> = {
    under_5k: 'Under $5k',
    '5k_10k': '$5k - $10k',
    '10k_25k': '$10k - $25k',
    '25k_50k': '$25k - $50k',
    '50k_100k': '$50k - $100k',
    over_100k: 'Over $100k',
    not_sure: 'Not sure',
  };
  const budgetDisplay = estimate.budgetRange != null ? budgetMap[estimate.budgetRange] || estimate.budgetRange : '';

  // Format timeline
  const timelineMap: Record<string, string> = {
    asap: 'ASAP',
    within_month: 'Within a month',
    '1_3_months': '1-3 months',
    '3_6_months': '3-6 months',
    '6_plus_months': '6+ months',
    flexible: 'Flexible',
  };
  const timelineDisplay = estimate.timeline != null ? timelineMap[estimate.timeline] || estimate.timeline : '';

  // Format contact method
  const contactMap: Record<string, string> = {
    phone: 'Phone',
    email: 'Email',
    text: 'Text',
    either: 'Either',
  };
  const contactDisplay = estimate.preferredContactMethod != null ? contactMap[estimate.preferredContactMethod] || estimate.preferredContactMethod : '';

  // Format address
  const addressParts = [
    estimate.streetAddress,
    estimate.apartment,
    `${estimate.city}, ${estimate.state} ${estimate.zipCode}`,
  ].filter(Boolean);
  const fullAddress = addressParts.join(', ');

  // Format trades
  const tradesDisplay = estimate.trades.length > 0
    ? estimate.trades.join(', ')
    : translations.noneSelected;

  // Format images
  const imagesHtml = estimate.projectImages && estimate.projectImages.length > 0
    ? estimate.projectImages.map((url, index) => `
        <div style="margin-bottom: 10px;">
          <a href="${url}" style="color: #dc2626; text-decoration: underline;">Image ${index + 1}</a>
        </div>
      `).join('')
    : `<p style="color: #666; margin: 0;">${translations.noImagesProvided}</p>`;

  // Admin metadata
  const adminMetadata = isAdmin ? `
    <tr>
      <td colspan="2" style="padding: 15px; background-color: #f9fafb; border-top: 2px solid #000;">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #000;">${translations.admin.estimateId}</h3>
        <p style="margin: 0 0 10px 0; color: #333;">${estimate.estimateId || 'N/A'}</p>
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #000;">${translations.admin.submittedAt}</h3>
        <p style="margin: 0 0 10px 0; color: #333;">${estimate.submittedAt || 'N/A'}</p>
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #000;">${translations.admin.userId}</h3>
        <p style="margin: 0 0 10px 0; color: #333;">${estimate.userId || translations.admin.anonymous}</p>
        <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #000;">${translations.admin.source}</h3>
        <p style="margin: 0; color: #333;">${estimateSourceLabel(estimate, translations)}</p>
      </td>
    </tr>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #000000; text-align: center;">
              <img src="https://houseproshub.com/hph-logo-2.3.png" alt="House Pros Hub" height="56" style="display:block;margin:0 auto;max-height:56px;max-width:240px;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${translations.greeting},</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${thankYou}</p>
              ${!isAdmin && estimate.agentAppName ? `<p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${translations.agentNotice.replace('%%APP%%', escapeHtml(estimate.agentAppName))}</p>` : ''}
              ${!isAdmin ? `<p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${translations.proWillContact}</p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #333;">${translations.copyBelow}</p>` : ''}
              
              <!-- Estimate Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border: 2px solid #000000; border-radius: 4px; overflow: hidden;">
                <!-- Customer Information -->
                <tr>
                  <td colspan="2" style="padding: 15px; background-color: #000000; color: #ffffff;">
                    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">${translations.sections.customerInfo}</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; width: 40%; font-weight: bold; color: #000;">Name:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${estimate.firstName} ${estimate.lastName}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">Email:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${estimate.email}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">Phone:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${estimate.phone}</td>
                </tr>
                
                <!-- Project Address -->
                <tr>
                  <td colspan="2" style="padding: 15px; background-color: #f9fafb; border-top: 2px solid #000000;">
                    <h2 style="margin: 0 0 10px 0; font-size: 18px; font-weight: bold; color: #000;">${translations.sections.projectAddress}</h2>
                    <p style="margin: 0; color: #333;">${fullAddress}</p>
                  </td>
                </tr>
                
                <!-- Project Details -->
                <tr>
                  <td colspan="2" style="padding: 15px; background-color: #000000; color: #ffffff;">
                    <h2 style="margin: 0; font-size: 18px; font-weight: bold;">${translations.sections.projectDetails}</h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.projectType}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${projectTypeDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.trades}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${tradesDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.description}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${estimate.projectDescription}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.images}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${imagesHtml}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.budget}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${budgetDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.timeline}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${timelineDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.contactPreference}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${contactDisplay}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.hoaApproval}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${formatValue(estimate.requiresHoaApproval, translations)}</td>
                </tr>
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.wants3D}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${formatValue(estimate.wants3D, translations)}</td>
                </tr>
                ${estimate.additionalNotes ? `
                <tr>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; font-weight: bold; color: #000;">${translations.sections.additionalNotes}:</td>
                  <td style="padding: 15px; border-bottom: 1px solid #e5e5e5; color: #333;">${estimate.additionalNotes}</td>
                </tr>
                ` : ''}
                ${adminMetadata}
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-top: 2px solid #000000; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">${translations.footer.companyName}</p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${translations.footer.contactInfo}</p>
              ${getFooterContactCta()}
              <p style="margin: 0; font-size: 11px; color: #999;">${translations.footer.unsubscribe}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML email template for welcome email
 */
export function generateWelcomeEmail(
  userData: WelcomeEmailData,
  translations: WelcomeEmailTranslations
): string {
  // Determine welcome message and next steps based on user type
  let welcomeMessage: string;
  let nextStepsContent: string;
  
  switch (userData.userType) {
    case 'customer':
      welcomeMessage = translations.customerWelcomeMessage;
      nextStepsContent = translations.customerNextSteps;
      break;
    case 'contractor':
      welcomeMessage = translations.contractorWelcomeMessage;
      nextStepsContent = translations.contractorNextSteps;
      break;
    case 'realtor':
    case 'installer':
    case 'handyman':
      welcomeMessage = translations.contractorWelcomeMessage;
      nextStepsContent = translations.contractorNextSteps;
      break;
    case 'both':
      welcomeMessage = translations.bothWelcomeMessage;
      nextStepsContent = translations.bothNextSteps;
      break;
    default:
      welcomeMessage = translations.customerWelcomeMessage;
      nextStepsContent = translations.customerNextSteps;
  }

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${translations.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #000000; text-align: center;">
              <img src="https://houseproshub.com/hph-logo-2.3.png" alt="House Pros Hub" height="56" style="display:block;margin:0 auto;max-height:56px;max-width:240px;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${translations.greeting} ${userData.firstName},</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${welcomeMessage}</p>
              
              <!-- Next Steps Section -->
              <div style="margin: 30px 0;">
                <h2 style="margin: 0 0 15px 0; font-size: 18px; font-weight: bold; color: #000;">${translations.nextSteps}</h2>
                <div style="padding: 20px; background-color: #f9fafb; border: 2px solid #000000; border-radius: 4px;">
                  <div style="font-size: 16px; color: #333; line-height: 1.6;">
                    ${nextStepsContent}
                  </div>
                </div>
                ${translations.siteUrl ? `
                <table cellpadding="0" cellspacing="0" style="margin: 20px 0 0 0;">
                  <tr>
                    <td style="border-radius: 8px; background-color: #000000; padding: 0;">
                      <a href="${translations.siteUrl}/businesslist" style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none;">GO SEE THE PROS</a>
                    </td>
                  </tr>
                </table>
                <div style="margin-top: 24px; padding: 20px; background-color: #f9fafb; border: 2px solid #000000; border-radius: 4px;">
                  <div style="font-size: 16px; color: #333; line-height: 1.6;">
                    ${nextStepsContent}
                  </div>
                </div>
                ` : ''}
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-top: 2px solid #000000; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">${translations.footer.companyName}</p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${translations.footer.contactInfo}</p>
              ${getFooterContactCta()}
              <p style="margin: 0; font-size: 11px; color: #999;">${translations.footer.unsubscribe}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML email template for "set your password" (admin-created customer)
 */
export function generateSetPasswordEmail(
  firstName: string,
  setPasswordLink: string,
  translations: SetPasswordEmailTranslations
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${translations.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #000000; text-align: center;">
              <img src="https://houseproshub.com/hph-logo-2.3.png" alt="House Pros Hub" height="56" style="display:block;margin:0 auto;max-height:56px;max-width:240px;" />
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${translations.greeting} ${firstName},</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${translations.body}</p>
              <table cellpadding="0" cellspacing="0" style="margin: 24px 0 0 0;">
                <tr>
                  <td style="border-radius: 8px; background-color: #000000; padding: 0;">
                    <a href="${setPasswordLink}" style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none;">${translations.cta}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-top: 2px solid #000000; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">${translations.footer.companyName}</p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${translations.footer.contactInfo}</p>
              ${getFooterContactCta()}
              <p style="margin: 0; font-size: 11px; color: #999;">${translations.footer.unsubscribe}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export interface PasswordResetEmailData {
  resetLink: string;
  userName?: string;
  language: 'en' | 'es' | 'pt';
}

const passwordResetTranslations = {
  en: {
    title: 'Reset Your Password',
    subtitle: 'We received a request to reset your password for your House Pros Hub account.',
    greeting: (name?: string) => (name ? `Hello ${name},` : 'Hello,'),
    instruction: 'Click the button below to reset your password. This link will expire in 1 hour.',
    securityNote: 'Security Note:',
    securityText: 'If you did not request a password reset, please ignore this email. Your password will remain unchanged.',
    buttonText: 'Reset Password',
    alternativeText: "If the button doesn't work, copy and paste this link into your browser:",
    expiryNote: 'This link will expire in 1 hour.',
    thankYou: 'Thank you for using House Pros Hub!',
    questions: 'Questions? Contact us at',
  },
  es: {
    title: 'Restablece tu contraseña',
    subtitle: 'Recibimos una solicitud para restablecer la contraseña de tu cuenta de House Pros Hub.',
    greeting: (name?: string) => (name ? `Hola ${name},` : 'Hola,'),
    instruction: 'Haz clic en el botón de abajo para restablecer tu contraseña. Este enlace caducará en 1 hora.',
    securityNote: 'Nota de seguridad:',
    securityText: 'Si no solicitaste un restablecimiento de contraseña, ignora este correo. Tu contraseña no cambiará.',
    buttonText: 'Restablecer contraseña',
    alternativeText: "Si el botón no funciona, copia y pega este enlace en tu navegador:",
    expiryNote: 'Este enlace caducará en 1 hora.',
    thankYou: '¡Gracias por usar House Pros Hub!',
    questions: '¿Preguntas? Contáctanos en',
  },
  pt: {
    title: 'Redefinir sua senha',
    subtitle: 'Recebemos uma solicitação para redefinir a senha da sua conta House Pros Hub.',
    greeting: (name?: string) => (name ? `Olá ${name},` : 'Olá,'),
    instruction: 'Clique no botão abaixo para redefinir sua senha. Este link expira em 1 hora.',
    securityNote: 'Nota de segurança:',
    securityText: 'Se você não solicitou a redefinição de senha, ignore este e-mail. Sua senha permanecerá inalterada.',
    buttonText: 'Redefinir senha',
    alternativeText: 'Se o botão não funcionar, copie e cole este link no seu navegador:',
    expiryNote: 'Este link expira em 1 hora.',
    thankYou: 'Obrigado por usar o House Pros Hub!',
    questions: 'Dúvidas? Entre em contato em',
  },
} as const;

/**
 * Generate HTML email template for password reset (forgot password flow).
 */
export function generatePasswordResetEmail(data: PasswordResetEmailData): string {
  const t = passwordResetTranslations[data.language];
  const greeting = t.greeting(data.userName);
  return `
<!DOCTYPE html>
<html lang="${data.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.title} - House Pros Hub</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #000000; text-align: center;">
              <img src="https://houseproshub.com/hph-logo-2.3.png" alt="House Pros Hub" height="56" style="display:block;margin:0 auto;max-height:56px;max-width:240px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #333;">${greeting}</p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #333;">${t.subtitle}</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${t.instruction}</p>
              <table cellpadding="0" cellspacing="0" style="margin: 24px 0 0 0;">
                <tr>
                  <td style="border-radius: 8px; background-color: #000000; padding: 0;">
                    <a href="${data.resetLink}" style="display: inline-block; padding: 14px 28px; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none;">${t.buttonText}</a>
                  </td>
                </tr>
              </table>
              <p style="margin: 20px 0 8px 0; font-size: 14px; color: #666;">${t.alternativeText}</p>
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #666; word-break: break-all;">${data.resetLink}</p>
              <p style="margin: 0 0 20px 0; font-size: 13px; color: #666; font-style: italic;">${t.expiryNote}</p>
              <div style="background-color: #f9fafb; border-left: 4px solid #000000; padding: 16px; margin: 20px 0 0 0;">
                <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: bold; color: #333;">${t.securityNote}</p>
                <p style="margin: 0; font-size: 14px; color: #333;">${t.securityText}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-top: 2px solid #000000; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">House Pros Hub</p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${t.questions} <a href="mailto:${COMPANY_INFO.email.contact}" style="color: #000000;">${COMPANY_INFO.email.contact}</a></p>
              ${getFooterContactCta()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export interface PasswordChangedEmailData {
  userName?: string;
  language: 'en' | 'es' | 'pt';
  /** Support phone for "if you didn't change it" (e.g. (702) 232-0411). */
  supportPhoneDisplay: string;
}

const passwordChangedTranslations = {
  en: {
    subject: 'Your password was changed',
    greeting: (name?: string) => (name ? `Hi ${name},` : 'Hi,'),
    message: 'Your House Pros Hub account password was recently changed.',
    ifNotYou: 'If you did not change it, please contact us at',
    forAssistance: 'for assistance.',
    automatedDisclaimer: 'This email is sent from an automated system; please do not reply.',
    copyright: 'House Pros Hub. All rights reserved.',
  },
  es: {
    subject: 'Tu contraseña fue cambiada',
    greeting: (name?: string) => (name ? `Hola ${name},` : 'Hola,'),
    message: 'La contraseña de tu cuenta de House Pros Hub fue cambiada recientemente.',
    ifNotYou: 'Si no fuiste tú quien la cambió, contáctanos al',
    forAssistance: 'para recibir asistencia.',
    automatedDisclaimer: 'Este correo es enviado por un sistema automático; por favor no respondas.',
    copyright: 'House Pros Hub. Todos los derechos reservados.',
  },
  pt: {
    subject: 'Sua senha foi alterada',
    greeting: (name?: string) => (name ? `Olá ${name},` : 'Olá,'),
    message: 'A senha da sua conta House Pros Hub foi alterada recentemente.',
    ifNotYou: 'Se não foi você quem alterou, entre em contato conosco no',
    forAssistance: 'para assistência.',
    automatedDisclaimer: 'Este e-mail é enviado por um sistema automático; por favor não responda.',
    copyright: 'House Pros Hub. Todos os direitos reservados.',
  },
} as const;

/**
 * Generate HTML email template for password change confirmation (ADP-style).
 * Sent after user successfully changes password so they know the change occurred.
 */
export function generatePasswordChangedEmail(data: PasswordChangedEmailData): string {
  const t = passwordChangedTranslations[data.language];
  const greeting = t.greeting(data.userName);
  const supportPhone = data.supportPhoneDisplay;
  return `
<!DOCTYPE html>
<html lang="${data.language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject} - House Pros Hub</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #000000; text-align: center;">
              <img src="https://houseproshub.com/hph-logo-2.3.png" alt="House Pros Hub" height="56" style="display:block;margin:0 auto;max-height:56px;max-width:240px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #333;">${greeting}</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${t.message}</p>
              <p style="margin: 0 0 24px 0; font-size: 16px; color: #333;">${t.ifNotYou} <a href="tel:+1${supportPhone.replace(/\D/g, '')}" style="color: #000000; font-weight: bold;">${supportPhone}</a> ${t.forAssistance}</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 24px; background-color: #f9fafb; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #666;">${t.automatedDisclaimer}</p>
              <p style="margin: 0; font-size: 12px; color: #999;">© ${new Date().getFullYear()} ${t.copyright}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate HTML email template for incoming email notification to admin
 */
export function generateIncomingEmailNotification(
  emailData: IncomingEmailNotificationData
): string {
  const fromDisplay = emailData.fromName
    ? `${emailData.fromName} <${emailData.fromEmail}>`
    : emailData.fromEmail;

  const subject = emailData.subject || '(No Subject)';
  const content = emailData.htmlContent || emailData.textContent || 'No content available';
  const isHtml = !!emailData.htmlContent;

  const receivedDate = new Date(emailData.receivedAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Email Received: ${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="700" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #000000; text-align: center;">
              <img src="https://houseproshub.com/hph-logo-2.3.png" alt="House Pros Hub" height="48" style="display:block;margin:0 auto 12px auto;max-height:48px;max-width:200px;" /><h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #000000;">New Email Received</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 30px; background-color: #f9fafb; border-bottom: 2px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #374151;">
                    <strong>From:</strong> ${fromDisplay}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #374151;">
                    <strong>To:</strong> ${emailData.toEmail}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #374151;">
                    <strong>Subject:</strong> ${subject}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #374151;">
                    <strong>Received:</strong> ${receivedDate}
                  </td>
                </tr>
                ${emailData.hasAttachments ? `
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #374151;">
                    <strong>Attachments:</strong> ${emailData.attachmentCount} file(s)
                  </td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;">
              <div style="font-size: 16px; color: #333; line-height: 1.6;">
                ${isHtml ? content : `<pre style="white-space: pre-wrap; font-family: Arial, sans-serif; margin: 0;">${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-top: 2px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">House Pros Hub</p>
              <p style="margin: 0; font-size: 12px; color: #999;">
                This is an automated notification of an incoming email to ${emailData.toEmail}
                ${emailData.emailId ? `<br>Email ID: ${emailData.emailId}` : ''}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/** ProEstimate booking confirmation email data */
export interface ProEstimateBookingEmailData {
  businessName: string;
  /** Customer display name (first + last or "Guest") */
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  /** Formatted date and time, e.g. "Friday, March 13, 2026 at 2:00 PM" */
  slotDisplay: string;
  slotStartAt: string;
  slotEndAt: string;
  /** Catalog service chosen for this visit, when the customer picked one. */
  serviceName?: string | null;
  /** Customer manage page. Shown on the customer email only. */
  manageUrl?: string | null;
  locationAddress?: string | null;
  visitNote?: string | null;
  /** When set, the email includes a calendar file for this visit. */
  bookingId?: string | null;
  calendarMethod?: 'PUBLISH' | 'CANCEL';
  calendarSequence?: number;
}

/** Translations for ProEstimate booking emails */
export interface ProEstimateBookingEmailTranslations {
  subjectCustomer: string;
  subjectPro: string;
  greetingCustomer: string;
  greetingPro: string;
  bodyCustomer: string;
  bodyPro: string;
  detailsLabel: string;
  dateTimeLabel: string;
  withLabel: string;
  serviceLabel?: string;
  locationLabel?: string;
  noteLabel?: string;
  manageLabel?: string;
  policyNote?: string;
  addToCalendar?: string;
  googleCalendar?: string;
  outlookCalendar?: string;
  otherCalendar?: string;
  lang?: string;
  footer: { companyName: string; contactInfo: string };
}

/**
 * Generate HTML for ProEstimate booking confirmation (customer or pro).
 */
export function generateProEstimateBookingEmail(
  data: ProEstimateBookingEmailData,
  translations: ProEstimateBookingEmailTranslations,
  recipient: 'customer' | 'pro'
): string {
  const isPro = recipient === 'pro';
  const subject = isPro ? translations.subjectPro : translations.subjectCustomer;
  const greeting = isPro ? translations.greetingPro : translations.greetingCustomer;
  const body = isPro ? translations.bodyPro : translations.bodyCustomer;
  const withLabel = isPro ? `${translations.withLabel} ${data.customerName} (${data.customerEmail}${data.customerPhone ? `, ${data.customerPhone}` : ''})` : `${translations.withLabel} ${data.businessName}`;

  return `
<!DOCTYPE html>
<html lang="${translations.lang ?? 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 2px solid #000000; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 20px; background-color: #ffffff; border-bottom: 2px solid #000000; text-align: center;">
              <img src="https://houseproshub.com/hph-logo-2.3.png" alt="House Pros Hub" height="56" style="display:block;margin:0 auto;max-height:56px;max-width:240px;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 30px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #333;">${greeting}</p>
              <p style="margin: 0 0 16px 0; font-size: 16px; color: #333;">${body}</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px; font-size: 15px; color: #333; border: 1px solid #e5e7eb; border-radius: 6px;">
                <tr>
                  <td style="padding: 16px; background-color: #f9fafb;">
                    <strong>${translations.detailsLabel}</strong>
                  </td>
                </tr>
                ${data.serviceName ? `<tr>
                  <td style="padding: 12px 16px;">${translations.serviceLabel ?? 'Service'}: ${data.serviceName}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 12px 16px;">${translations.dateTimeLabel}: ${escapeHtml(data.slotDisplay)}</td>
                </tr>
                ${data.locationAddress ? `<tr>
                  <td style="padding: 12px 16px;">${escapeHtml(translations.locationLabel ?? 'Address')}: ${escapeHtml(data.locationAddress)}</td>
                </tr>` : ''}
                ${data.visitNote ? `<tr>
                  <td style="padding: 12px 16px;">${escapeHtml(translations.noteLabel ?? 'Note')}: ${escapeHtml(data.visitNote)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding: 12px 16px;">${translations.withLabel}: ${withLabel}</td>
                </tr>
              </table>
              ${calendarEmailButtons({
                title: visitCalendarTitle(data.businessName, data.serviceName),
                description: visitCalendarDescription([
                  isPro ? data.customerName : data.businessName,
                  data.visitNote,
                  data.manageUrl,
                ]),
                location: data.locationAddress ?? '',
                startAt: data.slotStartAt,
                endAt: data.slotEndAt,
                icsUrl: icsUrlFromManageUrl(data.manageUrl),
                cancelled: data.calendarMethod === 'CANCEL',
                labels: {
                  addToCalendar: translations.addToCalendar ?? 'Add it to your calendar',
                  googleCalendar: translations.googleCalendar ?? 'Google Calendar',
                  outlookCalendar: translations.outlookCalendar ?? 'Outlook',
                  otherCalendar: translations.otherCalendar ?? 'Apple and other calendars',
                },
              })}
              ${!isPro && data.manageUrl ? `<p style="margin: 20px 0 0 0;"><a href="${escapeHtml(data.manageUrl)}" style="display: inline-block; padding: 12px 24px; background-color: #000000; color: #ffffff; font-size: 14px; font-weight: bold; text-decoration: none; border-radius: 6px;">${escapeHtml(translations.manageLabel ?? 'Manage appointment')}</a></p>` : ''}
              ${!isPro && translations.policyNote ? `<p style="margin: 12px 0 0 0; font-size: 13px; color: #666;">${escapeHtml(translations.policyNote)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-top: 2px solid #000000; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">${translations.footer.companyName}</p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${translations.footer.contactInfo}</p>
              ${getFooterContactCta()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export interface InvoiceEmailData {
  businessName: string;
  invoiceNumber: string;
  amountCents: number;
  viewUrl: string;
  message?: string;
  /** Branding (optional; without it the email is plain black and white). */
  logoUrl?: string | null;
  /** Brand color for the panel tint, the button and the contact links. */
  themeColor?: string | null;
  businessAddress?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  /** Unpaid part; defaults to the total. */
  balanceCents?: number;
  /** Invoice settings footer (payment instructions, terms). */
  footerText?: string | null;
}

/** Brand color mixed with white, for a light panel behind the totals (email-safe hex). */
function emailTint(color: string, strength = 0.1): string {
  const hex = color.replace('#', '');
  const mix = (offset: number) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16);
    return Math.round(255 - (255 - channel) * strength)
      .toString(16)
      .padStart(2, '0');
  };
  return '#' + mix(0) + mix(2) + mix(4);
}

/**
 * Branded "your invoice is ready" email (customer), laid out like QuickBooks: logo, a tinted panel
 * with the total and balance due, the pro's message, a pay button, then the business details.
 */
export function generateInvoiceEmail(data: InvoiceEmailData): string {
  const color = safeEmailColor(data.themeColor);
  const tint = color === '#000000' ? '#f3f4f6' : emailTint(color);
  const business = escapeEmailHtml(data.businessName);
  const number = escapeEmailHtml(data.invoiceNumber);
  const total = emailMoney(data.amountCents);
  const balanceCents = Math.max(0, data.balanceCents ?? data.amountCents);
  const balance = emailMoney(balanceCents);
  // A paid invoice sent again (a copy or a correction) says so instead of asking to pay.
  const paid = balanceCents === 0 && data.amountCents > 0;
  const url = escapeEmailHtml(data.viewUrl);
  const header = data.logoUrl
    ? '<img src="' + escapeEmailHtml(data.logoUrl) + '" alt="' + business + '" height="64" style="display:block;margin:0 auto;max-height:64px;max-width:240px;border-radius:8px;" />'
    : '<p style="margin:0;font-size:22px;font-weight:bold;color:' + color + ';">' + business + '</p>';
  const message = data.message?.trim()
    ? '<p style="margin:0 0 24px 0;font-size:15px;line-height:1.5;color:#111827;white-space:pre-line;">' + escapeEmailHtml(data.message.trim()) + '</p>'
    : '';
  const address = data.businessAddress?.trim()
    ? '<p style="margin:4px 0 0 0;font-size:14px;line-height:1.5;color:#111827;white-space:pre-line;">' + escapeEmailHtml(data.businessAddress.trim()) + '</p>'
    : '';
  const website = data.businessWebsite?.trim() || '';
  const websiteHref = website && !/^https?:\/\//i.test(website) ? 'https://' + website : website;
  const contacts = [
    data.businessEmail?.trim() ? '<a href="mailto:' + escapeEmailHtml(data.businessEmail.trim()) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(data.businessEmail.trim()) + '</a>' : '',
    data.businessPhone?.trim() ? '<a href="tel:' + escapeEmailHtml(data.businessPhone.replace(/[^\d+]/g, '')) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(data.businessPhone.trim()) + '</a>' : '',
    website ? '<a href="' + escapeEmailHtml(websiteHref) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(website) + '</a>' : '',
  ].filter(Boolean);
  const footer = data.footerText?.trim()
    ? '<p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;white-space:pre-line;">' + escapeEmailHtml(data.footerText.trim()) + '</p>'
    : '';
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;background-color:#f3f4f6;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">',
    '<tr><td align="center" style="padding:24px 24px 20px 24px;">' + header + '</td></tr>',
    '<tr><td align="center" style="background-color:' + tint + ';padding:28px 24px;">',
    '<p style="margin:0 0 6px 0;font-size:22px;font-weight:bold;color:#111827;">' + (paid ? 'Paid in full. Thank you!' : 'Your invoice is ready!') + '</p>',
    '<p style="margin:0;font-size:14px;color:#111827;">Invoice #' + number + ' · Total ' + total + '</p>',
    '<p style="margin:24px 0 4px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#374151;">Balance due</p>',
    '<p style="margin:0;font-size:34px;color:' + (paid ? '#15803d' : '#111827') + ';">' + balance + (paid ? ' · Paid' : '') + '</p>',
    '</td></tr>',
    '<tr><td align="center" style="padding:32px 24px 8px 24px;">',
    message,
    '<a href="' + url + '" style="display:inline-block;padding:14px 40px;background-color:' + color + ';color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">' + (paid ? 'View invoice' : 'View and pay') + '</a>',
    '</td></tr>',
    '<tr><td align="center" style="padding:24px 24px 28px 24px;">',
    '<table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;"><tr><td style="width:160px;border-top:1px solid #d1d5db;font-size:0;line-height:0;">&nbsp;</td></tr></table>',
    '<p style="margin:0;font-size:14px;font-weight:bold;color:#111827;">' + business + '</p>',
    address,
    contacts.length ? '<p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;">' + contacts.join('<br>') + '</p>' : '',
    footer,
    '</td></tr></table>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">',
    '<tr><td align="center" style="padding:16px 24px;font-size:11px;line-height:1.5;color:#6b7280;">',
    'If an email about a payment looks wrong, check with ' + business + ' before paying.<br>',
    'Button not working? Open: <a href="' + url + '" style="color:#2563eb;word-break:break-all;">' + url + '</a>',
    '<p style="margin:12px 0 0 0;color:#9ca3af;">Sent with House Pros Hub</p>',
    '</td></tr></table>',
    '</body></html>',
  ].join('\n');
}

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function emailMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export interface InvoiceReminderEmailData {
  businessName: string;
  logoUrl?: string | null;
  /** Brand color for the header bar and button. */
  themeColor?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  businessAddress?: string | null;
  businessWebsite?: string | null;
  customerName?: string | null;
  invoiceNumber: string;
  balanceCents: number;
  /** Already formatted, e.g. "Nov 21, 2026". */
  dueDateLabel: string;
  /** 0 when due today. */
  daysOverdue: number;
  viewUrl: string;
  /** e.g. "Zelle: name@example.com". Line breaks kept. */
  paymentInstructions?: string | null;
  message?: string | null;
  footerText?: string | null;
}

function safeEmailColor(value: string | null | undefined): string {
  return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000';
}

/**
 * Reminder email in the same layout as the invoice email (logo, panel, message, button, business
 * details), in red: a red band, a red-tinted panel, the balance and the button in red.
 */
export function generateInvoiceReminderEmail(data: InvoiceReminderEmailData): string {
  const red = '#dc2626';
  const business = escapeEmailHtml(data.businessName);
  const number = escapeEmailHtml(data.invoiceNumber);
  const amount = emailMoney(data.balanceCents);
  const late = data.daysOverdue > 0;
  const url = escapeEmailHtml(data.viewUrl);
  const headline = late ? 'Your invoice is past due' : 'Your invoice is due today';
  const dueLine = late
    ? 'Due ' + escapeEmailHtml(data.dueDateLabel) + ' · ' + data.daysOverdue + ' ' + (data.daysOverdue === 1 ? 'day' : 'days') + ' overdue'
    : 'Due today';
  const greeting = data.customerName?.trim() ? 'Hi ' + escapeEmailHtml(data.customerName.trim()) + ',' : 'Hello,';
  const header = data.logoUrl
    ? '<img src="' + escapeEmailHtml(data.logoUrl) + '" alt="' + business + '" height="64" style="display:block;margin:0 auto;max-height:64px;max-width:240px;border-radius:8px;" />'
    : '<p style="margin:0;font-size:22px;font-weight:bold;color:' + red + ';">' + business + '</p>';
  const message = data.message?.trim()
    ? '<p style="margin:0 0 24px 0;font-size:15px;line-height:1.5;color:#111827;white-space:pre-line;">' + escapeEmailHtml(data.message.trim()) + '</p>'
    : '';
  const otherWays = data.paymentInstructions?.trim()
    ? '<tr><td style="padding:8px 24px 0 24px;"><div style="border:2px solid ' + red + ';border-radius:8px;padding:14px 16px;text-align:left;">' +
      '<p style="margin:0 0 6px 0;font-size:13px;font-weight:bold;color:' + red + ';">Other ways to pay</p>' +
      '<p style="margin:0;font-size:14px;line-height:1.5;color:#111827;white-space:pre-line;">' + escapeEmailHtml(data.paymentInstructions.trim()) + '</p>' +
      '<p style="margin:8px 0 0 0;font-size:12px;color:#6b7280;">Please include invoice #' + number + ' in the payment note.</p>' +
      '</div></td></tr>'
    : '';
  const address = data.businessAddress?.trim()
    ? '<p style="margin:4px 0 0 0;font-size:14px;line-height:1.5;color:#111827;white-space:pre-line;">' + escapeEmailHtml(data.businessAddress.trim()) + '</p>'
    : '';
  const website = data.businessWebsite?.trim() || '';
  const websiteHref = website && !/^https?:\/\//i.test(website) ? 'https://' + website : website;
  const link = (href: string, text: string) =>
    '<a href="' + escapeEmailHtml(href) + '" style="color:' + red + ';text-decoration:none;">' + escapeEmailHtml(text) + '</a>';
  const contacts = [
    data.businessEmail?.trim() ? link('mailto:' + data.businessEmail.trim(), data.businessEmail.trim()) : '',
    data.businessPhone?.trim() ? link('tel:' + data.businessPhone.replace(/[^\d+]/g, ''), data.businessPhone.trim()) : '',
    website ? link(websiteHref, website) : '',
  ].filter(Boolean);
  const footer = data.footerText?.trim()
    ? '<p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;white-space:pre-line;">' + escapeEmailHtml(data.footerText.trim()) + '</p>'
    : '';
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;background-color:#f3f4f6;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">',
    '<tr><td style="background-color:' + red + ';height:6px;font-size:0;line-height:0;">&nbsp;</td></tr>',
    '<tr><td align="center" style="padding:24px 24px 20px 24px;">' + header + '</td></tr>',
    '<tr><td align="center" style="background-color:#fecaca;border-top:2px solid ' + red + ';border-bottom:2px solid ' + red + ';padding:28px 24px;">',
    '<p style="margin:0 0 6px 0;font-size:22px;font-weight:bold;color:#7f1d1d;">' + headline + '</p>',
    '<p style="margin:0;font-size:14px;color:#7f1d1d;">Invoice #' + number + ' · ' + dueLine + '</p>',
    '<p style="margin:24px 0 4px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#7f1d1d;">Balance due</p>',
    '<p style="margin:0;font-size:34px;font-weight:bold;color:' + red + ';">' + amount + '</p>',
    '</td></tr>',
    '<tr><td align="center" style="padding:32px 24px 8px 24px;">',
    '<p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:#111827;">' + greeting + '</p>',
    '<p style="margin:0 0 20px 0;font-size:15px;line-height:1.5;color:#374151;">This is a friendly reminder about invoice #' + number + ' from ' + business + '. If you already paid, thank you, and please disregard this email.</p>',
    message,
    '<a href="' + url + '" style="display:inline-block;padding:14px 40px;background-color:' + red + ';color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">Pay now</a>',
    '</td></tr>',
    otherWays,
    '<tr><td align="center" style="padding:24px 24px 28px 24px;">',
    '<table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;"><tr><td style="width:160px;border-top:1px solid #d1d5db;font-size:0;line-height:0;">&nbsp;</td></tr></table>',
    '<p style="margin:0 0 8px 0;font-size:14px;color:#374151;">Thank you for your business!</p>',
    '<p style="margin:0;font-size:14px;font-weight:bold;color:#111827;">' + business + '</p>',
    address,
    contacts.length ? '<p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;">' + contacts.join('<br>') + '</p>' : '',
    footer,
    '</td></tr></table>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">',
    '<tr><td align="center" style="padding:16px 24px;font-size:11px;line-height:1.5;color:#6b7280;">',
    'If an email about a payment looks wrong, check with ' + business + ' before paying.<br>',
    'Button not working? Open: <a href="' + url + '" style="color:#2563eb;word-break:break-all;">' + url + '</a>',
    '<p style="margin:12px 0 0 0;color:#9ca3af;">Sent with House Pros Hub</p>',
    '</td></tr></table>',
    '</body></html>',
  ].join('\n');
}

/** Subject line for a reminder. */
export function invoiceReminderSubject(data: Pick<InvoiceReminderEmailData, 'invoiceNumber' | 'businessName' | 'daysOverdue'>): string {
  return data.daysOverdue > 0
    ? 'Reminder: invoice #' + data.invoiceNumber + ' from ' + data.businessName + ' is past due'
    : 'Reminder: invoice #' + data.invoiceNumber + ' from ' + data.businessName + ' is due today';
}

export interface PaymentReceiptEmailData {
  businessName: string;
  invoiceNumber: string;
  paidCents: number;
  balanceCents: number;
  method: string;
  viewUrl?: string | null;
  /** Invoice total, shown in the details. */
  totalCents?: number | null;
  /** YYYY-MM-DD payment date. */
  paymentDate?: string | null;
  logoUrl?: string | null;
  themeColor?: string | null;
  businessAddress?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  footerText?: string | null;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  card: 'Card',
  credit_card: 'Card',
  stripe: 'Card',
  zelle: 'Zelle',
  venmo: 'Venmo',
  ach: 'Bank transfer',
  bank_transfer: 'Bank transfer',
  other: 'Other',
};

function paymentMethodLabel(method: string): string {
  const key = (method || '').toLowerCase();
  if (PAYMENT_METHOD_LABELS[key]) return PAYMENT_METHOD_LABELS[key];
  return method ? method.charAt(0).toUpperCase() + method.slice(1) : 'Payment';
}

/** Customer receipt after a payment is recorded, in the same branded layout as the invoice email. */
export function generatePaymentReceiptEmail(data: PaymentReceiptEmailData): string {
  const color = safeEmailColor(data.themeColor);
  const tint = color === '#000000' ? '#f3f4f6' : emailTint(color);
  const business = escapeEmailHtml(data.businessName);
  const number = escapeEmailHtml(data.invoiceNumber);
  const method = escapeEmailHtml(paymentMethodLabel(data.method));
  const balanceCents = Math.max(0, data.balanceCents);
  const paidInFull = balanceCents === 0;
  const url = data.viewUrl ? escapeEmailHtml(data.viewUrl) : '';
  const header = data.logoUrl
    ? '<img src="' + escapeEmailHtml(data.logoUrl) + '" alt="' + business + '" height="64" style="display:block;margin:0 auto;max-height:64px;max-width:240px;border-radius:8px;" />'
    : '<p style="margin:0;font-size:22px;font-weight:bold;color:' + color + ';">' + business + '</p>';
  const address = data.businessAddress?.trim()
    ? '<p style="margin:4px 0 0 0;font-size:14px;line-height:1.5;color:#111827;white-space:pre-line;">' + escapeEmailHtml(data.businessAddress.trim()) + '</p>'
    : '';
  const website = data.businessWebsite?.trim() || '';
  const websiteHref = website && !/^https?:\/\//i.test(website) ? 'https://' + website : website;
  const contacts = [
    data.businessEmail?.trim() ? '<a href="mailto:' + escapeEmailHtml(data.businessEmail.trim()) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(data.businessEmail.trim()) + '</a>' : '',
    data.businessPhone?.trim() ? '<a href="tel:' + escapeEmailHtml(data.businessPhone.replace(/[^\d+]/g, '')) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(data.businessPhone.trim()) + '</a>' : '',
    website ? '<a href="' + escapeEmailHtml(websiteHref) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(website) + '</a>' : '',
  ].filter(Boolean);
  const footer = data.footerText?.trim()
    ? '<p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;white-space:pre-line;">' + escapeEmailHtml(data.footerText.trim()) + '</p>'
    : '';
  const row = (label: string, value: string, strong = false, valueColor = '#111827') =>
    '<tr><td style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">' + label + '</td>' +
    '<td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:' + valueColor + ';' + (strong ? 'font-weight:bold;' : '') + 'white-space:nowrap;">' + value + '</td></tr>';
  const details = [
    row('Invoice', '#' + number),
    data.paymentDate ? row('Payment date', escapeEmailHtml(statementDate(data.paymentDate))) : '',
    row('Paid by', method),
    row('Amount paid', emailMoney(data.paidCents), true),
    data.totalCents != null ? row('Invoice total', emailMoney(data.totalCents)) : '',
    row('Balance remaining', emailMoney(balanceCents), true, paidInFull ? '#15803d' : '#111827'),
  ].join('');
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;background-color:#f3f4f6;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">',
    '<tr><td align="center" style="padding:24px 24px 20px 24px;">' + header + '</td></tr>',
    '<tr><td align="center" style="background-color:' + tint + ';padding:28px 24px;">',
    '<p style="margin:0 0 6px 0;font-size:22px;font-weight:bold;color:#111827;">' + (paidInFull ? 'Paid in full. Thank you!' : 'Payment received. Thank you!') + '</p>',
    '<p style="margin:0;font-size:14px;color:#111827;">Invoice #' + number + ' · ' + method + '</p>',
    '<p style="margin:24px 0 4px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#374151;">Amount paid</p>',
    '<p style="margin:0;font-size:34px;color:#15803d;">' + emailMoney(data.paidCents) + '</p>',
    '</td></tr>',
    '<tr><td style="padding:24px 24px 8px 24px;">',
    '<table width="100%" cellpadding="0" cellspacing="0">' + details + '</table>',
    '</td></tr>',
    url
      ? '<tr><td align="center" style="padding:24px 24px 8px 24px;"><a href="' + url + '" style="display:inline-block;padding:14px 40px;background-color:' + color + ';color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;border-radius:8px;">' + (paidInFull ? 'View invoice' : 'View and pay the balance') + '</a></td></tr>'
      : '',
    '<tr><td align="center" style="padding:24px 24px 28px 24px;">',
    '<table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;"><tr><td style="width:160px;border-top:1px solid #d1d5db;font-size:0;line-height:0;">&nbsp;</td></tr></table>',
    '<p style="margin:0;font-size:14px;font-weight:bold;color:#111827;">' + business + '</p>',
    address,
    contacts.length ? '<p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;">' + contacts.join('<br>') + '</p>' : '',
    footer,
    '</td></tr></table>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">',
    '<tr><td align="center" style="padding:16px 24px;font-size:11px;line-height:1.5;color:#6b7280;">',
    'Keep this email as your receipt. If it looks wrong, contact ' + business + '.',
    url ? '<br>Button not working? Open: <a href="' + url + '" style="color:#2563eb;word-break:break-all;">' + url + '</a>' : '',
    '<p style="margin:12px 0 0 0;color:#9ca3af;">Sent with House Pros Hub</p>',
    '</td></tr></table>',
    '</body></html>',
  ].join('\n');
}

export interface StatementEmailLine {
  invoiceNumber: string;
  dueDate: string | null;
  balanceCents: number;
  /** Link to open and pay this invoice. */
  viewUrl?: string | null;
}

export interface StatementEmailData {
  businessName: string;
  customerName: string;
  lines: StatementEmailLine[];
  totalCents: number;
  logoUrl?: string | null;
  themeColor?: string | null;
  businessAddress?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  businessWebsite?: string | null;
  footerText?: string | null;
  /** YYYY-MM-DD, to mark late invoices. */
  today?: string;
}

function statementDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Branded statement of a customer's open invoices: same layout as the invoice email, a tinted
 * panel with the total due, one row per invoice with its own Pay link, then the business details.
 */
export function generateStatementEmail(data: StatementEmailData): string {
  const color = safeEmailColor(data.themeColor);
  const tint = color === '#000000' ? '#f3f4f6' : emailTint(color);
  const business = escapeEmailHtml(data.businessName);
  const today = data.today ?? new Date().toISOString().slice(0, 10);
  const isLate = (line: StatementEmailLine) => Boolean(line.dueDate && line.dueDate.slice(0, 10) < today);
  const lateCount = data.lines.filter(isLate).length;
  const header = data.logoUrl
    ? '<img src="' + escapeEmailHtml(data.logoUrl) + '" alt="' + business + '" height="64" style="display:block;margin:0 auto;max-height:64px;max-width:240px;border-radius:8px;" />'
    : '<p style="margin:0;font-size:22px;font-weight:bold;color:' + color + ';">' + business + '</p>';
  const rows = data.lines
    .map((line) => {
      const late = isLate(line);
      const due = line.dueDate ? escapeEmailHtml(statementDate(line.dueDate)) + (late ? ' · Late' : '') : '—';
      const url = line.viewUrl ? escapeEmailHtml(line.viewUrl) : '';
      const number = url
        ? '<a href="' + url + '" style="color:' + color + ';font-weight:bold;text-decoration:none;">#' + escapeEmailHtml(line.invoiceNumber) + '</a>'
        : '#' + escapeEmailHtml(line.invoiceNumber);
      const pay = url
        ? '<a href="' + url + '" style="display:inline-block;padding:6px 14px;background-color:' + color + ';color:#ffffff;font-size:13px;font-weight:bold;text-decoration:none;border-radius:6px;">Pay</a>'
        : '';
      return [
        '<tr>',
        '<td style="padding:12px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">' + number + '</td>',
        '<td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;color:' + (late ? '#dc2626' : '#374151') + ';">' + due + '</td>',
        '<td align="right" style="padding:12px 8px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:bold;color:#111827;white-space:nowrap;">' + emailMoney(line.balanceCents) + '</td>',
        '<td align="right" style="padding:12px 0;border-bottom:1px solid #e5e7eb;">' + pay + '</td>',
        '</tr>',
      ].join('');
    })
    .join('\n');
  const address = data.businessAddress?.trim()
    ? '<p style="margin:4px 0 0 0;font-size:14px;line-height:1.5;color:#111827;white-space:pre-line;">' + escapeEmailHtml(data.businessAddress.trim()) + '</p>'
    : '';
  const website = data.businessWebsite?.trim() || '';
  const websiteHref = website && !/^https?:\/\//i.test(website) ? 'https://' + website : website;
  const contacts = [
    data.businessEmail?.trim() ? '<a href="mailto:' + escapeEmailHtml(data.businessEmail.trim()) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(data.businessEmail.trim()) + '</a>' : '',
    data.businessPhone?.trim() ? '<a href="tel:' + escapeEmailHtml(data.businessPhone.replace(/[^\d+]/g, '')) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(data.businessPhone.trim()) + '</a>' : '',
    website ? '<a href="' + escapeEmailHtml(websiteHref) + '" style="color:' + color + ';text-decoration:none;">' + escapeEmailHtml(website) + '</a>' : '',
  ].filter(Boolean);
  const footer = data.footerText?.trim()
    ? '<p style="margin:16px 0 0 0;font-size:12px;line-height:1.5;color:#6b7280;white-space:pre-line;">' + escapeEmailHtml(data.footerText.trim()) + '</p>'
    : '';
  const count = data.lines.length;
  const th = 'font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#374151;border-bottom:2px solid #111827;';
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:24px 0;font-family:Arial,Helvetica,sans-serif;background-color:#f3f4f6;">',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">',
    '<tr><td align="center" style="padding:24px 24px 20px 24px;">' + header + '</td></tr>',
    '<tr><td align="center" style="background-color:' + tint + ';padding:28px 24px;">',
    '<p style="margin:0 0 6px 0;font-size:22px;font-weight:bold;color:#111827;">Your statement</p>',
    '<p style="margin:0;font-size:14px;color:#111827;">' + escapeEmailHtml(data.customerName) + ' · ' + count + ' open invoice' + (count === 1 ? '' : 's') + (lateCount ? ' · ' + lateCount + ' late' : '') + '</p>',
    '<p style="margin:24px 0 4px 0;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#374151;">Total due</p>',
    '<p style="margin:0;font-size:34px;color:' + (lateCount ? '#dc2626' : '#111827') + ';">' + emailMoney(data.totalCents) + '</p>',
    '</td></tr>',
    '<tr><td style="padding:24px 24px 8px 24px;">',
    '<table width="100%" cellpadding="0" cellspacing="0">',
    '<tr>',
    '<th align="left" style="padding:0 0 8px 0;' + th + '">Invoice</th>',
    '<th align="left" style="padding:0 8px 8px 8px;' + th + '">Due</th>',
    '<th align="right" style="padding:0 8px 8px 8px;' + th + '">Balance</th>',
    '<th style="padding:0 0 8px 0;border-bottom:2px solid #111827;"></th>',
    '</tr>',
    rows,
    '<tr>',
    '<td colspan="2" style="padding:14px 0 0 0;font-size:15px;font-weight:bold;color:#111827;">Total due</td>',
    '<td align="right" style="padding:14px 8px 0 8px;font-size:15px;font-weight:bold;color:#111827;white-space:nowrap;">' + emailMoney(data.totalCents) + '</td>',
    '<td></td>',
    '</tr>',
    '</table>',
    '<p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#374151;">Tap Pay next to an invoice to open it and pay by card. Already paid? Thank you, and please disregard it.</p>',
    '</td></tr>',
    '<tr><td align="center" style="padding:24px 24px 28px 24px;">',
    '<table cellpadding="0" cellspacing="0" style="margin:0 auto 16px auto;"><tr><td style="width:160px;border-top:1px solid #d1d5db;font-size:0;line-height:0;">&nbsp;</td></tr></table>',
    '<p style="margin:0;font-size:14px;font-weight:bold;color:#111827;">' + business + '</p>',
    address,
    contacts.length ? '<p style="margin:14px 0 0 0;font-size:14px;line-height:1.6;">' + contacts.join('<br>') + '</p>' : '',
    footer,
    '</td></tr></table>',
    '<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">',
    '<tr><td align="center" style="padding:16px 24px;font-size:11px;line-height:1.5;color:#6b7280;">',
    'If an email about a payment looks wrong, check with ' + business + ' before paying.',
    '<p style="margin:12px 0 0 0;color:#9ca3af;">Sent with House Pros Hub</p>',
    '</td></tr></table>',
    '</body></html>',
  ].join('\n');
}

export interface EstimateReviewEmailData {
  businessName: string;
  estimateNumber: string;
  amountCents: number;
  validUntilDate?: string | null;
  reviewUrl: string;
  message?: string;
  /** The pro's logo, color and contact details (same as their invoice emails). */
  brand?: EmailBrand | null;
}

/**
 * Generate HTML for "Review and approve estimate" email (customer).
 */
export function generateEstimateReviewEmail(data: EstimateReviewEmailData): string {
  const validUntil = data.validUntilDate
    ? new Date(data.validUntilDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    : null;
  return brandedEmail({
    brand: data.brand ?? { businessName: data.businessName },
    heading: 'Your estimate is ready!',
    subheading: 'Estimate #' + data.estimateNumber + (validUntil ? ' · Valid until ' + validUntil : ''),
    highlight: { label: 'Estimate total', value: emailMoneyText(data.amountCents) },
    paragraphs: [data.message],
    button: { label: 'Review and approve', url: data.reviewUrl },
    finePrint: 'Questions about this estimate? Reply to this email to reach ' + data.businessName + '.',
    preheader: 'Estimate #' + data.estimateNumber + ' from ' + data.businessName + ': ' + emailMoneyText(data.amountCents),
  });
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface EstimateApprovedEmailCommon {
  businessName: string;
  estimateNumber: string;
  amountCents: number;
  customerName: string;
  /** The pro's brand, for the customer's copy. */
  brand?: EmailBrand | null;
  /** Link for the pro to open the estimate in ProsCRM. */
  crmUrl?: string | null;
}

/**
 * Customer confirmation after they approve an estimate online.
 */
export function generateEstimateApprovedCustomerEmail(data: EstimateApprovedEmailCommon): string {
  return brandedEmail({
    brand: data.brand ?? { businessName: data.businessName },
    heading: 'Estimate approved. Thank you!',
    subheading: 'Estimate #' + data.estimateNumber,
    highlight: { label: 'Approved total', value: emailMoneyText(data.amountCents), color: '#15803d' },
    paragraphs: [
      'Hi ' + data.customerName + ',',
      'Your approval is confirmed. ' + data.businessName + ' has been notified and will be in touch about the next steps and scheduling.',
    ],
    finePrint: 'Keep this email for your records.',
  });
}

/**
 * Contractor / business owner: customer approved the estimate.
 */
export function generateEstimateApprovedContractorEmail(data: EstimateApprovedEmailCommon): string {
  return brandedEmail({
    brand: hubEmailBrand(),
    heading: 'Estimate approved',
    subheading: data.customerName + ' approved estimate #' + data.estimateNumber,
    highlight: { label: 'Approved total', value: emailMoneyText(data.amountCents), color: '#15803d' },
    paragraphs: ['Next steps: turn it into a project to schedule the work, or into an invoice to bill a deposit.'],
    details: [
      { label: 'Customer', value: data.customerName },
      { label: 'Estimate', value: '#' + data.estimateNumber },
      { label: 'Business', value: data.businessName },
    ],
    button: data.crmUrl ? { label: 'Open in ProsCRM', url: data.crmUrl } : null,
  });
}

export interface EstimateApprovedAdminEmailData extends EstimateApprovedEmailCommon {
  customerEmail: string;
}

/**
 * Platform admin notification when an estimate is accepted online.
 */
export function generateEstimateApprovedAdminEmail(data: EstimateApprovedAdminEmailData): string {
  return brandedEmail({
    brand: hubEmailBrand(),
    heading: 'Estimate accepted',
    subheading: 'Estimate #' + data.estimateNumber + ' · ' + data.businessName,
    highlight: { label: 'Amount', value: emailMoneyText(data.amountCents) },
    details: [
      { label: 'Customer', value: data.customerName },
      { label: 'Customer email', value: data.customerEmail },
      { label: 'Business', value: data.businessName },
    ],
  });
}

