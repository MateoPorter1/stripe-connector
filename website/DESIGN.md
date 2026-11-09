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

## Continuous kinetic centerpiece

The hero now uses a larger perspective-camera installation with continuous rotation, floating invoice motion, subtle cloud drift, a moving payment token and gentle pointer-responsive camera-plane tilt. The wheel illustrates the available saved-card pool; it no longer pauses for a simulated transaction. The separate interactive invoice example still explains stop-on-success behavior.

Lighting uses a bundled studio environment for rounded specular highlights. Saturated cyan sky, emerald terrain and vivid orange lift the scene closer to the reference's lively miniature aesthetic. The hero message sits on the same deep-green color field, with a broad curved transition into the story content. Motion still pauses offscreen, on hidden tabs, on request, and by default for reduced-motion preferences.

## Art-directed layered hero

The procedural hills and WebGL clay approximation have been replaced with three original image-generated assets: a sculpted landscape, transparent six-card rotor, and ceramic support. Their strong directional lighting, ceramic surface detail, saturated colors and contact shadows are baked into the artwork. The independent rotor turns continuously inside a perspective plane; pointer response adds restrained parallax. This is layered rendered artwork, not a claim of a live 3D model. No WebGL or Three.js runtime is needed. Pause, reduced motion, offscreen and hidden-tab controls remain in place.

Generated with the built-in image tool, then converted to WebP without visual edits. Prompts: landscape uses an empty central area, emerald sculpted hills, cyan textured sky, left invoice and right success dish; rotor uses six radial saved cards with gold chips on an ivory disc and tangerine rim; support uses a ceramic A-frame and fixed pointer. Source originals stay in the Codex generated-images folder; production assets are in website/assets/rebound-{landscape,rotor,support}-v3.webp.


## Wheel color iteration

Color-only edit of the wheel using the user's Clay screenshot as the palette reference. Cyan blue #169aca, golden orange #ed971c, turquoise #08a5a0, buttery yellow #f4ce79, lime #b1c84c, pink #e948b0, warm ivory #ede8c7. These are base-paint targets; highlights and shadows vary. The existing landscape, support, geometry, page colors and motion remain unchanged. Built-in image generation edit; asset assets/rebound-rotor-v4.webp.

Prompt: Preserve the existing transparent six-card wheel's geometry, positions, chip details, texture, bevels, camera, lighting and alpha silhouette. Change only the surface colors to the Clay reference: cyan pipe blue, orange track, turquoise pencil support, buttery wooden-bar yellow, yellow-green braided beam, pink sphere and ivory funnel. Preserve realistic highlights and shadows instead of applying flat hex fills. No new shapes or background.

## Centered headline experiment

Remove the wheel and its controls from the homepage. Place the existing headline at the center of the landscape, framed by the invoice on the left and the success dish on the right. Explanation and CTA sit directly below. A soft cream atmospheric gradient keeps the text readable. The wheel artwork is retained in source for comparison, but no wheel assets or wheel script are loaded by the homepage. Mobile uses a single centered column.

## Original payment workshop backdrop

Replace the outdoor green hills, trees and cyan sky with an original warm ivory studio still life. A ceramic invoice and blue/turquoise cards sit at left; a terracotta recovery ribbon leads along the bottom to an arch and payment-success tray at right. Empty center preserves the headline's focus. The rest of the page stays unchanged. On mobile the full artwork sits below the text instead of cropping away the product objects.

Built-in image generation; production asset assets/rebound-workshop-v1.webp. Prompt: premium tactile miniature payment workshop, warm ivory studio and matte stone floor, empty central 52% for HTML text, invoice and blue/turquoise saved cards at left, orange conveyor ribbon along bottom to a sculpted arch and lime payment token in a cream success tray at right. Satin ceramic, fine stipple, strong natural contact shadows. No hills, trees, grass, sky, clouds, wheel, text or logos.

## Approved ceramic wordmark

User selected direction01 from the five-wordmark study. The website header and footer now use the orange ceramic lowercase rebound wordmark with no separate icon. A transparent asset was extracted using the built-in image editing tool, trimmed and converted to WebP for delivery. Production file: assets/rebound-wordmark-ceramic.webp. Organization structured data points to this wordmark. App branding is unchanged.

Prompt: extract only the first approved orange ceramic rebound wordmark from the concept board, preserving its letterforms, spacing, texture, lighting and proportions; remove labels, other rows, backdrop and floor; transparent background including letter counters; no new icon or redesigned type.

## Complete public-site identity

Every public page now uses the approved ceramic wordmark and a shared warm ivory / forest green / orange design system. Resource cards, topic filters, article layouts, contents navigation, calculator, product demonstration, CTAs and footer follow the homepage direction. Guides keep quiet reading surfaces and practical line lengths; the calculator keeps strong contrast and unchanged formulas. Browser favicon now uses a rounded orange r rather than the previous layers icon. The social preview uses the approved wordmark and studio artwork. The Stripe application is outside this marketing-site iteration.

## Ceramic recovery demonstration

Replace the CSS-drawn invoice, pale cards and dashed line with original rendered artwork in the hero's ceramic material language. The illustration shows an invoice and three saved cards connected by an orange conveyor ribbon. Labels and state text stay live HTML underneath. The existing demonstration button still advances the second card to paid and the third to not needed, and can replay without making any payment requests. Mobile uses a compact illustration above a readable two-column station list. Artwork always preserves its 3:1 aspect ratio.

Built-in image tool, reference rebound-workshop-v1.webp. Production asset assets/rebound-recovery-sequence.webp. Prompt: exact hero ceramic materials and studio lighting; panoramic left-to-right invoice, blue saved card, turquoise saved card and butter-yellow saved card, all on a continuous orange sculpted ribbon, warm ivory background, no baked-in labels or statuses, no text or logos. Significant physical depth, gold chips and contact shadows.

## Warm neutral typography and trial action

Replace the hero's green headline with warm charcoal #302b27 and supporting copy with brown-gray #70665d. Headline: Recover your failed Stripe payments. Self-hosted Manrope Latin variable font replaces Inter for site typography, with a heavier rounded-grotesk hero and comfortable line height. The ceramic logo remains unchanged. Header and primary hero/footer actions say Start free trial and link to the existing signup page; no trial duration is invented. The second hero button says See how it works and links to the local recovery example. Bright orange remains the primary action color, with generous rounded corners and horizontal arrows inspired by the reference's button proportions. Manrope is supplied by Google Fonts with its OFL license stored in assets/Manrope-OFL.txt.

## Site-wide neutral typography

Manrope is now explicit for all public-site text and form controls. Existing green/blue text declarations have been consolidated into charcoal #302b27 for headings and strong type, brown-gray #70665d for supporting copy, and warm ivory for text on dark panels. Calculator results use a charcoal background. Orange buttons and orange link accents are retained; payment success/failure badges retain their semantic colors. This applies to the full public website, not the authenticated Stripe app.
