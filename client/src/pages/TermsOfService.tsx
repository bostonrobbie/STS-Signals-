import DashboardLayout from "../components/DashboardLayout";
import { Footer } from "../components/Footer";

export default function TermsOfService() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            <strong>Last Updated:</strong> February 16, 2026
          </p>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using STS Futures ("the Service"), you accept and
              agree to be bound by the terms and provision of this agreement. If
              you do not agree to these Terms of Service, please do not use the
              Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Description of Service
            </h2>
            <p>
              STS Futures provides systematic trading strategy signals,
              historical performance data, and analytical tools for futures
              markets. The Service includes real-time TradingView signals,
              backtested strategy performance, risk analytics, and position
              sizing calculators.
            </p>
            <p>
              <strong>Important:</strong> The Service provides educational
              information and trading signals only. It does not provide
              investment advice, financial planning, tax advice, or legal
              advice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Risk Disclosure
            </h2>
            <p>
              <strong>
                TRADING FUTURES INVOLVES SUBSTANTIAL RISK OF LOSS AND IS NOT
                SUITABLE FOR ALL INVESTORS.
              </strong>
            </p>
            <p>You acknowledge and agree that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Past performance is not indicative of future results</li>
              <li>
                All trading involves risk, and you may lose more than your
                initial investment
              </li>
              <li>
                Hypothetical or simulated performance results have inherent
                limitations
              </li>
              <li>
                No representation is being made that any account will or is
                likely to achieve profits or losses similar to those shown
              </li>
              <li>
                You are solely responsible for your trading decisions and their
                consequences
              </li>
              <li>
                You should only trade with risk capital you can afford to lose
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. User Accounts
            </h2>
            <p>
              To access certain features of the Service, you must create an
              account. You agree to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Provide accurate, current, and complete information during
                registration
              </li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>
                Notify us immediately of any unauthorized use of your account
              </li>
              <li>
                Accept responsibility for all activities that occur under your
                account
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. Subscription and Billing
            </h2>
            <p>
              <strong>Subscription Plans:</strong> The Service offers a monthly
              subscription plan at $50 per month. Pricing is displayed on our
              website and may be changed with 30 days notice.
            </p>
            <p>
              <strong>Billing:</strong> Subscriptions are billed in advance on a
              recurring basis. You authorize us to charge your payment method
              for all fees incurred.
            </p>
            <p>
              <strong>Cancellation:</strong> You may cancel your subscription at
              any time. Cancellations take effect at the end of the current
              billing period. No refunds are provided for partial periods.
            </p>
            <p>
              <strong>No Refunds:</strong> All subscription purchases are final
              and non-refundable. By subscribing, you acknowledge and agree that
              no refunds will be issued for any reason. Please refer to our
              Cancellation Policy for details on how to cancel your
              subscription.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Acceptable Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Use the Service for any illegal purpose or in violation of any
                laws
              </li>
              <li>
                Attempt to gain unauthorized access to the Service or its
                systems
              </li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Share your account credentials with others</li>
              <li>
                Reproduce, duplicate, copy, sell, or exploit any portion of the
                Service without permission
              </li>
              <li>
                Use automated systems or software to extract data from the
                Service
              </li>
              <li>
                Reverse engineer, decompile, or disassemble any aspect of the
                Service
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Intellectual Property
            </h2>
            <p>
              The Service and its original content, features, and functionality
              are owned by STS Futures and are protected by international
              copyright, trademark, patent, trade secret, and other intellectual
              property laws.
            </p>
            <p>
              You may not copy, modify, distribute, sell, or lease any part of
              our Service or included software without our express written
              permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Disclaimer of Warranties
            </h2>
            <p>
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT
              WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT
              NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR
              A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            </p>
            <p>We do not warrant that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                The Service will be uninterrupted, timely, secure, or error-free
              </li>
              <li>
                The results obtained from using the Service will be accurate or
                reliable
              </li>
              <li>Any errors in the Service will be corrected</li>
              <li>The Service will meet your requirements or expectations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Limitation of Liability
            </h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, STS FUTURES SHALL NOT BE
              LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER
              INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE,
              GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your use or inability to use the Service</li>
              <li>
                Any unauthorized access to or use of our servers and/or any
                personal information stored therein
              </li>
              <li>
                Any interruption or cessation of transmission to or from the
                Service
              </li>
              <li>
                Any bugs, viruses, trojan horses, or the like that may be
                transmitted to or through the Service
              </li>
              <li>
                Any errors or omissions in any content or for any loss or damage
                incurred as a result of your use of any content posted, emailed,
                transmitted, or otherwise made available through the Service
              </li>
              <li>
                Trading losses incurred as a result of using signals,
                strategies, or information provided by the Service
              </li>
            </ul>
            <p>
              IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL DAMAGES
              EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE (12) MONTHS
              PRECEDING THE EVENT GIVING RISE TO LIABILITY.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Indemnification
            </h2>
            <p>
              You agree to indemnify, defend, and hold harmless STS Futures, its
              officers, directors, employees, agents, and affiliates from and
              against any claims, liabilities, damages, losses, and expenses,
              including reasonable attorney fees, arising out of or in any way
              connected with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your access to or use of the Service</li>
              <li>Your violation of these Terms of Service</li>
              <li>Your violation of any third-party rights</li>
              <li>Any trading losses you incur</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              11. Modifications to Service
            </h2>
            <p>
              We reserve the right to modify, suspend, or discontinue the
              Service (or any part thereof) at any time, with or without notice.
              We shall not be liable to you or any third party for any
              modification, suspension, or discontinuance of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              12. Changes to Terms
            </h2>
            <p>
              We reserve the right to modify these Terms of Service at any time.
              We will notify you of material changes by posting the new Terms of
              Service on this page and updating the "Last Updated" date.
            </p>
            <p>
              Your continued use of the Service after such modifications
              constitutes your acceptance of the updated Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              13. Governing Law
            </h2>
            <p>
              These Terms of Service shall be governed by and construed in
              accordance with the laws of the United States, without regard to
              its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              14. Dispute Resolution
            </h2>
            <p>
              Any dispute arising from these Terms of Service or your use of the
              Service shall be resolved through binding arbitration in
              accordance with the rules of the American Arbitration Association.
              You waive any right to a jury trial or to participate in a class
              action lawsuit.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              15. Severability
            </h2>
            <p>
              If any provision of these Terms of Service is found to be
              unenforceable or invalid, that provision shall be limited or
              eliminated to the minimum extent necessary so that the remaining
              provisions remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              16. Contact Information
            </h2>
            <p>
              If you have any questions about these Terms of Service, please
              contact us at:
            </p>
            <p className="mt-4">
              <strong>STS Futures</strong>
              <br />
              Email: support@stsfutures.com
            </p>
          </section>

          <div className="mt-12 p-6 bg-muted/20 rounded-lg border border-border">
            <p className="text-sm text-muted-foreground">
              By using STS Futures, you acknowledge that you have read,
              understood, and agree to be bound by these Terms of Service. You
              also acknowledge that you understand the risks involved in futures
              trading and that you are solely responsible for your trading
              decisions.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </DashboardLayout>
  );
}
