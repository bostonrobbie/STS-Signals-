# Google Search Console + Bing Webmaster + IndexNow Setup

All three are free, take < 15 minutes together, and unlock the single
biggest free source of SEO data + AI-engine crawl hints we have.

## 1. Google Search Console (5 min)

The property is **already verified** via the `<meta name="google-site-verification">` tag in `client/index.html` (content value: `0Ao67K7Y1TBUHpRCtPtck0SCa7bY9kUiUOwEsXhjBm8`).

What's left to do:

1. Sign in: https://search.google.com/search-console (use rgorham369@gmail.com)
2. Confirm the `stsdashboard.com` property appears in your property list
3. If it doesn't, add it:
   - Click "Add property" → "URL prefix" → enter `https://stsdashboard.com`
   - Verification method → "HTML tag" → should auto-detect the existing meta tag → "Verify"
4. Submit the sitemap:
   - Sidebar → **Sitemaps**
   - Enter `sitemap.xml` → Submit
   - Within 24 hours it should show "Success" with indexed URL count
5. Check **Coverage** report (sidebar → Pages):
   - "Indexed" should include all the URLs from our sitemap
   - "Not indexed" is normal for legal pages and admin routes
6. **Security & Manual actions** (sidebar):
   - Security issues: should say "No issues detected" (we already verified this)
   - Manual actions: should say "No issues detected"

### Optional: API access for automated ranking data

To pull Search Console data into `/admin/business`:

1. Google Cloud Console → create a project "STS Futures"
2. Enable the Google Search Console API
3. Create a service account → download JSON key
4. In Search Console → Settings → Users → **Add user** → paste the service account email
5. Set env var on Manus: `GSC_SERVICE_ACCOUNT_JSON=<contents of downloaded JSON>`

Once that's set, we can add a tRPC endpoint that pulls impressions, clicks, and avg position per query and renders in the admin dashboard. Ask when you're ready.

## 2. Bing Webmaster Tools (3 min)

Bing feeds Microsoft Copilot — ranking in Bing search = showing up in Copilot answers.

1. Sign in: https://www.bing.com/webmasters (use rgorham369@gmail.com)
2. **Import from Google Search Console** (the fast path) → click "Import" → sign in with Google → pick `stsdashboard.com` → done
3. OR add it manually:
   - "Add a site" → enter `https://stsdashboard.com`
   - Verify via XML file, meta tag, or DNS TXT record (meta tag is simplest)
   - If meta tag, paste `<meta name="msvalidate.01" content="XXXX">` into `client/index.html` and push a PR
4. Submit the sitemap: Sitemaps → "Submit sitemap" → `https://stsdashboard.com/sitemap.xml`
5. Check **Site Explorer** for indexed page count after 24-48 hours

## 3. IndexNow (already wired)

IndexNow pushes URL updates to Bing, Yandex, Seznam, Naver, and other participating search engines within minutes (vs waiting days for traditional re-crawl).

**Already configured in this branch:**

- Key file at `client/public/27bf73846907f0327d3d188a1f9b8b64.txt`
- `.well-known/indexnow` alternate key location
- The key itself: `27bf73846907f0327d3d188a1f9b8b64` (rotate anytime; both files must match)
- Server endpoint already exists at `server/indexNow.ts` that can be triggered via `trpc.indexNow.submit` (admin only)

**What's left:**

Set this env var on Manus so the existing server can auth with IndexNow:
```
INDEXNOW_KEY=27bf73846907f0327d3d188a1f9b8b64
```

Then, any time a new blog post or major content update ships, run this (via admin dashboard OR direct API call):
```
POST /api/trpc/indexNow.submit
```

The server submits the updated URLs to Bing + Yandex automatically. Bing typically re-crawls within 1 hour.

## 4. Rank tracking — free options

Once Search Console is pulling data, you have free ranking data for queries we ALREADY rank for. For queries we don't rank for yet (important for knowing what to target), these are the free or cheap options:

- **Google Search Operator method** (totally free) — once a week, search `site:stsdashboard.com` + various keywords in an incognito window. Records approximate rank. Good enough to start.
- **SerpRobot** — free tier: 5 keywords tracked daily, upgrade $5/mo
- **RankActive** — free trial then $29/mo
- **Semrush / Ahrefs** — $99-200/mo, overkill until traffic is real

Recommendation: wait 30 days after Search Console is active; use its data first. Add a paid tracker only if we find keywords we want to monitor that Search Console doesn't surface.

## 5. Verification — run this checklist after each step

```
✓ Search Console: stsdashboard.com verified, sitemap submitted, no security issues
✓ Bing Webmaster: stsdashboard.com imported, sitemap submitted
✓ IndexNow key file accessible at https://stsdashboard.com/27bf73846907f0327d3d188a1f9b8b64.txt (text match exactly)
✓ IndexNow well-known accessible at https://stsdashboard.com/.well-known/indexnow (text match exactly)
✓ INDEXNOW_KEY env var set on Manus
✓ robots.txt includes "Sitemap: https://stsdashboard.com/sitemap.xml" line (✓ already does)
✓ sitemap.xml lists all indexable routes + blog posts (✓ updated)
```

Once all six checks pass, you're fully wired to the three biggest free SEO/AEO crawl sources: Google, Bing (→ Copilot), Yandex.

## 6. What NOT to do

- Don't submit the same URL via IndexNow more than 10,000 times/day (rate limit)
- Don't submit pages you don't want indexed (admin, auth, checkout)
- Don't fabricate schema markup (Google delists sites that do this)
- Don't request re-indexing of every page after every minor change — save it for meaningful updates

## 7. Expected timeline

| After | Expectation |
|---|---|
| 24 hours | Search Console shows sitemap submitted + first coverage data |
| 48 hours | Bing Webmaster shows first crawl data |
| 72 hours | IndexNow-submitted URLs appear in Bing + Copilot |
| 2 weeks | First meaningful impressions data in Search Console |
| 4-6 weeks | Keyword-to-page ranking positions stabilize for your strongest queries |
| 3 months | Blog content starts ranking for long-tail educational queries |
| 6 months | E-E-A-T authority (author page + consistent posts) starts paying off in competitive keywords |
