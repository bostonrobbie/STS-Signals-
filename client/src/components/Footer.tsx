import { Link } from "wouter";
import { ContactForm } from "@/components/ContactForm";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="font-semibold text-lg mb-4">STS Futures</h3>
            <p className="text-sm text-muted-foreground">
              Systematic trading strategies for futures markets.
              Professional-grade analytics and real-time signals.
            </p>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/terms">
                  <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Terms of Service
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/privacy">
                  <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Privacy Policy
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/refund-policy">
                  <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Cancellation Policy
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/disclaimer">
                  <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Disclaimer
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/risk-disclosure">
                  <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Risk Disclosure
                  </a>
                </Link>
              </li>
            </ul>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/overview">
                  <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Strategies
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/demo">
                  <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Demo
                  </a>
                </Link>
              </li>
              <li>
                <Link href="/billing">
                  <a className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Pricing
                  </a>
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-semibold text-sm mb-4">Support</h3>
            <ul className="space-y-2">
              <li>
                <ContactForm
                  trigger={
                    <button className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left">
                      Contact Us
                    </button>
                  }
                />
              </li>
              <li>
                <a
                  href="mailto:support@stsfutures.com"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  support@stsfutures.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} STS Futures. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground max-w-2xl text-center md:text-right">
              <strong>Risk Disclosure:</strong> Trading futures involves
              substantial risk of loss and is not suitable for all investors.
              Past performance is not indicative of future results.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
