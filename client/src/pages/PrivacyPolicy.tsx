import DashboardLayout from "../components/DashboardLayout";
import { Footer } from "../components/Footer";

export default function PrivacyPolicy() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            <strong>Last Updated:</strong> February 16, 2026
          </p>

          <p>
            At STS Futures, we take your privacy seriously. This Privacy Policy
            explains how we collect, use, disclose, and safeguard your
            information when you use our Service.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              1. Information We Collect
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              Personal Information
            </h3>
            <p>
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Account Information:</strong> Name, email address,
                password
              </li>
              <li>
                <strong>Payment Information:</strong> Credit card details,
                billing address (processed securely through Stripe)
              </li>
              <li>
                <strong>Profile Information:</strong> Trading preferences,
                account size, risk tolerance settings
              </li>
              <li>
                <strong>Communications:</strong> Messages you send to our
                support team
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              Automatically Collected Information
            </h3>
            <p>
              When you access our Service, we automatically collect certain
              information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Log Data:</strong> IP address, browser type, operating
                system, pages visited, time spent on pages
              </li>
              <li>
                <strong>Device Information:</strong> Device type, unique device
                identifiers
              </li>
              <li>
                <strong>Usage Data:</strong> Features used, strategies viewed,
                interactions with the Service
              </li>
              <li>
                <strong>Cookies and Similar Technologies:</strong> We use
                cookies to maintain your session and remember your preferences
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. How We Use Your Information
            </h2>
            <p>We use the information we collect to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide, maintain, and improve our Service</li>
              <li>
                Process your transactions and send you related information
              </li>
              <li>
                Send you technical notices, updates, security alerts, and
                support messages
              </li>
              <li>
                Respond to your comments, questions, and customer service
                requests
              </li>
              <li>
                Communicate with you about products, services, offers, and
                events
              </li>
              <li>
                Monitor and analyze trends, usage, and activities in connection
                with our Service
              </li>
              <li>
                Detect, prevent, and address technical issues and fraudulent
                activity
              </li>
              <li>
                Personalize your experience and deliver content relevant to your
                interests
              </li>
              <li>
                Comply with legal obligations and enforce our Terms of Service
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. How We Share Your Information
            </h2>
            <p>
              We do not sell your personal information. We may share your
              information in the following circumstances:
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              Service Providers
            </h3>
            <p>
              We share information with third-party service providers who
              perform services on our behalf, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Payment Processing:</strong> Stripe (for secure payment
                processing)
              </li>
              <li>
                <strong>Analytics:</strong> Google Analytics, Plausible
                Analytics (for usage analytics)
              </li>
              <li>
                <strong>Email Services:</strong> Resend (for transactional
                emails)
              </li>
              <li>
                <strong>Hosting:</strong> Cloud infrastructure providers
              </li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              Legal Requirements
            </h3>
            <p>
              We may disclose your information if required to do so by law or in
              response to valid requests by public authorities (e.g., a court or
              government agency).
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              Business Transfers
            </h3>
            <p>
              If we are involved in a merger, acquisition, or sale of assets,
              your information may be transferred as part of that transaction.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              With Your Consent
            </h3>
            <p>
              We may share your information with your consent or at your
              direction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Data Security
            </h2>
            <p>
              We implement appropriate technical and organizational measures to
              protect your personal information against unauthorized access,
              alteration, disclosure, or destruction. These measures include:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of data in transit using SSL/TLS</li>
              <li>Encryption of sensitive data at rest</li>
              <li>Regular security assessments and updates</li>
              <li>Access controls and authentication mechanisms</li>
              <li>Secure password hashing (bcrypt)</li>
              <li>Regular backups and disaster recovery procedures</li>
            </ul>
            <p className="mt-4">
              However, no method of transmission over the Internet or electronic
              storage is 100% secure. While we strive to protect your personal
              information, we cannot guarantee its absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Data Retention
            </h2>
            <p>
              We retain your personal information for as long as necessary to
              fulfill the purposes outlined in this Privacy Policy, unless a
              longer retention period is required or permitted by law.
            </p>
            <p>
              When you cancel your account, we will delete or anonymize your
              personal information within 90 days, except where we are required
              to retain it for legal, regulatory, or legitimate business
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Your Rights and Choices
            </h2>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              Account Information
            </h3>
            <p>
              You may update, correct, or delete your account information at any
              time by logging into your account settings or contacting us.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              Communications Preferences
            </h3>
            <p>
              You may opt out of receiving promotional emails by following the
              unsubscribe instructions in those emails. You cannot opt out of
              transactional emails related to your account or subscription.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">Cookies</h3>
            <p>
              Most web browsers are set to accept cookies by default. You can
              usually choose to set your browser to remove or reject cookies.
              Please note that if you choose to remove or reject cookies, this
              could affect the availability and functionality of our Service.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">Do Not Track</h3>
            <p>
              Some browsers include a "Do Not Track" feature. Our Service does
              not currently respond to Do Not Track signals.
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              Your Legal Rights (GDPR, CCPA)
            </h3>
            <p>
              Depending on your location, you may have certain rights regarding
              your personal information, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Access:</strong> Request a copy of your personal
                information
              </li>
              <li>
                <strong>Correction:</strong> Request correction of inaccurate
                information
              </li>
              <li>
                <strong>Deletion:</strong> Request deletion of your personal
                information
              </li>
              <li>
                <strong>Portability:</strong> Request transfer of your
                information to another service
              </li>
              <li>
                <strong>Objection:</strong> Object to processing of your
                information
              </li>
              <li>
                <strong>Restriction:</strong> Request restriction of processing
              </li>
            </ul>
            <p className="mt-4">
              To exercise these rights, please contact us at
              privacy@stsfutures.com. We will respond to your request within 30
              days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. International Data Transfers
            </h2>
            <p>
              Your information may be transferred to and maintained on computers
              located outside of your state, province, country, or other
              governmental jurisdiction where data protection laws may differ.
            </p>
            <p>
              If you are located outside the United States and choose to provide
              information to us, please note that we transfer the information to
              the United States and process it there.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Children's Privacy
            </h2>
            <p>
              Our Service is not intended for individuals under the age of 18.
              We do not knowingly collect personal information from children
              under 18. If you are a parent or guardian and believe your child
              has provided us with personal information, please contact us, and
              we will delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Third-Party Links
            </h2>
            <p>
              Our Service may contain links to third-party websites or services
              that are not owned or controlled by STS Futures. We are not
              responsible for the privacy practices of these third parties. We
              encourage you to review their privacy policies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Changes to This Privacy Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the new Privacy
              Policy on this page and updating the "Last Updated" date.
            </p>
            <p>
              We encourage you to review this Privacy Policy periodically for
              any changes. Your continued use of the Service after we post
              modifications constitutes your acceptance of the updated Privacy
              Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">11. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our privacy
              practices, please contact us at:
            </p>
            <p className="mt-4">
              <strong>STS Futures</strong>
              <br />
              Email: privacy@stsfutures.com
              <br />
              Support: support@stsfutures.com
            </p>
          </section>

          <div className="mt-12 p-6 bg-muted/20 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              Your privacy is important to us. We are committed to protecting
              your personal information and being transparent about how we
              collect, use, and share it. If you have any concerns about your
              privacy, please don't hesitate to contact us.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </DashboardLayout>
  );
}
