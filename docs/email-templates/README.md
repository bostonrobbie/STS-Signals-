# Email Templates — HTML files ready for MailerLite / any ESP

These HTML templates correspond to the sequence documented in
`docs/EMAIL_NURTURE_SEQUENCE.md`. Each file is a complete self-contained
HTML email you can paste directly into MailerLite's HTML editor (or
Mailchimp, ConvertKit, Resend, SendGrid — anywhere that accepts raw
HTML).

## Files

| File | Sequence day | Audience |
|---|---|---|
| `00-welcome.html` | 0 | All new signups |
| `01-founder-story.html` | 1 | All |
| `02-backtest-methodology.html` | 3 | All |
| `03-trial-check.html` | 5 | Trial only |
| `04-three-mistakes.html` | 7 | Trial only |
| `05-trial-ending.html` | 10 | Trial only |
| `06-last-chance-discount.html` | 14 | Trial expired |

## Placeholders to replace in your ESP

Each template uses MailerLite-style merge tags (`{{name}}`,
`{{signal_count_since_signup}}`, `{{period_pnl}}`). If you're using a
different ESP, find-and-replace to that platform's syntax:

- MailerLite: `{{name}}` (works as-is)
- Mailchimp: `*|NAME|*`
- ConvertKit: `{{ subscriber.first_name }}`
- Resend: `{{name}}` (if using their React Email / MJML pipeline)

## Styling approach

- Inline CSS only (every email client renders differently; external
  stylesheets get stripped)
- System font stack (no custom web fonts — they fail silently in
  Outlook)
- Max width 600px (standard email width; wider breaks in some clients)
- Single column (multi-column layouts break on mobile in certain
  ESPs)
- Emerald-green brand accent (`#059669` for buttons, `#10b981` for
  links)
- No background images (they're stripped by Gmail and Outlook)
- All link colors explicit inline (Outlook otherwise ignores CSS)
- CTA buttons are bulletproof VML for Outlook (background-color +
  border + padding approach)

## Deliverability prerequisites (do before sending)

1. Verify SPF record on stsdashboard.com DNS:
   `v=spf1 include:spf.mlsend.com ~all` (adjust for your ESP)
2. DKIM key from MailerLite → add CNAME records to DNS
3. DMARC policy: `v=DMARC1; p=none; rua=mailto:dmarc@stsdashboard.com`
   (start with `p=none`, ramp to `quarantine` after 30 days clean)
4. BIMI (optional, Gmail inbox logo): publish a VMC cert + SVG logo

## Tracking — UTM conventions

Every link in every email should include these UTM params (the
templates have them pre-wired):

```
?utm_source=email
&utm_medium=nurture
&utm_campaign=day-XX-theme
&utm_content=button-name
```

This flows through our existing `trafficCapture.ts` and
`user_attribution` table. You'll see email-driven signups attributed
correctly in the `/admin/seo` and `/admin/business` dashboards.

## Development-mode sending

Our `resendEmail.ts` dev-guard rewrites every non-prod recipient to
`rgorham369@gmail.com`. That applies to transactional/webhook-triggered
emails. **Nurture-sequence emails fire from MailerLite, not from our
server — so the dev guard does NOT apply to them.** Be careful not to
point MailerLite at a test list that includes real customer addresses.

Recommended workflow:
1. Set up a dedicated test list in MailerLite with only
   `rgorham369+test@gmail.com`
2. Send each template to the test list first
3. Verify rendering, deliverability, and tracking
4. THEN point the sequence at the real signup list

## What to measure per email

Track open rate, click rate, and `click-through to subscribe` in
MailerLite's campaign analytics. Benchmarks:

- Open rate: 30-45% for a transactional/nurture sequence
- Click rate: 5-12% on the CTA
- Signup → paid conversion attributable to email: 8-15%

If any individual email is below 20% open after 50+ sends, rewrite
the subject line. If click rate is below 3%, rework the CTA or
length.
