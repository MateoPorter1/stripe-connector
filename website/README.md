# Rebound public website

Public website: https://reboundmrr.com
Application: https://app.reboundmrr.com

## Build and check

Run `npm run build` followed by `npm run check` from this folder. This static builder produces complete HTML pages in `dist/`. No browser JavaScript is required to read any product page or guide. JavaScript enhances the menu, topic filters, calculator, and local illustrative card-recovery example. The approved ceramic wordmark is shared by every page; the studio hero preserves the artwork’s natural aspect ratio.

## Publishing a guide

Add an entry to `content/guides.json` using the existing schema. Use a unique lowercase URL slug, a distinct title and description, the actual publication/update date, a topic, a direct answer, useful sections, and primary sources. Section bodies support trusted editorial HTML. Do not put external unreviewed input into the builder. Add contextual links to related articles. Review the generated page and references before publication.

The resource index, related links, sitemap, canonical URLs, Article data, and breadcrumbs are generated automatically. Do not bump update dates without meaningful content changes. Draft content should remain outside `guides.json` until reviewed. Never invent performance metrics, customer quotations, compliance claims, or rankings.

The calculator is an illustrative revenue model. It makes no network requests with user inputs and does not forecast Rebound results.

## Hosting

Dedicated Vercel project `rebound-website`. Deploy this folder, not the application root. Keep `app.reboundmrr.com` on the original `stripe-connector` project. Root and www belong to the website; www redirects permanently to the canonical root.

Search Console verification requires access to the owner’s Google property. No verification or index submission should be claimed until the property and submitted sitemap are confirmed.

## SEO publishing system

The library contains 16 focused guides across three crawlable topic hubs, plus the Porter Metrics customer example. `knowledge.mjs` renders these pages from `content/guides.json`. Existing article URLs are preserved. All substantive content and internal links are in the initial HTML, independent of JavaScript. Library search only changes visibility in the browser; it does not create thin search-result URLs.

Each guide requires a distinct intent/keyword, SEO title, description, direct answer, sections, publication date, meaningful update date, source-check date, primary references, and explicit related slugs. `validate-content.mjs` rejects incomplete records, duplicate slugs/titles/descriptions, future dates, unsafe section HTML, and invalid related links. New content should add a useful answer or original operational example rather than target synonyms with duplicate pages.

`npm run build` now includes the SEO check as a deployment gate. It checks every public page, internal link and fragment, unique metadata, canonical URL, article JSON-LD, sitemap coverage, incoming links, crawler access, feed entries, and initial-HTML answers. A bad content record or broken destination fails the build before publication.

The system emits `/sitemap.xml` with meaningful last-modified dates, `/feed.xml` for article subscriptions, and `/content-manifest.json` as a machine-readable publication inventory. The manifest is not a search performance report. No search-volume or ranking estimates are fabricated. The app remains separate and noindex.

Source standards and limitations are public at `/editorial-policy`; organization information is at `/about`. Do not add fake reviews, aggregate ratings, professional reviewer claims, or software prices/trial terms without evidence. Preserve the approved brand and avoid loading interactive assets on editorial pages unless used.

Search Console ownership and sitemap submission must be confirmed in the actual property before calling them complete. Website publication, crawler accessibility, Google indexing, and Google rankings are four different states.

## Google Analytics 4

Create a GA4 web data stream for `https://reboundmrr.com`. Set `GA4_MEASUREMENT_ID` in the Vercel `rebound-website` project environment to its `G-...` Measurement ID, then redeploy. The build includes the Google tag on every website page when this variable is set; without it, no Analytics code is included. Invalid IDs fail the build. This only tracks the public website. Verify collection in Google Analytics Realtime after deployment.

## Funnel events

Public website: `signup_click` and `login_click` distinguish destination and CTA placement; `select_content` identifies guides/customer stories; `calculator_start` fires once after editing, `calculator_result` on a valid changed result; `recovery_demo_start` and `recovery_demo_replay` separate the first demo interaction from repeats; `resource_filter` records a selected topic. No calculator values or search terms are sent. Defaults do not count as calculator usage.

The application uses `REACT_APP_GA4_MEASUREMENT_ID` for public signup/login page views, `signup_start` on first form focus, `sign_up` only after successful account creation, and `login` only after successful authentication. These events contain no names, emails, passwords, customer IDs, recovery amounts or error messages. URL queries are excluded from explicit page locations. Events are optional and cannot block authentication. Cookies are shared across reboundmrr.com subdomains by the Google tag. A CTA click is not a trial activation or completed signup.

`sign_up` is registered as a GA4 key event for the acquisition conversion, counted once per event with no invented monetary value. Do not mark signup clicks or logins as acquisition conversions. Registered GA4 event-scoped dimensions: `cta_location`, `destination_path`, `content_type`, `item_id`, `topic`, `tool_name`.

Enhanced measurement keeps page loads, scrolls, outbound clicks, video and downloads. Automatic history page views, form interactions and URL-based site search are disabled: authentication views and form outcomes are measured explicitly, and raw search strings are not collected.
