export const metadata = {
  title: 'Cookie Policy | House Pros Hub',
  description: 'Cookie Policy for House Pros Hub marketplace platform',
};

export default function CookiePolicyPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 md:py-12">
      <div className="bg-white p-6 md:p-8">
          <h1 className="text-3xl md:text-4xl font-bold text-black mb-2">Cookie Policy</h1>
          <p className="text-sm text-gray-600 mb-8">Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <div className="prose prose-sm max-w-none text-gray-800 space-y-6">
            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">1. What Are Cookies?</h2>
              <p>
                Cookies are small text files that are placed on your device when you visit a website. They are widely used to make websites work more efficiently and to provide information to website owners.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">2. How We Use Cookies</h2>
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

              <h3 className="text-xl font-semibold text-black mt-4 mb-2">2.2 Analytics Cookies</h3>
              <p>
                These cookies help us understand how visitors interact with the Platform by collecting and reporting information anonymously. This helps us improve the Platform's functionality and user experience.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Page views and navigation patterns</li>
                <li>Time spent on pages</li>
                <li>Error messages and performance issues</li>
              </ul>

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
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">3. Types of Cookies We Use</h2>
              
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
                We may use third-party services that set cookies on your device. These cookies are subject to the privacy policies of the third-party providers. We use third-party cookies for:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Analytics and performance monitoring</li>
                <li>Security and fraud prevention</li>
                <li>Content delivery networks</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">4. Managing Cookies</h2>
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
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">5. Other Tracking Technologies</h2>
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
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">6. Updates to This Cookie Policy</h2>
              <p>
                We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated Cookie Policy on the Platform and updating the "Last Updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold text-black mt-8 mb-4">7. Contact Us</h2>
              <p>
                If you have any questions about our use of cookies, please contact us at:
              </p>
              <p className="mt-2">
                <strong>Email:</strong> privacy@houseproshub.com<br />
                <strong>Address:</strong> [Your Business Address]
              </p>
            </section>
          </div>
        </div>
    </div>
  );
}

