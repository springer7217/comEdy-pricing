# ComEd Pricing - Project Documentation

## Overview
ComEd Pricing is a mobile-first Progressive Web App (PWA) for tracking ComEd hourly electricity pricing and reviewing bill performance over time.

The app has two primary surfaces:
- **Live Prices**: real-time price, trend chart, recent readings, and quick time filters.
- **My Bills**: summary scorecards, season filtering, bill history cards, and a detail modal.

Live site: https://comed-pricing.netlify.app

## Current Architecture
The app is intentionally simple and static-host friendly:

- `index.html` - page structure, sections, and UI mount points
- `styles.css` - visual system, card styles, animations, and responsive polish
- `app.js` - Supabase data queries, rendering, filtering, animations, and modal behavior
- `manifest.json` - PWA metadata

### Runtime dependencies (CDN)
- Tailwind utility runtime (`cdn.tailwindcss.com`)
- Supabase JS v2 (`@supabase/supabase-js@2`)
- Chart.js

## Feature Summary

### Live Prices
- Current hourly price ("NOW") with status emoji.
- Animated numeric transitions with slot-style rolling digits.
- 24-hour stat cards: AVG, HIGH, LOW.
- Filter ranges: `6h`, `12h`, `24h`, `7d`, `30d`.
- Chart.js line chart.
- Recent readings list with load-more pagination.

### My Bills
- Summary cards:
  - Total Bills
  - Total Spent
  - Avg Effective Rate
  - Avg vs Market
  - Total Supply Spend
  - Total Delivery Spend
- Bill history cards with key metrics and badges.
- Season chips (All/Spring/Summer/Fall/Winter) that filter:
  - bill list
  - summary scorecards
- Bill detail modal with:
  - total kWh + total due
  - supply/delivery/taxes breakdown
  - effective rate + vs market
  - season/credits badges

## Navigation and Interaction Model
- Bottom sticky tab bar for app-like mobile navigation between Live Prices and My Bills.
- Tab switches use fade transitions.
- Number cards animate on update, then settle to static text for readability and clipping safety.
- Bill modal is explicitly closed on app load/page restore to prevent stale open state.

## Data Layer (Supabase)

### Price source
- Primary table: `comed_prices`
- Typical fields used:
  - `price`
  - `recorded_at`

### Bills source
- Candidate main bill tables (queried in order):
  - `bills`
  - `comed_bills`
  - `bill_history`

- Candidate detail tables used for enrichment:
  - `bill_details`
  - `bill_line_items`
  - `bills_details`
  - `bill_breakdown`

The app normalizes schema differences by trying multiple field aliases (dates, totals, rates, seasonal tags, breakdown values) and then rendering from normalized bill objects.

## Important Behavior Notes
- Season filtering derives season from date if a direct season field is missing.
- `Avg vs Market` falls back to computed `effective_rate - market_avg_rate` if direct diff fields are missing.
- Bill detail hydration is asynchronous so base summaries can render quickly, then enrich when detail rows are found.

## Environment and Access Requirements
- Supabase anon key must be valid.
- Public read permissions (RLS policies) must allow select access for pricing and bill tables used by the app.
- Netlify deployment origin should be allowed in Supabase project settings when required.

## Development Guidelines
- Keep UI mobile-first and card-based.
- Favor targeted, low-risk changes over broad refactors.
- Preserve smooth animations, but prioritize readability and unclipped data rendering.
- Gracefully handle missing/partial backend fields.
- When changing data mappings, keep normalization centralized in `app.js` helpers.

## Known Follow-ups
- Continue tuning bill-detail field mapping as more Supabase schema variants are discovered.
- Add explicit empty-state/placeholder UX for season filters when no matching bills exist.
- Consider extracting bill normalization and mapping into a dedicated module if logic grows further.
