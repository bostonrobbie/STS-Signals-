/**
 * Resend Email Service
 * 
 * Provides email sending capabilities using Resend API.
 * Handles welcome emails, onboarding sequences, and notifications.
 */

import { Resend } from 'resend';
import { ENV } from '../_core/env';

// Initialize Resend client (will be null if API key not configured)
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!resendClient && ENV.RESEND_API_KEY) {
    resendClient = new Resend(ENV.RESEND_API_KEY);
  }
  return resendClient;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send an email using Resend
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const client = getResendClient();
  
  if (!client) {
    console.warn('[Email] Resend API key not configured. Email not sent.');
    return {
      success: false,
      error: 'Email service not configured. Please add RESEND_API_KEY to environment variables.',
    };
  }

  try {
    const result = await client.emails.send({
      from: options.from || ENV.EMAIL_FROM || 'IntraDay Strategies <noreply@intradaystrategies.com>',
      to: Array.isArray(options.to) ? options.to : [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (result.error) {
      console.error('[Email] Send failed:', result.error);
      return {
        success: false,
        error: result.error.message,
      };
    }

    console.log('[Email] Sent successfully:', result.data?.id);
    return {
      success: true,
      id: result.data?.id,
    };
  } catch (error) {
    console.error('[Email] Send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Welcome email template for new subscribers
 */
export function getWelcomeEmailHtml(userName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to IntraDay Strategies</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0a0a0b; color: #ffffff;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 40px;">
      <h1 style="color: #22d3ee; font-size: 28px; margin: 0;">IntraDay Strategies</h1>
      <p style="color: #a1a1aa; font-size: 14px; margin-top: 8px;">Professional Trading Signals</p>
    </div>

    <!-- Welcome Message -->
    <div style="background: linear-gradient(135deg, #1a1a1b 0%, #0f0f10 100%); border: 1px solid #27272a; border-radius: 12px; padding: 32px; margin-bottom: 24px;">
      <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0;">Welcome, ${userName}! 🎉</h2>
      <p style="color: #a1a1aa; font-size: 16px; line-height: 1.6; margin: 0;">
        Thank you for subscribing to IntraDay Strategies. You now have access to our professional-grade trading signals and performance analytics.
      </p>
    </div>

    <!-- Getting Started Steps -->
    <div style="background: #1a1a1b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <h3 style="color: #ffffff; font-size: 18px; margin: 0 0 20px 0;">Getting Started</h3>
      
      <div style="margin-bottom: 16px; display: flex; align-items: flex-start;">
        <div style="background: #22d3ee; color: #000; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; margin-right: 12px; flex-shrink: 0;">1</div>
        <div>
          <p style="color: #ffffff; font-size: 14px; margin: 0; font-weight: 600;">Connect Your Broker</p>
          <p style="color: #71717a; font-size: 13px; margin: 4px 0 0 0;">Link your trading account to receive automated signals.</p>
        </div>
      </div>

      <div style="margin-bottom: 16px; display: flex; align-items: flex-start;">
        <div style="background: #22d3ee; color: #000; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; margin-right: 12px; flex-shrink: 0;">2</div>
        <div>
          <p style="color: #ffffff; font-size: 14px; margin: 0; font-weight: 600;">Set Up Notifications</p>
          <p style="color: #71717a; font-size: 13px; margin: 4px 0 0 0;">Configure alerts for new trading signals.</p>
        </div>
      </div>

      <div style="display: flex; align-items: flex-start;">
        <div style="background: #22d3ee; color: #000; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 12px; margin-right: 12px; flex-shrink: 0;">3</div>
        <div>
          <p style="color: #ffffff; font-size: 14px; margin: 0; font-weight: 600;">Review Strategy Performance</p>
          <p style="color: #71717a; font-size: 13px; margin: 4px 0 0 0;">Explore historical data and select your strategies.</p>
        </div>
      </div>
    </div>

    <!-- Risk Disclaimer -->
    <div style="background: #1c1917; border: 1px solid #44403c; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <p style="color: #fbbf24; font-size: 12px; font-weight: 600; margin: 0 0 8px 0;">⚠️ RISK DISCLOSURE</p>
      <p style="color: #a8a29e; font-size: 11px; line-height: 1.5; margin: 0;">
        Trading futures involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. Only risk capital you can afford to lose.
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${ENV.VITE_APP_URL || 'https://intradaystrategies.com'}/my-dashboard" style="display: inline-block; background: #22d3ee; color: #000; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 14px;">
        Go to Dashboard →
      </a>
    </div>

    <!-- Footer -->
    <div style="text-align: center; border-top: 1px solid #27272a; padding-top: 24px;">
      <p style="color: #71717a; font-size: 12px; margin: 0;">
        IntraDay Strategies • Professional Trading Signals
      </p>
      <p style="color: #52525b; font-size: 11px; margin: 8px 0 0 0;">
        You received this email because you subscribed to IntraDay Strategies.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send welcome email to new subscriber
 */
export async function sendWelcomeEmail(
  email: string,
  userName: string
): Promise<EmailResult> {
  return sendEmail({
    to: email,
    subject: 'Welcome to IntraDay Strategies! 🎉',
    html: getWelcomeEmailHtml(userName),
    text: `Welcome to IntraDay Strategies, ${userName}! Thank you for subscribing. Visit your dashboard to get started: ${ENV.VITE_APP_URL || 'https://intradaystrategies.com'}/my-dashboard`,
  });
}

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!ENV.RESEND_API_KEY;
}
