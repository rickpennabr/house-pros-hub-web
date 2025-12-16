export const metadata = {
  title: 'Terms of Service | House Pros Hub',
  description: 'Terms of Service for House Pros Hub marketplace platform',
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="bg-white p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div className="prose prose-sm max-w-none text-gray-800 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">1. Agreement to Terms</h2>
              <p>
                By accessing or using House Pros Hub ("Platform", "we", "us", or "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not access or use the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">2. Platform Description</h2>
              <p>
                House Pros Hub is a marketplace platform that connects customers seeking home improvement and repair services with independent contractors and service providers. We provide a platform for users to discover, connect, and communicate with service providers. We do not provide the services ourselves, nor are we a party to any agreements between customers and contractors.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">3. User Accounts</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">3.1 Account Registration</h3>
              <p>
                To use certain features of the Platform, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">3.2 Account Security</h3>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">3.3 Account Eligibility</h3>
              <p>
                You must be at least 18 years old to create an account. By creating an account, you represent and warrant that you are at least 18 years old and have the legal capacity to enter into these Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">4. User Responsibilities</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">4.1 Prohibited Activities</h3>
              <p>You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Use the Platform for any illegal purpose or in violation of any laws</li>
                <li>Post false, misleading, or fraudulent information</li>
                <li>Impersonate any person or entity</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Interfere with or disrupt the Platform or servers</li>
                <li>Attempt to gain unauthorized access to any portion of the Platform</li>
                <li>Use automated systems to access the Platform without permission</li>
                <li>Collect or harvest information about other users without their consent</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">5. Contractor Responsibilities</h2>
              <p>If you are a contractor or service provider using the Platform, you agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintain all required licenses, permits, and insurance as required by law</li>
                <li>Provide accurate information about your business, services, and qualifications</li>
                <li>Comply with all applicable local, state, and federal laws and regulations</li>
                <li>Perform services in a professional and workmanlike manner</li>
                <li>Honor all commitments made to customers</li>
                <li>Maintain appropriate insurance coverage for your business operations</li>
                <li>Handle all tax obligations related to your business independently</li>
              </ul>
              <p className="mt-4">
                <strong>Independent Contractor Status:</strong> You acknowledge that you are an independent contractor and not an employee, agent, or partner of House Pros Hub. You are solely responsible for your own taxes, insurance, and compliance with all applicable laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">6. Customer Responsibilities</h2>
              <p>If you are a customer using the Platform, you agree to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Conduct your own due diligence when selecting a contractor</li>
                <li>Verify contractor licenses, insurance, and qualifications independently</li>
                <li>Enter into direct agreements with contractors for services</li>
                <li>Make payments directly to contractors according to your agreement</li>
                <li>Communicate clearly about project requirements and expectations</li>
                <li>Treat contractors with respect and professionalism</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">7. Payments</h2>
              <p>
                House Pros Hub does not process payments between customers and contractors. All payments are made directly between customers and contractors. We are not responsible for any payment disputes, refunds, or financial transactions between users. You are solely responsible for all payment arrangements and agreements with other users.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">8. Platform Liability Limitations</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">8.1 No Warranty</h3>
              <p>
                THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">8.2 No Responsibility for Services</h3>
              <p>
                We are not responsible for the quality, safety, legality, or any other aspect of services provided by contractors. We do not endorse, guarantee, or warrant any contractor or their services. You use the Platform and engage with contractors at your own risk.
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">8.3 Not a Party to Agreements</h3>
              <p>
                We are not a party to any agreements or transactions between customers and contractors. Any disputes between users must be resolved directly between the parties involved.
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">8.4 User-Generated Content</h3>
              <p>
                We are not responsible for user-generated content posted on the Platform. Under Section 230 of the Communications Decency Act, we are not liable for content posted by users.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">9. Limitation of Liability</h2>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, HOUSE PROS HUB SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE PLATFORM.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">10. Indemnification</h2>
              <p>
                You agree to indemnify, defend, and hold harmless House Pros Hub, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including attorneys' fees) arising out of or relating to your use of the Platform, your violation of these Terms, or your violation of any rights of another party.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">11. Intellectual Property</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">11.1 Platform Content</h3>
              <p>
                All content on the Platform, including text, graphics, logos, and software, is the property of House Pros Hub or its licensors and is protected by copyright, trademark, and other intellectual property laws.
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">11.2 User Content</h3>
              <p>
                You retain ownership of any content you post on the Platform. By posting content, you grant us a non-exclusive, worldwide, royalty-free license to use, reproduce, modify, and display such content on the Platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">12. Dispute Resolution</h2>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">12.1 Platform Disputes</h3>
              <p>
                If you have a dispute with another user, you should attempt to resolve it directly with that user. We may, but are not obligated to, facilitate communication between users.
              </p>
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">12.2 Disputes with House Pros Hub</h3>
              <p>
                Any disputes arising out of or relating to these Terms or the Platform shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association, except where prohibited by law. You waive any right to a jury trial and agree to resolve disputes on an individual basis.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">13. Termination</h2>
              <p>
                We reserve the right to suspend or terminate your account and access to the Platform at any time, with or without cause or notice, for any reason, including if you violate these Terms. You may terminate your account at any time by contacting us.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">14. Modifications to Terms</h2>
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of material changes by posting the updated Terms on the Platform and updating the "Last Updated" date. Your continued use of the Platform after such modifications constitutes your acceptance of the updated Terms.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">15. Governing Law</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the state in which House Pros Hub operates, without regard to its conflict of law provisions.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">16. Contact Information</h2>
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> legal@houseproshub.com<br />
                <strong>Address:</strong> [Your Business Address]
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">17. Severability</h2>
              <p>
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">18. Entire Agreement</h2>
              <p>
                These Terms constitute the entire agreement between you and House Pros Hub regarding the use of the Platform and supersede all prior agreements and understandings.
              </p>
            </section>
          </div>
        </div>
    </div>
  );
}

