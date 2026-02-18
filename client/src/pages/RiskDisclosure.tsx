import DashboardLayout from "../components/DashboardLayout";
import { Footer } from "../components/Footer";

export default function RiskDisclosure() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-4xl font-bold mb-8">Risk Disclosure Statement</h1>

        <div className="prose prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">
            <strong>Last Updated:</strong> February 17, 2026
          </p>

          <div className="p-6 bg-destructive/10 rounded-lg border border-destructive/30 mb-8">
            <p className="text-base font-semibold">
              IMPORTANT: Please read this Risk Disclosure Statement carefully
              before using STS Futures. Trading futures contracts involves a
              high degree of risk and may not be suitable for all investors.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              1. Risk of Loss in Futures Trading
            </h2>
            <p>
              <strong>
                TRADING IN FUTURES CONTRACTS INVOLVES A HIGH DEGREE OF RISK. THE
                AMOUNT OF INITIAL MARGIN IS SMALL RELATIVE TO THE VALUE OF THE
                FUTURES CONTRACT, MEANING THAT TRANSACTIONS ARE HEAVILY
                "LEVERAGED." A RELATIVELY SMALL MARKET MOVEMENT WILL HAVE A
                PROPORTIONATELY LARGER IMPACT ON THE FUNDS YOU HAVE DEPOSITED OR
                WILL HAVE TO DEPOSIT.
              </strong>
            </p>
            <p>
              You may sustain a total loss of initial margin funds and any
              additional funds deposited with your broker to maintain your
              position. If the market moves against your position or margin
              levels are increased, you may be called upon to pay substantial
              additional funds on short notice to maintain your position. If you
              fail to comply with a request for additional funds within the time
              prescribed, your position may be liquidated at a loss and you will
              be liable for any resulting deficit.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              2. Leverage Risk
            </h2>
            <p>
              Futures contracts are traded on margin, which means you only need
              to deposit a fraction of the total contract value. While leverage
              can amplify profits, it can equally amplify losses. The following
              table illustrates typical margin requirements and leverage ratios:
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold">Contract</th>
                    <th className="text-left p-3 font-semibold">
                      Typical Margin
                    </th>
                    <th className="text-left p-3 font-semibold">
                      Contract Value
                    </th>
                    <th className="text-left p-3 font-semibold">
                      Leverage Ratio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="p-3">NQ (Nasdaq-100 Mini)</td>
                    <td className="p-3">~$18,000</td>
                    <td className="p-3">~$420,000</td>
                    <td className="p-3">~23:1</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="p-3">ES (S&P 500 Mini)</td>
                    <td className="p-3">~$13,000</td>
                    <td className="p-3">~$300,000</td>
                    <td className="p-3">~23:1</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Margin requirements are subject to change and may be higher during
              periods of increased volatility.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">3. Market Risk</h2>
            <p>
              Futures markets can be extremely volatile. Prices can move rapidly
              in either direction due to:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Economic data releases:</strong> Employment reports,
                GDP, inflation data, and other economic indicators
              </li>
              <li>
                <strong>Federal Reserve actions:</strong> Interest rate
                decisions, quantitative easing/tightening, and forward guidance
              </li>
              <li>
                <strong>Geopolitical events:</strong> Wars, elections, trade
                disputes, and sanctions
              </li>
              <li>
                <strong>Market structure events:</strong> Flash crashes, circuit
                breakers, and liquidity gaps
              </li>
              <li>
                <strong>Unexpected events:</strong> Natural disasters,
                pandemics, and other "black swan" events
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              4. Liquidity Risk
            </h2>
            <p>
              Under certain market conditions, it may be difficult or impossible
              to liquidate a position. This can occur when there is insufficient
              trading activity in the market, during limit moves, or during
              periods of extreme volatility. Stop-loss orders may not be
              executed at the intended price, and slippage can result in
              significantly larger losses than anticipated.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              5. System and Technology Risk
            </h2>
            <p>
              Electronic trading systems, including the STS Futures platform,
              are subject to technology risks including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Hardware, software, or internet connection failures</li>
              <li>Data feed delays or interruptions</li>
              <li>Signal delivery latency</li>
              <li>Exchange system outages</li>
              <li>Cybersecurity threats</li>
            </ul>
            <p>
              These risks may prevent you from entering or exiting positions at
              desired prices, potentially resulting in losses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              6. Past Performance Disclaimer
            </h2>
            <p>
              <strong>
                PAST PERFORMANCE IS NOT NECESSARILY INDICATIVE OF FUTURE
                RESULTS.
              </strong>
            </p>
            <p>
              All performance data presented on the STS Futures platform,
              including backtested results, historical trade records, and
              strategy metrics, should not be interpreted as a guarantee or
              prediction of future performance. Market conditions change over
              time, and strategies that have been profitable in the past may
              incur losses in the future.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              7. Risk Capital
            </h2>
            <p>
              You should only use risk capital when trading futures — money that
              you can afford to lose without affecting your financial security
              or lifestyle. Do not trade with:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Money needed for living expenses</li>
              <li>Retirement savings</li>
              <li>Borrowed funds or credit</li>
              <li>Emergency funds</li>
              <li>Money allocated for education or other essential needs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              8. Independent Decision Making
            </h2>
            <p>
              STS Futures provides trading signals and analytical tools for
              informational purposes only. You are solely responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Evaluating whether futures trading is appropriate for you</li>
              <li>Making your own trading decisions</li>
              <li>Managing your own risk exposure</li>
              <li>Determining appropriate position sizes</li>
              <li>Setting and maintaining stop-loss levels</li>
            </ul>
            <p>
              We strongly recommend consulting with a qualified financial
              advisor before engaging in futures trading.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              9. Acknowledgment of Risk
            </h2>
            <p>By using STS Futures, you acknowledge that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                You have read and understood this Risk Disclosure Statement
              </li>
              <li>
                You understand that futures trading involves substantial risk of
                loss
              </li>
              <li>
                You are willing to accept these risks in order to trade futures
              </li>
              <li>
                You will not hold STS Futures liable for any trading losses
              </li>
              <li>
                You have the financial resources and risk tolerance to engage in
                futures trading
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mt-8 mb-4">
              10. Contact Information
            </h2>
            <p>
              If you have any questions about this Risk Disclosure Statement,
              please contact us at:
            </p>
            <p className="mt-4">
              <strong>STS Futures</strong>
              <br />
              Email: support@stsfutures.com
            </p>
          </section>

          <div className="mt-12 p-6 bg-destructive/10 rounded-lg border border-destructive/30">
            <p className="text-sm font-semibold">
              RISK WARNING: Trading futures involves substantial risk of loss
              and is not suitable for all investors. You should carefully
              consider whether trading is suitable for you in light of your
              circumstances, knowledge, and financial resources. You may lose
              all or more than your initial investment. Opinions, market data,
              and recommendations are subject to change at any time.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </DashboardLayout>
  );
}
