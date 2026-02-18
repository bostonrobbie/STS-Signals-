import DashboardLayout from "../components/DashboardLayout";
import { Footer } from "../components/Footer";

export default function Disclaimer() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8">Disclaimer</h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            <strong>Last Updated:</strong> February 17, 2026
          </p>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              1. General Disclaimer
            </h2>
            <p>
              The information provided on the STS Futures website and platform
              ("the Service") is for general informational and educational
              purposes only. Nothing on this website constitutes, or is intended
              to constitute, investment advice, financial advice, trading
              advice, or any other type of professional advice.
            </p>
            <p>
              You should not make any financial, investment, or trading decision
              based solely on the information provided by STS Futures without
              independently verifying the information and/or consulting with a
              qualified financial professional.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. No Investment Advice
            </h2>
            <p>
              STS Futures is{" "}
              <strong>not a registered investment advisor</strong>,
              broker-dealer, or financial planner. The trading signals, strategy
              performance data, analytics, and any other content provided
              through the Service are for informational purposes only and do not
              constitute a recommendation to buy, sell, or hold any futures
              contract or other financial instrument.
            </p>
            <p>
              Any references to specific trading strategies, their historical
              performance, or potential returns are provided for educational
              purposes and should not be interpreted as a guarantee of future
              performance or profitability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              3. Hypothetical Performance Disclaimer
            </h2>
            <p>
              <strong>
                HYPOTHETICAL OR SIMULATED PERFORMANCE RESULTS HAVE CERTAIN
                INHERENT LIMITATIONS.
              </strong>
            </p>
            <p>
              Unlike an actual performance record, simulated results do not
              represent actual trading. Also, since the trades have not actually
              been executed, the results may have under-or-over compensated for
              the impact, if any, of certain market factors, such as lack of
              liquidity. Simulated trading programs in general are also subject
              to the fact that they are designed with the benefit of hindsight.
            </p>
            <p>
              <strong>
                NO REPRESENTATION IS BEING MADE THAT ANY ACCOUNT WILL OR IS
                LIKELY TO ACHIEVE PROFITS OR LOSSES SIMILAR TO THOSE SHOWN.
              </strong>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Trading Risk
            </h2>
            <p>
              <strong>
                TRADING FUTURES AND OPTIONS INVOLVES SUBSTANTIAL RISK OF LOSS
                AND IS NOT SUITABLE FOR ALL INVESTORS.
              </strong>
            </p>
            <p>
              The high degree of leverage that is often obtainable in futures
              trading can work against you as well as for you. The use of
              leverage can lead to large losses as well as gains. You should
              carefully consider whether futures trading is appropriate for you
              in light of your financial condition. You may sustain a total loss
              of the initial margin funds and any additional funds that you
              deposit with your broker to establish or maintain a position in
              the futures market.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. No Guarantee of Results
            </h2>
            <p>
              STS Futures makes no guarantee, representation, or warranty of any
              kind regarding the accuracy, completeness, timeliness, or
              reliability of any information, trading signals, or content
              provided through the Service.
            </p>
            <p>
              Past performance of any trading strategy, whether backtested or
              live, is not indicative of future results. Market conditions
              change constantly, and strategies that have performed well
              historically may not continue to do so.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Third-Party Content
            </h2>
            <p>
              The Service may contain links to third-party websites, data
              sources, or services. STS Futures does not endorse, control, or
              assume responsibility for the content, privacy policies, or
              practices of any third-party websites or services. You acknowledge
              and agree that STS Futures shall not be responsible or liable for
              any damage or loss caused by the use of any such third-party
              content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Technical Disclaimer
            </h2>
            <p>
              While we strive to provide accurate and timely trading signals,
              technical issues may occur including but not limited to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Signal delivery delays due to network or server issues</li>
              <li>Temporary service outages or interruptions</li>
              <li>
                Data feed delays or inaccuracies from third-party providers
              </li>
              <li>Software bugs or calculation errors</li>
            </ul>
            <p>
              STS Futures shall not be held liable for any losses resulting from
              technical failures, delays, or errors in signal delivery.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Regulatory Compliance
            </h2>
            <p>
              STS Futures is not registered with the Commodity Futures Trading
              Commission (CFTC) or the National Futures Association (NFA). The
              Service does not provide commodity trading advice as defined by
              applicable regulations. Users are responsible for ensuring their
              use of the Service complies with all applicable laws and
              regulations in their jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Contact Information
            </h2>
            <p>
              If you have any questions about this Disclaimer, please contact us
              at:
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
              understood, and agree to this Disclaimer. You also acknowledge
              that trading futures involves substantial risk and that you are
              solely responsible for your own trading decisions and their
              financial consequences.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </DashboardLayout>
  );
}
