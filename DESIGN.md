# Revenue recovery — journal direction

Reference: https://lovable.dev/templates/apps/lifestyle/journal (working journal and Insights screens inspected).

- Backdrop: fixed, soft brown/lilac radial gradients fading into a dark charcoal top. No raster background or copied assets.
- Surfaces: #24232a floating panels, subtle translucent borders, restrained shadows, 15–18px corners.
- Type: Avenir Next/system sans, modest headings, readable financial tables and tabular amounts.
- Accent: #ab86eb purple for explicit actions, selections and chart bars. Green only for confirmed paid rows.
- Navigation: a compact floating horizontal bar with icon navigation on phones.
- Overview: collection-performance panel, supporting figures, and clickable monthly journal cards. Each month still opens the complete paginated payment trail.
- Queue: invoice table alongside the explicit collection console. Saved-card counts and paid states stay visible.
- Dates: one shared range button opens a draft-only dialog with presets, two desktop calendars, a single navigable mobile calendar, manual inputs inside the dialog, Clear, Cancel and Apply. Day calculations use calendar arithmetic; all filters use New York dates. Applying dates only reads payments.
- Preview routes use explicitly labeled fictional data. Live collection handlers are disabled in previews and fixtures reject mutations. Production payment logic is unchanged.
