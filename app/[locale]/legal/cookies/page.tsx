import { COMPANY_INFO } from '@/lib/constants/company';

export const metadata = {
  title: 'Cookie Policy | House Pros Hub',
  description: 'Cookie Policy for House Pros Hub marketplace platform',
};

export default function CookiePolicyPage() {
  return (
    <div className="max-w-4xl mx-auto pb-8 md:pb-12">
      <div className="bg-white pb-6 md:pb-8">
          <div className="prose prose-sm max-w-none text-gray-800 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-black mb-4">1. What Are Cookies?</h2>
              <p>
                Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently and to provide information to website owners.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">2. How We Use Cookies</h2>
              <p>We use cookies and similar tracking technologies for the following purposes:</p>
              
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">2.1 Essential Cookies</h3>
              <p>
                These cookies are necessary for the Platform to function properly. They enable core functionality such as security, network management, and accessibility. You cannot opt-out of these cookies.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Authentication:</strong> To keep you logged in and maintain your session</li>
                <li><strong>Security:</strong> To protect against fraud and unauthorized access</li>
                <li><strong>Preferences:</strong> To remember your settings and preferences</li>
              </ul>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">2.2 Performance Monitoring</h3>
              <p>
                We use performance monitoring tools to help us identify and fix technical issues, improve platform stability, and enhance user experience. This includes:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Error Tracking:</strong> We use Sentry to monitor and track errors and performance issues to improve platform reliability</li>
                <li><strong>Performance Monitoring:</strong> We collect anonymous performance metrics to identify and resolve technical problems</li>
              </ul>
              <p className="mt-2">
                <em>Note: We do not currently use analytics cookies for tracking page views or user behavior patterns. If we add analytics cookies in the future, we will update this policy and provide opt-out options where required by law.</em>
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">2.3 Functionality Cookies</h3>
              <p>
                These cookies allow the Platform to remember choices you make and provide enhanced, personalized features.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Language preferences</li>
                <li>Theme settings</li>
                <li>Location preferences</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">3. Types of Cookies We Use</h2>
              
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">3.1 Session Cookies</h3>
              <p>
                These cookies are temporary and are deleted when you close your browser. They are used to maintain your session while you navigate the Platform.
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">3.2 Persistent Cookies</h3>
              <p>
                These cookies remain on your device for a set period or until you delete them. They are used to remember your preferences and improve your experience on future visits.
              </p>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">3.3 Third-Party Cookies</h3>
              <p>
                We use third-party services that may set cookies on your device. These cookies are subject to the privacy policies of the third-party providers. We use third-party services for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Performance Monitoring:</strong> Sentry (error tracking and performance monitoring) - <a href="https://sentry.io/privacy/" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">Sentry Privacy Policy</a></li>
                <li><strong>Authentication:</strong> Supabase (authentication and database services) - <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">Supabase Privacy Policy</a></li>
                <li><strong>Hosting and Content Delivery:</strong> Our hosting and content delivery network providers may set cookies for security and performance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">4. Managing Cookies</h2>
              <p>
                You have the right to accept or reject cookies. Most web browsers automatically accept cookies, but you can modify your browser settings to decline cookies if you prefer.
              </p>
              
              <h3 className="text-xl font-semibold text-black mt-4 mb-2">4.1 Browser Settings</h3>
              <p>You can control cookies through your browser settings. Here are links to instructions for popular browsers:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">Google Chrome</a></li>
                <li><a href="https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">Mozilla Firefox</a></li>
                <li><a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">Safari</a></li>
                <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">Microsoft Edge</a></li>
              </ul>

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">4.2 Impact of Disabling Cookies</h3>
              <p>
                Please note that disabling cookies may affect the functionality of the Platform. Some features may not work properly if cookies are disabled.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">5. Other Tracking Technologies</h2>
              <p>
                In addition to cookies, we may use other tracking technologies such as:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Web Beacons:</strong> Small graphic images used to track user engagement</li>
                <li><strong>Local Storage:</strong> Data stored locally in your browser</li>
                <li><strong>Session Storage:</strong> Temporary data stored for the duration of your session</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">6. Updates to This Cookie Policy</h2>
              <p>
                We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated Cookie Policy on the Platform and updating the &quot;Last Updated&quot; date.
              </p>
              <p className="mt-2 text-sm text-gray-600">
                <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mb-4">7. Contact Us</h2>
              <p>
                If you have any questions about our use of cookies, please contact us at:
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

