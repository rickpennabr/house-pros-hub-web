import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { COMPANY_INFO } from '@/lib/constants/company';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.privacy' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.privacy.sections' });
  return (
    <div className="max-w-4xl mx-auto pb-8 md:pb-12">
      <div className="bg-white pb-6 md:pb-8">
          <div className="prose prose-sm max-w-none text-gray-800 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-black mb-4">{t('introduction.title')}</h2>
              <p>
                {t('introduction.content1')}
              </p>
              <p className="mt-4">
                {t('introduction.content2')}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">2.1 Information You Provide</h3>
              <p>We collect information that you provide directly to us, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Information:</strong> Name, email address, phone number, password</li>
                <li><strong>Profile Information:</strong> Business name, contractor type, business description, licenses, certifications</li>
                <li><strong>Location Information:</strong> Street address, city, state, zip code, apartment number, gate codes, address notes</li>
                <li><strong>Contact Information:</strong> Phone numbers (mobile, location, business), email addresses, website URLs, social media links</li>
                <li><strong>Communication:</strong> Messages, reviews, feedback, and other content you post on the Platform</li>
                <li><strong>Payment Information:</strong> While we do not process payments, we may collect billing information if you use certain features</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">2.2 Automatically Collected Information</h3>
              <p>When you use our Platform, we automatically collect certain information, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
                <li><strong>Usage Information:</strong> Pages visited, time spent on pages, links clicked, search queries</li>
                <li><strong>Location Data:</strong> General location information based on IP address or device settings</li>
                <li><strong>Cookies and Tracking Technologies:</strong> See our Cookie Policy for more information</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">2.3 Information from Third Parties</h3>
              <p>
                We may receive information about you from third parties, such as social media platforms if you choose to connect your account, or from service providers that help us verify information.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">3. How We Use Your Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Create and manage your account</li>
                <li>Match customers with contractors based on location, services, and preferences</li>
                <li>Display your business profile to potential customers (for contractors)</li>
                <li>Facilitate communication between users</li>
                <li>Send you service-related communications, updates, and notifications</li>
                <li>Improve and optimize the Platform</li>
                <li>Analyze usage patterns and trends</li>
                <li>Detect, prevent, and address fraud, security issues, and abuse</li>
                <li>Comply with legal obligations</li>
                <li>Respond to your inquiries and provide customer support</li>
                <li>Send you marketing communications (with your consent, where required)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">4. How We Share Your Information</h2>
              
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">4.1 With Other Users</h3>
              <p>We share certain information to facilitate connections:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>For Contractors:</strong> Your business profile, including business name, contractor type, description, location, contact information, and links are visible to customers</li>
                <li><strong>For Customers:</strong> Your contact information may be shared with contractors you contact or engage with</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">4.2 With Service Providers</h3>
              <p>
                We may share your information with third-party service providers who perform services on our behalf, such as hosting, analytics, customer support, email delivery, and payment processing.
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">4.3 For Legal Reasons</h3>
              <p>We may disclose your information if required by law or in response to valid legal requests, such as:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Compliance with court orders, subpoenas, or other legal processes</li>
                <li>Protection of our rights, property, or safety</li>
                <li>Protection of the rights, property, or safety of our users or others</li>
                <li>Enforcement of our Terms of Service</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">4.4 Business Transfers</h3>
              <p>
                If we are involved in a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">4.5 With Your Consent</h3>
              <p>
                We may share your information with third parties when you have given us your explicit consent to do so.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">5. Data Security</h2>
              <p>
                We implement appropriate technical and organizational security measures to protect your information against unauthorized access, alteration, disclosure, or destruction. These measures include:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security assessments and updates</li>
                <li>Limited access to personal information on a need-to-know basis</li>
              </ul>
              <p className="mt-4">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">6. Your Rights and Choices</h2>
              
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">6.1 Access and Correction</h3>
              <p>
                You can access and update your account information at any time by logging into your account settings.
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">6.2 Deletion</h3>
              <p>
                You can request deletion of your account and personal information by contacting us. We will delete your information subject to our legal obligations to retain certain data.
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">6.3 Opt-Out of Marketing</h3>
              <p>
                You can opt-out of receiving marketing communications from us by contacting us directly at {COMPANY_INFO.email.privacy}. Please note that we may still send you transactional and service-related communications (such as account updates, estimate confirmations, and important service notifications) that are necessary for the Platform to function.
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">6.4 Cookies</h3>
              <p>
                You can control cookies through your browser settings. See our Cookie Policy for more information.
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">6.5 Do Not Track</h3>
              <p>
                Our Platform does not currently respond to &quot;Do Not Track&quot; signals from browsers. We may update this policy if a standard is established.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">7. Cookies and Tracking Technologies</h2>
              <p>
                We use cookies and similar tracking technologies to collect and store information about your use of the Platform. Cookies are small data files stored on your device. We use cookies for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Authentication and session management</li>
                <li>Remembering your preferences</li>
                <li>Analyzing usage patterns</li>
                <li>Improving the Platform</li>
              </ul>
              <p className="mt-4">
                For more detailed information about our use of cookies, please see our <Link href={`/${locale}/legal/cookies`} className="underline hover:text-black">Cookie Policy</Link>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">8. Children&apos;s Privacy</h2>
              <p>
                Our Platform is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">9. Data Retention</h2>
              <p>
                We retain your personal information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">10. International Users</h2>
              <p>
                Our Platform is operated in the United States. If you are accessing the Platform from outside the United States, please be aware that your information may be transferred to, stored, and processed in the United States. By using the Platform, you consent to the transfer of your information to the United States.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">11. California Privacy Rights</h2>
              <p>
                If you are a California resident, you have certain rights under the California Consumer Privacy Act (CCPA), including:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>The right to know what personal information we collect, use, and disclose</li>
                <li>The right to delete your personal information</li>
                <li>The right to opt-out of the sale of personal information (we do not sell personal information)</li>
                <li>The right to non-discrimination for exercising your privacy rights</li>
              </ul>
              <p className="mt-4">
                To exercise these rights, please contact us using the information provided in the Contact section.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">12. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated Privacy Policy on the Platform and updating the &quot;Last Updated&quot; date. Your continued use of the Platform after such changes constitutes your acceptance of the updated Privacy Policy.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">13. Contact Us</h2>
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> {COMPANY_INFO.email.privacy}<br />
                <strong>Address:</strong> {COMPANY_INFO.address}
              </p>
            </section>
          </div>
        </div>
    </div>
  );
}

