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
