# Rebound public website

Public website: https://reboundmrr.com
Application: https://app.reboundmrr.com

## Build and check

Run `npm run build` followed by `npm run check` from this folder. This static builder produces complete HTML pages in `dist/`. No browser JavaScript is required to read any product page or guide. JavaScript enhances the menu, topic filters, calculator, and illustrative 3D wheel. Three.js is bundled locally by esbuild; the wheel pauses offscreen and respects reduced-motion preferences. WebGL failures retain the static illustration.

## Publishing a guide

Add an entry to `content/guides.json` using the existing schema. Use a unique lowercase URL slug, a distinct title and description, the actual publication/update date, a topic, a direct answer, useful sections, and primary sources. Section bodies support trusted editorial HTML. Do not put external unreviewed input into the builder. Add contextual links to related articles. Review the generated page and references before publication.

The resource index, related links, sitemap, canonical URLs, Article data, and breadcrumbs are generated automatically. Do not bump update dates without meaningful content changes. Draft content should remain outside `guides.json` until reviewed. Never invent performance metrics, customer quotations, compliance claims, or rankings.

The calculator is an illustrative revenue model. It makes no network requests with user inputs and does not forecast Rebound results.

## Hosting

Dedicated Vercel project `rebound-website`. Deploy this folder, not the application root. Keep `app.reboundmrr.com` on the original `stripe-connector` project. Root and www belong to the website; www redirects permanently to the canonical root.

Search Console verification requires access to the owner’s Google property. No verification or index submission should be claimed until the property and submitted sitemap are confirmed.
