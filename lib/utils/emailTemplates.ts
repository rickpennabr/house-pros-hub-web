import { EstimateSchema } from '@/lib/schemas/estimate';

export interface EmailTranslations {
  subject: string;
  subjectAdmin: string;
  greeting: string;
  thankYou: string;
  thankYouAdmin: string;
  copyBelow: string;
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
  userType: 'customer' | 'contractor' | 'both';
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
    other: 'Other',
  };
  const projectTypeDisplay = estimate.projectType === 'other' && estimate.projectTypeOther
    ? `${projectTypeMap[estimate.projectType] || estimate.projectType}: ${estimate.projectTypeOther}`
    : projectTypeMap[estimate.projectType] || estimate.projectType;

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
  const budgetDisplay = budgetMap[estimate.budgetRange] || estimate.budgetRange;

  // Format timeline
  const timelineMap: Record<string, string> = {
    asap: 'ASAP',
    within_month: 'Within a month',
    '1_3_months': '1-3 months',
    '3_6_months': '3-6 months',
    '6_plus_months': '6+ months',
    flexible: 'Flexible',
  };
  const timelineDisplay = timelineMap[estimate.timeline] || estimate.timeline;

  // Format contact method
  const contactMap: Record<string, string> = {
    phone: 'Phone',
    email: 'Email',
    text: 'Text',
    either: 'Either',
  };
  const contactDisplay = contactMap[estimate.preferredContactMethod] || estimate.preferredContactMethod;

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
        <p style="margin: 0; color: #333;">${estimate.userId || translations.admin.anonymous}</p>
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
              <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #000000;">House Pros Hub</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${translations.greeting},</p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #333;">${thankYou}</p>
              ${!isAdmin ? `<p style="margin: 0 0 30px 0; font-size: 16px; color: #333;">${translations.copyBelow}</p>` : ''}
              
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
              <h1 style="margin: 0; font-size: 24px; font-weight: bold; color: #000000;">House Pros Hub</h1>
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
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px; background-color: #f9fafb; border-top: 2px solid #000000; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">${translations.footer.companyName}</p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #666;">${translations.footer.contactInfo}</p>
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

