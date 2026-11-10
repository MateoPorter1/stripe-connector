# Revenue recovery product interface

Current direction: shared Rebound website/app identity with warm ivory surfaces, bright #ff6a00 actions, charcoal headings, brown-gray supporting text, self-hosted Manrope, and the approved orange ceramic wordmark.

References inspected: Linear's March 2026 interface refresh (https://linear.app/now/behind-the-latest-design-refresh), Mercury Insights (https://mercury.com/insights), Ramp product overview (https://ramp.com/products). Apply their general principles of predictable action placement, subdued navigation and readable financial data without copying branding or layouts.

- Navigation: approved horizontal product bar, Collections and Insights as primary destinations, and account menu for Stripe settings, admin access and sign-out.
- Overview: open four-column financial summary, performance chart beside a dense monthly ledger. No invented trend comparisons.
- Data: Inter and tabular figures, clear amount alignment, secondary text with readable contrast. Customer and invoice appear together to reduce table columns.
- Accent: #ff6b1f with dark labels for explicit actions and selected controls; soft orange for calm selection. Green remains reserved for confirmed payments.
- Dates: shared draft-only range panel with presets, calendars, manual entries inside the panel and explicit Apply. New York calendar dates and inclusive filters stay unchanged.
- Preview: clearly labeled sample data, real collection actions disabled. Existing payment execution and traceability are preserved.

## Collections desk alternative

The preview now opens the operational collections screen, not a dashboard. A horizontal product bar switches between Collections and Insights. The collection amount and single retry action sit above a full-width invoice list. Customer buttons open a read-only detail drawer. Insights retains the analytical charts and month-to-payment traceability. All existing date selection and payment execution guards remain intact; the preview cannot collect real money.

Final polish retains the white/bright-orange identity. Amounts use exact currency parts with quieter cents; the selection graphic uses actual visible invoice counts. Row dates explicitly show New York time, and row actions reveal a floating invoice drawer. User-triggered transitions respect reduced-motion settings.

## Shared website and app identity — November 2026

CeramicApp.css is the final app theme. It covers Collections, Insights, invoice details, date selection, authentication, settings, and admin. Authentication uses the approved studio illustration at its original 3:1 ratio. Payment outcomes keep semantic colors: confirmed paid rows green, review states neutral, destructive actions red. Branding changes do not alter scanning, date logic, collection execution, account permissions, or API-key handling.

Validation: production build and 23 existing tests across Collections, Insights, navigation, and date ranges. Visual checks use isolated demo routes with live collection disabled.
