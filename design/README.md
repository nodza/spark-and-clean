# Handoff: Spark & Clean platform

## Overview
Spark & Clean is a rug, carpet and upholstery cleaning business operating in Gauteng, South Africa. This package contains the full set of design mockups for the platform: a public marketing site, a customer booking flow and portal, an internal operations (admin) console, a technician field app, and transactional email templates.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behaviour, not production code to copy directly. The task is to **recreate these designs in the target codebase** (React + Tailwind) using its established patterns and component libraries.

Each file is a self-contained HTML page: open it in a browser to see and click through the design. Some screens have an in-page preview tab bar at the top for switching between sub-screens — that bar is a prototyping aid and is **not part of the product UI**.

`Design Reference.dc.html` is the starting point: it indexes every screen and lists all design tokens with click-to-copy values plus a ready Tailwind config block.

## Fidelity
**High-fidelity (pixel-perfect spec)** for everything except `Wireframes.dc.html`, which is low-fidelity structural exploration kept for context only. Colours, type, spacing and states in the hi-fi files are final — match them exactly.

## Stack
React + Tailwind. Font is **Inter** (weights 400–900) via Google Fonts. No icon library is assumed — icons in the mockups are inline 24×24 stroke SVGs (stroke-width 2, `currentColor`, round caps); Lucide React is the closest match and is a fine substitute.

## Screens

| File | Audience | Purpose |
|---|---|---|
| `Landing Page.dc.html` | Public | Homepage — hero, services, how it works, pricing, booking CTA |
| `Landing Page - Site Style.dc.html` | Public | Alternate landing treatment matched to the existing site |
| `Booking Flow.dc.html` | Customer | Multi-step quote/booking wizard with live pricing |
| `Client Portal.dc.html` | Customer | Order history, live tracking, invoices, profile |
| `Auth.dc.html` | Customer | Sign in, sign up, password reset |
| `Admin Portal.dc.html` | Internal | Operations console — dispatch, bookings, clients, technicians, pricing, reports |
| `Technician Portal.dc.html` | Field | Job list, route, on-site capture and status updates |
| `Transactional Emails.dc.html` | Comms | Confirmation, status-change and invoice email templates |
| `Wireframes.dc.html` | Reference | Lo-fi structure and flow exploration |

Read each file's markup for exact copy, ordering and per-element values. The tokens below cover everything shared across screens.

## Design tokens

### Colour
| Token | Hex | Use |
|---|---|---|
| navy | `#000b49` | Primary surface (sidebar, feature panels), headings, primary button |
| teal | `#6cf3d5` | Accent, active nav, progress fill, eyebrow text on navy |
| yellow | `#ffdc39` | Counts, highlight badges, attention |
| green | `#0a7a63` | Links, inline text actions, success text, toggle-on |
| ink | `#32373c` | Body text |
| grey-600 | `#6b7280` | Secondary text |
| grey-400 | `#9aa0a6` | Meta text, labels, placeholders |
| line | `#e3e7ed` | All 1px borders |
| rule | `#f0f2f6` | Inner dividers, disabled fills |
| surface-head | `#f7f9fb` | Table header rows |
| surface-page | `#f5f7fa` | App background |
| white | `#ffffff` | Cards, top bar |
| success-bg / border | `#eafaf5` / `#bfe9dc` | Success badge |
| info | `#2c4fa6` | Collected / in-transit |
| error | `#d64545` | Validation, destructive |

### Typography (Inter)
| Role | Size / weight / tracking |
|---|---|
| Display | 40px / 900 / -0.02em |
| Page title | 26px / 800 |
| Section heading | 22px / 800 |
| Card title | 15px / 800 |
| Body | 13.5px / 600 |
| Meta | 12.5px / 500 |
| Eyebrow / label | 10.5px / 800 / 0.14em, uppercase |
| Table header | 10.5px / 800 / 0.08em, uppercase, `#9aa0a6` |

Numeric columns use `font-variant-numeric: tabular-nums`.

### Spacing
4px base. Page gutter 32px · card padding 20–22px · grid gap 14px · table row padding 14px 22px · sidebar nav padding 18px 12px.

### Radius
Pill `999px` · card `14px` · control/input `10px` · nav item `9px` · chip `8px`.

### Elevation
Cards use a 1px `#e3e7ed` border and no shadow. Raised: `0 4px 16px rgba(0,11,73,.06)`. Overlay/modal: `0 18px 48px rgba(0,11,73,.18)`.

## Components

**Buttons** — pill (`999px`), weight 800. Primary: 12px 26px, `#000b49` on white text, hover `#0a1a6b`. Accent: `#6cf3d5` on navy text, hover `#4fe4c4`. Secondary: white, 1px `#e3e7ed`, navy text, hover border `#9aa0a6`. Small: 9px 16px at 13px. Disabled: `#f0f2f6` fill, `#9aa0a6` text. Transition `.15s`.

**Text actions** — 12.5px / 700 in `#0a7a63`, hover `#000b49`.

**Status badges** — padding 5px 11px, radius 999px, 10.5px / 800, letter-spacing .04em:
New `#fff7d1`/`#8a6d00` · Collected `#eef2ff`/`#2c4fa6` · In cleaning `#eafaf5`/`#0a7a63` · Out for delivery `#e6fbf6`/`#046b57` · Completed `#f0f2f6`/`#6b7280` · Overdue `#fdecec`/`#b33232`. Each has a matching 1px border one step darker than the fill.

**Inputs** — 12px 14px, radius 10px, 1px `#e3e7ed`, 13.5px text. Focus: border `#6cf3d5` + `0 0 0 3px rgba(108,243,213,.25)`. Error: border `#d64545` with a 12px / 600 message below. Search fields are pills on `#f5f7fa`.

**Toggle** — track 38×22 radius 999px, knob 16px white with 3px inset; on `#0a7a63`, off `#d8dde4`, transition `.18s`.

**Cards** — white, 1px `#e3e7ed`, radius 14px, padding 20–22px. Header row inside a card: padding 18px 22px with a 1px `#f0f2f6` bottom rule.

**Tables** — CSS grid rows with explicit column templates and `min-width` for horizontal scroll. Header on `#f7f9fb`; rows separated by 1px `#f0f2f6`; row hover `#f7f9fb`; row padding 14px 22px.

**Sidebar (admin & technician)** — width 246px, background `#000b49`, section dividers `1px rgba(255,255,255,.09)`. Nav item: padding 10px 13px, radius 9px, 13.5px, 3px gap between items, 17px icon. Active: `#6cf3d5` fill, `#000b49` text, weight 800. Inactive: transparent, `rgba(255,255,255,.72)`, weight 600. Badge on nav item: `#ffdc39` pill, navy text, 10.5px / 800.

## Interactions & behaviour
- Nav and tab switching is client-side; the active screen is component state.
- Booking flow is a stepped wizard: each step validates before advancing; the price summary recalculates on every selection change and stays visible.
- Admin booking detail opens from a row click and shows technician assignment plus a status list — selecting a status updates the badge and enables "Notify client".
- Pricing/services rows have inline visibility toggles that control what appears on the public booking form.
- Transitions are `.15s`–`.18s` ease on colour, background and border. No entrance animations.
- Maps are embedded frames (`map-admin.html`, `map-tech.html`) — replace with the real mapping provider; keep the container size and 14px card radius.

## State
Per screen: active screen/tab, selected record id, wizard step + form values, filter and search strings, status selection, toggle states. All local component state in the mockups — wire to the real API in implementation.

## Assets
- Logo: `uploads/spark-and-clean-22.png` (transparent PNG, dark oval — sits directly on navy or white, no plate behind it).
- Icons: inline SVG in the mockups, 24×24 viewBox, stroke 2, `currentColor`.
- Photography: image placeholders in the marketing pages — real photography still to be supplied.

## Files in this bundle
All `*.dc.html` screen files listed above, plus `Design Reference.dc.html` (token + component reference), `support.js` and `image-slot.js` (runtime helpers needed to open the mockups in a browser), `map-admin.html` / `map-tech.html`, and `uploads/` assets.
