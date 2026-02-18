/**
 * Email Service for IntraDay Strategies Dashboard
 * 
 * This service provides email templates and sending functionality
 * for user onboarding and notifications.
 * 
 * Note: Currently uses the Manus notification service to send emails
 * to the project owner. For user-facing emails, integrate with an
 * email service provider (SendGrid, AWS SES, etc.) in production.
 */

import { notifyOwnerAsync } from '../_core/notification';

export interface EmailTemplate {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface UserInfo {
  name: string | null;
  email: string | null;
  tier: 'free' | 'pro' | 'premium';
}

/**
 * Generate welcome email for new subscribers
 */
export function generateWelcomeEmail(user: UserInfo): EmailTemplate {
  const userName = user.name || 'Trader';
  const tierName = user.tier === 'pro' ? 'Pro' : user.tier === 'premium' ? 'Premium' : 'Free';
  
  const subject = `Welcome to IntraDay Strategies, ${userName}!`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #059669 0%, #0891b2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
    .step { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border-left: 4px solid #059669; }
    .step-number { display: inline-block; width: 28px; height: 28px; background: #059669; color: white; border-radius: 50%; text-align: center; line-height: 28px; font-weight: bold; margin-right: 10px; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #059669 0%, #0891b2 100%); color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .disclaimer { font-size: 12px; color: #64748b; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to IntraDay Strategies!</h1>
      <p>Your ${tierName} subscription is now active</p>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>
      <p>Thank you for subscribing to IntraDay Strategies! You now have full access to our portfolio of proven trading strategies with real-time signals and automated execution.</p>
      
      <h2>Get Started in 3 Easy Steps:</h2>
      
      <div class="step">
        <span class="step-number">1</span>
        <strong>Select Your Strategies</strong>
        <p>Choose which of our 8+ trading strategies you want to follow. Each strategy has different characteristics and risk profiles.</p>
      </div>
      
      <div class="step">
        <span class="step-number">2</span>
        <strong>Connect Your Broker</strong>
        <p>Link your Tradovate or Interactive Brokers account for automated trade execution. This uses secure OAuth - we never see your login credentials.</p>
      </div>
      
      <div class="step">
        <span class="step-number">3</span>
        <strong>Configure Notifications</strong>
        <p>Set up email and push notifications to stay informed about trade signals, entries, and exits.</p>
      </div>
      
      <a href="https://your-domain.com/my-dashboard" class="cta-button">Go to My Dashboard →</a>
      
      <h3>Need Help?</h3>
      <p>Check out our <a href="https://your-domain.com/#faq">FAQ section</a> for answers to common questions, or reply to this email for support.</p>
      
      <div class="disclaimer">
        <strong>Risk Disclaimer:</strong> Trading futures and other financial instruments involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. The performance data shown is based on backtested results and may not reflect actual trading conditions. Never trade with money you cannot afford to lose.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const textBody = `
Welcome to IntraDay Strategies, ${userName}!

Your ${tierName} subscription is now active.

Thank you for subscribing to IntraDay Strategies! You now have full access to our portfolio of proven trading strategies with real-time signals and automated execution.

GET STARTED IN 3 EASY STEPS:

1. SELECT YOUR STRATEGIES
Choose which of our 8+ trading strategies you want to follow. Each strategy has different characteristics and risk profiles.

2. CONNECT YOUR BROKER
Link your Tradovate or Interactive Brokers account for automated trade execution. This uses secure OAuth - we never see your login credentials.

3. CONFIGURE NOTIFICATIONS
Set up email and push notifications to stay informed about trade signals, entries, and exits.

Go to My Dashboard: https://your-domain.com/my-dashboard

NEED HELP?
Check out our FAQ section for answers to common questions, or reply to this email for support.

---
RISK DISCLAIMER: Trading futures and other financial instruments involves substantial risk of loss and is not suitable for all investors. Past performance is not indicative of future results. The performance data shown is based on backtested results and may not reflect actual trading conditions. Never trade with money you cannot afford to lose.
  `.trim();
  
  return { subject, htmlBody, textBody };
}

/**
 * Generate broker connection guide email
 */
export function generateBrokerGuideEmail(user: UserInfo): EmailTemplate {
  const userName = user.name || 'Trader';
  
  const subject = `Connect Your Broker to IntraDay Strategies`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #059669 0%, #0891b2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
    .broker-card { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border: 1px solid #e2e8f0; }
    .broker-logo { font-size: 24px; font-weight: bold; color: #059669; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #059669 0%, #0891b2 100%); color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .disclaimer { font-size: 12px; color: #64748b; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Connect Your Broker</h1>
      <p>Enable automated trade execution</p>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>
      <p>To receive automated trade execution from our strategies, you'll need to connect your brokerage account. We support the following brokers:</p>
      
      <div class="broker-card">
        <div class="broker-logo">Tradovate</div>
        <p>Popular futures broker with competitive pricing. Supports ES, NQ, CL, GC, YM, and BTC futures.</p>
        <p><strong>How to connect:</strong></p>
        <ol>
          <li>Go to the Admin → Brokers tab in your dashboard</li>
          <li>Click "Connect to Tradovate"</li>
          <li>Log in with your Tradovate credentials</li>
          <li>Authorize IntraDay Strategies to place trades</li>
        </ol>
      </div>
      
      <div class="broker-card">
        <div class="broker-logo">Interactive Brokers</div>
        <p>Professional-grade broker with global market access. Supports all futures markets.</p>
        <p><strong>How to connect:</strong></p>
        <ol>
          <li>Go to the Admin → Brokers tab in your dashboard</li>
          <li>Click "Connect to IBKR"</li>
          <li>Log in with your IBKR credentials</li>
          <li>Authorize IntraDay Strategies to place trades</li>
        </ol>
      </div>
      
      <p><strong>Security Note:</strong> We use OAuth authentication, which means we never see or store your broker login credentials. You can revoke access at any time from your broker's settings.</p>
      
      <a href="https://your-domain.com/admin?tab=brokers" class="cta-button">Connect Your Broker →</a>
      
      <div class="disclaimer">
        <strong>Risk Disclaimer:</strong> Trading futures involves substantial risk of loss. Past performance is not indicative of future results. Never trade with money you cannot afford to lose.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const textBody = `
Connect Your Broker to IntraDay Strategies

Hi ${userName},

To receive automated trade execution from our strategies, you'll need to connect your brokerage account.

SUPPORTED BROKERS:

TRADOVATE
Popular futures broker with competitive pricing. Supports ES, NQ, CL, GC, YM, and BTC futures.

How to connect:
1. Go to the Admin → Brokers tab in your dashboard
2. Click "Connect to Tradovate"
3. Log in with your Tradovate credentials
4. Authorize IntraDay Strategies to place trades

INTERACTIVE BROKERS
Professional-grade broker with global market access. Supports all futures markets.

How to connect:
1. Go to the Admin → Brokers tab in your dashboard
2. Click "Connect to IBKR"
3. Log in with your IBKR credentials
4. Authorize IntraDay Strategies to place trades

SECURITY NOTE: We use OAuth authentication, which means we never see or store your broker login credentials. You can revoke access at any time from your broker's settings.

Connect Your Broker: https://your-domain.com/admin?tab=brokers

---
RISK DISCLAIMER: Trading futures involves substantial risk of loss. Past performance is not indicative of future results. Never trade with money you cannot afford to lose.
  `.trim();
  
  return { subject, htmlBody, textBody };
}

/**
 * Generate notification setup guide email
 */
export function generateNotificationGuideEmail(user: UserInfo): EmailTemplate {
  const userName = user.name || 'Trader';
  
  const subject = `Set Up Your Trade Notifications`;
  
  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #059669 0%, #0891b2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center; }
    .content { background: #f8fafc; padding: 30px; border-radius: 0 0 8px 8px; }
    .feature { background: white; padding: 20px; margin: 15px 0; border-radius: 8px; border: 1px solid #e2e8f0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #059669 0%, #0891b2 100%); color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold; margin: 20px 0; }
    .disclaimer { font-size: 12px; color: #64748b; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Set Up Notifications</h1>
      <p>Stay informed about your trades</p>
    </div>
    <div class="content">
      <p>Hi ${userName},</p>
      <p>Configure your notification preferences to stay informed about trade signals, entries, and exits from your subscribed strategies.</p>
      
      <div class="feature">
        <h3>📧 Email Notifications</h3>
        <p>Receive detailed emails when trades are executed, including entry/exit prices, P&L, and strategy performance updates.</p>
      </div>
      
      <div class="feature">
        <h3>🔔 Push Notifications</h3>
        <p>Get instant alerts on your device when new trade signals are generated or positions are opened/closed.</p>
      </div>
      
      <div class="feature">
        <h3>⏰ Quiet Hours</h3>
        <p>Set quiet hours to pause notifications during specific times (e.g., overnight or during meetings).</p>
      </div>
      
      <div class="feature">
        <h3>📊 Per-Strategy Settings</h3>
        <p>Customize notifications for each strategy individually. Get alerts only for the strategies you care about most.</p>
      </div>
      
      <a href="https://your-domain.com/my-dashboard?tab=notifications" class="cta-button">Configure Notifications →</a>
      
      <div class="disclaimer">
        <strong>Risk Disclaimer:</strong> Trading futures involves substantial risk of loss. Past performance is not indicative of future results.
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
  
  const textBody = `
Set Up Your Trade Notifications

Hi ${userName},

Configure your notification preferences to stay informed about trade signals, entries, and exits from your subscribed strategies.

NOTIFICATION OPTIONS:

📧 EMAIL NOTIFICATIONS
Receive detailed emails when trades are executed, including entry/exit prices, P&L, and strategy performance updates.

🔔 PUSH NOTIFICATIONS
Get instant alerts on your device when new trade signals are generated or positions are opened/closed.

⏰ QUIET HOURS
Set quiet hours to pause notifications during specific times (e.g., overnight or during meetings).

📊 PER-STRATEGY SETTINGS
Customize notifications for each strategy individually. Get alerts only for the strategies you care about most.

Configure Notifications: https://your-domain.com/my-dashboard?tab=notifications

---
RISK DISCLAIMER: Trading futures involves substantial risk of loss. Past performance is not indicative of future results.
  `.trim();
  
  return { subject, htmlBody, textBody };
}

/**
 * Send welcome email sequence notification to owner
 * In production, this would send actual emails to users
 */
export function sendWelcomeEmailSequence(user: UserInfo): void {
  // For now, notify the owner about new subscriber
  // In production, integrate with email service provider
  notifyOwnerAsync({
    title: `New ${user.tier.toUpperCase()} Subscriber: ${user.name || user.email || 'Unknown'}`,
    content: `
A new user has subscribed to the ${user.tier} plan.

User Details:
- Name: ${user.name || 'Not provided'}
- Email: ${user.email || 'Not provided'}
- Tier: ${user.tier}

Welcome email sequence should be sent:
1. Welcome email (immediate)
2. Broker connection guide (Day 1)
3. Notification setup guide (Day 2)

Note: To enable user-facing emails, integrate with an email service provider (SendGrid, AWS SES, etc.).
    `.trim()
  });
}

/**
 * Onboarding checklist items for new users
 */
export interface OnboardingChecklistItem {
  id: string;
  title: string;
  description: string;
  href: string;
  completed: boolean;
}

export function getOnboardingChecklist(user: {
  hasSelectedStrategies: boolean;
  hasBrokerConnected: boolean;
  hasNotificationsConfigured: boolean;
}): OnboardingChecklistItem[] {
  return [
    {
      id: 'strategies',
      title: 'Select Your Strategies',
      description: 'Choose which trading strategies to follow from our portfolio',
      href: '/my-dashboard',
      completed: user.hasSelectedStrategies
    },
    {
      id: 'broker',
      title: 'Connect Your Broker',
      description: 'Link Tradovate or IBKR for automated trade execution',
      href: '/admin?tab=brokers',
      completed: user.hasBrokerConnected
    },
    {
      id: 'notifications',
      title: 'Configure Notifications',
      description: 'Set up email and push alerts for trade signals',
      href: '/my-dashboard?tab=notifications',
      completed: user.hasNotificationsConfigured
    }
  ];
}
