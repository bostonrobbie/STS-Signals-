import { describe, it, expect } from "vitest";
import {
  organizationSchema,
  faqSchema,
  productSchema,
  breadcrumbSchema,
} from "@/components/StructuredData";

describe("StructuredData schemas", () => {
  describe("organizationSchema", () => {
    it("should have correct @type and name", () => {
      expect(organizationSchema["@type"]).toBe("Organization");
      expect(organizationSchema.name).toBe("STS Futures");
    });

    it("should use the correct domain", () => {
      expect(organizationSchema.url).toContain("stsdashboard.com");
      expect(organizationSchema.url).not.toContain("intradaydash");
      expect(organizationSchema.url).not.toContain("sts-futures.com");
    });

    it("should not contain fabricated data", () => {
      const text = JSON.stringify(organizationSchema);
      expect(text).not.toContain("aggregateRating");
      expect(text).not.toContain("4.8");
      expect(text).not.toContain("review");
    });
  });

  describe("faqSchema", () => {
    it("should have correct @type", () => {
      expect(faqSchema["@type"]).toBe("FAQPage");
    });

    it("should not mention ES, YM, CL, GC, or BTC markets", () => {
      const text = JSON.stringify(faqSchema);
      expect(text).not.toContain("E-mini S&P");
      expect(text).not.toContain("E-mini Dow");
      expect(text).not.toContain("Crude Oil");
      expect(text).not.toContain("Gold futures");
      expect(text).not.toContain("Bitcoin futures");
    });

    it("should mention NQ and correct pricing", () => {
      const text = JSON.stringify(faqSchema);
      expect(text).toContain("NQ");
      expect(text).toContain("$50");
    });

    it("should not mention free trial", () => {
      const text = JSON.stringify(faqSchema);
      expect(text.toLowerCase()).not.toContain("free trial");
    });

    it("should not mention broker integration", () => {
      const text = JSON.stringify(faqSchema);
      expect(text).not.toContain("Alpaca");
      expect(text).not.toContain("Tradovate");
      expect(text).not.toContain("Interactive Brokers");
    });
  });

  describe("productSchema", () => {
    it("should have correct @type and price", () => {
      expect(productSchema["@type"]).toBe("SoftwareApplication");
      expect(productSchema.offers.price).toBe("50");
      expect(productSchema.offers.priceCurrency).toBe("USD");
    });

    it("should not contain fabricated ratings or reviews", () => {
      const text = JSON.stringify(productSchema);
      expect(text).not.toContain("aggregateRating");
      expect(text).not.toContain("review");
      expect(text).not.toContain("4.8");
    });

    it("should not mention non-existent features", () => {
      const text = JSON.stringify(productSchema);
      expect(text).not.toContain("broker");
      expect(text).not.toContain("automated execution");
      expect(text).not.toContain("free trial");
    });
  });

  describe("breadcrumbSchema", () => {
    it("should generate valid breadcrumb list", () => {
      const result = breadcrumbSchema([
        { name: "Home", url: "https://stsdashboard.com/" },
        {
          name: "Pricing",
          url: "https://stsdashboard.com/pricing",
        },
      ]);
      expect(result["@type"]).toBe("BreadcrumbList");
      expect(result.itemListElement).toHaveLength(2);
      expect(result.itemListElement[0].position).toBe(1);
      expect(result.itemListElement[1].position).toBe(2);
    });
  });
});
