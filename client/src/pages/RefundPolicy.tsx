import DashboardLayout from "../components/DashboardLayout";
import { Footer } from "../components/Footer";
import { SEOHead, SEO_CONFIG } from "@/components/SEOHead";
import { StructuredData, webPageSchema, breadcrumbSchema } from "@/components/StructuredData";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export default function RefundPolicy() {
  return (
    <DashboardLayout>
      <SEOHead {...SEO_CONFIG.refund} />
      <StructuredData
        id="refund-page"
        data={webPageSchema({
          name: "Cancellation & Refund Policy",
          description: SEO_CONFIG.refund.description,
          url: SEO_CONFIG.refund.canonical,
          breadcrumb: breadcrumbSchema([
            { name: "Home", url: "https://stsdashboard.com/" },
            { name: "Cancellation Policy", url: SEO_CONFIG.refund.canonical },
          ]),
        })}
      />
      <div className="max-w-4xl mx-auto py-12 px-4">
        <Breadcrumbs
          className="mb-6"
          items={[
            { name: "Home", path: "/" },
            { name: "Cancellation Policy", path: "/refund-policy" },
          ]}
        />
        <h1 className="text-4xl font-bold mb-8">Cancellation Policy</h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            <strong>Last Updated:</strong> February 16, 2026
          </p>

          <p>
            At STS Futures, we believe in transparent and straightforward
            billing. This policy explains our cancellation procedures.
          </p>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              1. All Sales Are Final
            </h2>
            <p>
              All subscription purchases are{" "}
              <strong>final and non-refundable</strong>. By subscribing to STS
              Futures, you acknowledge and agree that no refunds will be issued
              for any reason, including but not limited to dissatisfaction with
              the Service, failure to use the Service, or change of mind.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Subscription Cancellation
            </h2>
            <p>
              You may cancel your subscription at any time. Here's how
              cancellation works:
            </p>

            <h3 className="text-xl font-semibold mt-6 mb-3">How to Cancel</h3>
            <p>To cancel your subscription:</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>Log in to your account</li>
              <li>Navigate to the Billing page</li>
              <li>Click "Manage Subscription"</li>
              <li>Select "Cancel Subscription"</li>
            </ol>

            <h3 className="text-xl font-semibold mt-6 mb-3">
              When Cancellation Takes Effect
            </h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                Cancellations take effect at the{" "}
                <strong>end of your current billing period</strong>
              </li>
              <li>
                You will retain access to the Service until the end of the paid
                period
              </li>
              <li>You will not be charged for subsequent billing periods</li>
              <li>No refunds are provided for partial billing periods</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">Example</h3>
            <p>If you subscribe on January 1st and cancel on January 15th:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your subscription remains active until January 31st</li>
              <li>You will not be charged on February 1st</li>
              <li>
                No refund will be issued for the remaining January 15-31 period
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Billing Disputes
            </h2>
            <p>
              If you believe you were charged incorrectly (e.g., duplicate
              charges or billing errors), please contact us at
              support@stsfutures.com. We are committed to resolving legitimate
              billing disputes fairly and promptly.
            </p>
            <p>
              <strong>Important:</strong> Initiating a chargeback without first
              contacting us may result in immediate suspension of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Account Termination
            </h2>
            <p>
              We reserve the right to terminate accounts that violate our Terms
              of Service. In cases of account termination:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                No refunds will be provided for violations of Terms of Service
              </li>
              <li>Access to the Service will be immediately revoked</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">5. Contact Us</h2>
            <p>
              If you have any questions about this policy or need assistance
              with cancellation, please contact us:
            </p>
            <p className="mt-4">
              <strong>STS Futures Support</strong>
              <br />
              Email: support@stsfutures.com
              <br />
              Response Time: Within 24 hours (business days)
            </p>
          </section>

          <div className="mt-12 p-6 bg-muted/20 rounded-lg border border-border">
            <h3 className="text-lg font-semibold mb-2">Summary</h3>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>All sales are final — no refunds</li>
              <li>
                Cancel anytime — access continues until end of billing period
              </li>
              <li>Contact support for billing errors or disputes</li>
            </ul>
          </div>
        </div>
      </div>
      <Footer />
    </DashboardLayout>
  );
}
