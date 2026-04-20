# Accessibility Checklist (WCAG 2.2 AA)

Target: **Lighthouse Accessibility score ≥ 95** on every public page.
Pass every item below before shipping new content.

Not just compliance — real users navigate your site with screen
readers, keyboard only, magnification, and reduced-motion settings.
These checks catch the issues they actually hit.

## 🔴 Must pass (failures block ship)

### Keyboard navigation
- [ ] Every interactive element reachable via `Tab` in logical reading order
- [ ] `Enter` and `Space` activate buttons / links
- [ ] `Esc` closes modals / dialogs / mobile menus
- [ ] Focus indicator visible (outline or ring) on every focusable element
- [ ] No keyboard trap — can tab in AND out of every widget
- [ ] Skip-to-main-content link at top of page (hidden until focused)

### Screen reader
- [ ] Every `<img>` has meaningful `alt` text (empty `alt=""` for pure decoration)
- [ ] Every `<button>` has a label (text content or `aria-label`)
- [ ] Every form input has an associated `<label>`
- [ ] Page has one `<h1>` (no zero, no two)
- [ ] Heading hierarchy makes sense (no `<h4>` before an `<h2>`)
- [ ] Interactive elements use semantic HTML (`<button>` not `<div onClick>`)
- [ ] ARIA attributes used correctly or not at all (wrong ARIA is worse than none)

### Color & contrast
- [ ] Body text contrast ratio ≥ 4.5:1 against background
- [ ] Large text (18pt+) contrast ratio ≥ 3:1
- [ ] Interactive element border/outline ≥ 3:1 against adjacent colors
- [ ] Info is never conveyed by color alone (add icon + text for error states)
- [ ] Dark mode passes the same thresholds

### Forms
- [ ] Every input has a visible label (not just placeholder)
- [ ] Required fields marked with `aria-required` OR visually with `*`
- [ ] Error messages tied to field via `aria-describedby`
- [ ] Field validation errors announced to screen reader (`aria-live="polite"`)
- [ ] Submit-button state change (loading/disabled) announced

## 🟡 Should pass (fail → file a bug, schedule fix)

### Visual design
- [ ] Text can zoom to 200% without horizontal scrolling on body text
- [ ] Line height ≥ 1.5× font size on paragraph text
- [ ] Paragraph spacing ≥ 2× line height
- [ ] `:focus-visible` style is distinct from `:hover`
- [ ] Respects `prefers-reduced-motion` (disable/reduce animation)
- [ ] Respects `prefers-color-scheme` (site's dark mode aligned)

### Dynamic content
- [ ] Dynamic content changes announced via `aria-live` regions (signals firing, toast notifications)
- [ ] Loading states announced (spinner has `aria-label="Loading"`)
- [ ] Route changes update `document.title` (already done via SEO components)
- [ ] Route changes focus top of main content (currently not — TODO)

### Media
- [ ] Video has captions OR no spoken narration
- [ ] Audio auto-play avoided (we don't use it — confirm)
- [ ] Animations can be paused (no auto-playing carousels)

## 🟢 Nice to have

- [ ] Reduced-motion support via `prefers-reduced-motion`
- [ ] High-contrast mode tested (Windows HCM)
- [ ] Zoom to 400% usable (AA+ level)
- [ ] Animations respect `Animation-play-state: paused`

## How to test

### 1. Automated — Lighthouse + axe DevTools
- Chrome DevTools → Lighthouse → Accessibility only
- axe DevTools browser extension (free) — catches things Lighthouse misses
- Run on every new page; tracks over time

### 2. Keyboard-only walkthrough
- Unplug your mouse (literally, or just commit to not touching it)
- Navigate the entire page with Tab / Shift+Tab / Enter / Space / Esc
- Can you log in, start checkout, read a blog post, and log out without a mouse?
- If any step fails, file a bug

### 3. Screen reader pass
- Mac: VoiceOver (`Cmd+F5`)
- Windows: NVDA (free, https://www.nvaccess.org/)
- Read through key pages — landing, pricing, how-it-works, a blog post
- Can you navigate by heading (`H`), landmark (`D`), link (`K`)?
- Is the content in logical reading order?

### 4. Color-contrast check
- Chrome DevTools → Inspect → Styles → click color swatch → shows contrast ratio
- Or paste hex codes into https://webaim.org/resources/contrastchecker/
- Target AA compliance (4.5:1 body / 3:1 large)

### 5. Reduced motion
- Mac System Settings → Accessibility → Display → Reduce motion
- Windows Settings → Ease of Access → Display → Show animations
- Site should not have jarring animations; respect the setting via `@media (prefers-reduced-motion)`

## Known issues to fix (triage queue)

As we run audits, log findings here with priority:

_(This section populated during the first pass)_

### 🔴 Block-level issues
- _(none logged yet — first pass pending)_

### 🟡 Fix-soon
- _(none logged yet)_

### 🟢 Nice-to-have
- Route change does not focus top of main content (React SPA routing issue; common; fix via `<a>` link with tabIndex=-1 focused on route change)

## Commit checklist

When adding new page components, run through:

1. Mount page, tab through everything — does focus flow make sense?
2. Inspect DOM — are all images labeled, all buttons labeled, one h1?
3. Run Lighthouse accessibility audit — score ≥ 95?
4. If it's a form, test with keyboard only
5. Check dark mode contrast
6. Toggle reduced-motion OS setting; re-check
7. Screen-reader test top-to-bottom before merging

This adds ~5 minutes per new page and catches 90% of issues that
would otherwise surface after launch.
