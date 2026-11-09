# Rebound website direction

White #ffffff, ink #26313a, slate #65737f, brand orange #ff6b1f, orange tint #fff3eb, divider #e5e9ed. Self-hosted Inter regular, medium and semibold matches the app; tight large headings give the marketing site a distinct voice. Keep text and links legible instead of using orange for long body copy.

Layout: a broad left-aligned promise alongside a visible invoice/card sequence, then a quiet evidence strip, a product explanation, the three actual recovery steps, related resources, and FAQs. On mobile, keep promise and CTA first, then show the card sequence. Avoid invented social proof and performance guarantees.

The main visual is the actual product concept: card 1 declines, card 2 pays the original invoice, card 3 is unnecessary. Label the fictional example. The boldness lives in the hero typography and product demonstration, not animated decoration. No hero stock photography is needed.

SEO: fully generated static HTML, one purpose per URL, canonical root domain, auto sitemap, Article and breadcrumb data on guides. Source entries and editorial workflow in content/guides.json and README.md. App is independently hosted and excluded from indexing.

## Visual story iteration

The homepage now opens with an original tactile payment-recovery landscape: closed gate at the first card, an orange path through a second card and an open green gate. Pale sky and mint base lead into a large direct headline, then a familiar billing conversation and an interactive invoice/card sequence. Clay is the reference for clarity, craft and visual explanation; the artwork, copy and product narrative are Rebound-specific.

The interactive example is entirely local, explicitly illustrative, and never calls a payment API. Its button advances a demonstration from declined first card to paid second card; it can be replayed. No time-based automatic motion. Resources and SEO page generation stay intact.

## Upright card wheel

Replace the fixed track with an actual rotating six-card wheel. A fixed pointer selects the card at the top, while each pastel card stays upright as it moves around the sculptural orange rim. Stand, invoice, soft sky, hills and fine grain carry forward the visual language of the hero artwork. The wheel is rendered in HTML/CSS so the movement is real and responsive, not a looping flat video.

Each illustrative invoice has a declined card followed by a successful card. The wheel stops on success before the loop starts a new example invoice. This is a local demonstration, not random selection in the real product. Motion pauses on request, when the hero is offscreen or the tab is hidden. Reduced-motion preferences start the scene paused; a visitor can deliberately play it.

## Sculptural depth and continuous page flow

The wheel is now rendered in Three.js: actual extruded rounded cards and chip tiles, a thick rim, raised hub, freestanding supports, geometry-based hills, rough material bump maps, and fine surface grain. The assembly is angled about 28 degrees so the thickness reads immediately. Motion follows the existing local demonstration state and pauses with the existing control. A static illustration remains available if WebGL cannot render. The renderer is bundled locally; no runtime CDN is required.

The homepage uses soft color transitions from sky to mint to warm white, fewer section rules, and broad rounded color fields. The layout and message flow continuously rather than as isolated stacked panels.
