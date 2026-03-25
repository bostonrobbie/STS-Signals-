import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const resendEmailPath = path.join(__dirname, "services/resendEmail.ts");
const resendEmailSource = fs.readFileSync(resendEmailPath, "utf-8");

const pricingPagePath = path.join(__dirname, "../client/src/pages/Pricing.tsx");
const pricingPageSource = fs.readFileSync(pricingPagePath, "utf-8");

describe("Welcome Email - STS Futures Branding", () => {
  it("should use STS Futures branding, not IntraDay Strategies", () => {
    // The welcome email template should reference STS Futures
    expect(resendEmailSource).toContain("Welcome to STS Futures");
    expect(resendEmailSource).toContain("STS Futures");
  });

  it("should have correct subject line without emoji", () => {
    expect(resendEmailSource).toContain(
      'subject: "Welcome to STS Futures - Your Dashboard Is Ready"'
    );
    // No emoji in subject
    expect(resendEmailSource).not.toContain("🎉");
  });

  it("should not contain em dashes in welcome email", () => {
    // Extract just the welcome email template function
    const templateStart = resendEmailSource.indexOf("getWelcomeEmailHtml");
    const templateEnd = resendEmailSource.indexOf(
      "sendWelcomeEmail",
      templateStart + 1
    );
    const templateSection = resendEmailSource.substring(
      templateStart,
      templateEnd
    );
    expect(templateSection).not.toContain("\u2014"); // em dash
    expect(templateSection).not.toContain("\u2013"); // en dash
  });

  it("should reference NQ futures, not generic trading signals", () => {
    expect(resendEmailSource).toContain("NQ Futures Trading Signals");
  });

  it("should not contain Connect Your Broker step", () => {
    const templateStart = resendEmailSource.indexOf("getWelcomeEmailHtml");
    const templateEnd = resendEmailSource.indexOf(
      "sendWelcomeEmail",
      templateStart + 1
    );
    const templateSection = resendEmailSource.substring(
      templateStart,
      templateEnd
    );
    expect(templateSection).not.toContain("Connect Your Broker");
    expect(templateSection).not.toContain("Set Up Notifications");
  });

  it("should include feature table with 5 features (no Strategy Comparison)", () => {
    expect(resendEmailSource).toContain("Real-Time NQ Signals");
    expect(resendEmailSource).toContain("15+ Years of Data");
    expect(resendEmailSource).toContain("Equity Curves and Drawdown");
    expect(resendEmailSource).toContain("Risk Analytics");
    expect(resendEmailSource).toContain("Calendar P&amp;L");
  });

  it("should not include Strategy Comparison in welcome email", () => {
    const templateStart = resendEmailSource.indexOf("getWelcomeEmailHtml");
    const templateEnd = resendEmailSource.indexOf(
      "sendWelcomeEmail",
      templateStart + 1
    );
    const templateSection = resendEmailSource.substring(
      templateStart,
      templateEnd
    );
    expect(templateSection).not.toContain("Strategy Comparison");
    expect(templateSection).not.toContain("correlation matrix");
  });

  it("should include risk disclosure", () => {
    expect(resendEmailSource).toContain("RISK DISCLOSURE");
    expect(resendEmailSource).toContain(
      "Trading futures involves substantial risk"
    );
  });

  it("should link to stsdashboard.com/overview", () => {
    expect(resendEmailSource).toContain("https://stsdashboard.com/overview");
  });

  it("should include Go to Dashboard CTA button", () => {
    expect(resendEmailSource).toContain("Go to Dashboard");
  });

  it("should have correct footer with stsdashboard.com reference", () => {
    expect(resendEmailSource).toContain("stsdashboard.com");
  });
});

describe("Pricing Page - How It Works Section", () => {
  it("should contain How It Works section", () => {
    expect(pricingPageSource).toContain("How It Works");
  });

  it("should have 3 steps: Subscribe, Create Account, Access Dashboard", () => {
    expect(pricingPageSource).toContain("Subscribe");
    expect(pricingPageSource).toContain("Create Account");
    expect(pricingPageSource).toContain("Access Dashboard");
  });

  it("should mention no account needed for subscribe step", () => {
    expect(pricingPageSource).toContain("No account needed");
  });

  it("should mention subscription is automatically linked after payment", () => {
    expect(pricingPageSource).toContain("automatically linked");
  });

  it("should import CreditCard, UserPlus, and BarChart3 icons", () => {
    expect(pricingPageSource).toContain("CreditCard");
    expect(pricingPageSource).toContain("UserPlus");
    expect(pricingPageSource).toContain("BarChart3");
  });

  it("should have 3-column responsive grid for steps", () => {
    expect(pricingPageSource).toContain("md:grid-cols-3");
  });

  it("should have step numbers 1, 2, 3", () => {
    // Check for the numbered step indicators
    const step1Match =
      pricingPageSource.includes(">1<") ||
      pricingPageSource.includes(">\n                  1\n");
    const step2Match =
      pricingPageSource.includes(">2<") ||
      pricingPageSource.includes(">\n                  2\n");
    const step3Match =
      pricingPageSource.includes(">3<") ||
      pricingPageSource.includes(">\n                  3\n");
    expect(step1Match).toBe(true);
    expect(step2Match).toBe(true);
    expect(step3Match).toBe(true);
  });

  it("should mention NQ trading signals in the Access Dashboard step", () => {
    expect(pricingPageSource).toContain("NQ trading signals");
  });
});
