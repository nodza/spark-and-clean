# Spike: WhatsApp Booking Integration Strategy

**Audience:** Noel (Product Lead) and Spark & Clean leadership  
**Date:** 31 August 2026  
**Author:** Product / Engineering  
**Status:** Interim decision locked for engineering (Option B). Countersignature requested.  
**Related:** E2 self-service booking wizard, SC-101 homepage explainer, Phase 2 WhatsApp Business notifications.

---

## 1. Why this spike exists

The live WordPress site treats **WhatsApp** and the **online quote form** as equal booking channels. Step 2 of “Booking is as easy as 1-2-3” still says:

> Contact us with the measurements by sending a quick message on WhatsApp or by filling out our online booking form.

The new platform introduces **E2** — a five-step self-service wizard (`/book/rug`) with rug type, size calculation, photos, address, estimated price, and collection scheduling. That flow writes the **only** booking records the admin dashboard and technician app can operate on.

If WhatsApp remains an equal booking channel, we must answer:

1. How does a WhatsApp conversation become a row in MongoDB?
2. Who owns quoting, slot capacity, and photos when the customer never used E2?
3. What does the homepage tell people to do?

This paper compares three options, recommends one, and locks an **interim** workflow so SC-101 and E2 are not blocked on a meeting.

---

## 2. Baseline at spike start (31 Aug 2026)

| Surface | What existed |
| :--- | :--- |
| **E2 wizard** | Full booking create path. Writes to `/api/bookings` → MongoDB. Size, photos, slot, price estimate. |
| **Admin dashboard** | List, status, payment, driver assign. **No “create booking” form.** Staff cannot transcribe a WhatsApp job without using E2 themselves. |
| **Booking schema** | No `source` field (`online` / `whatsapp` / `admin`). |
| **WhatsApp Business API** | Not integrated. Project summary places it in **Phase 2 notifications**, not intake. |
| **Homepage How it works** | WordPress copy: WhatsApp **or** online form, then “we’ll get back to you with a quote”. |
| **Floating control** | Prototype AI quote bot (`ChatFAB`) — a third competing quote channel. |
| **Contact / footer** | Phone and email only. No WhatsApp. |
| **South African habit** | Customers still message WhatsApp. That will not stop because we change a website. |

**Implication:** Keeping WhatsApp as an *equal booking channel* is not “leave the buttons”. It is a new product: either manual admin intake or a WhatsApp-to-API pipeline. Neither exists.

---

## 3. Options

### Option A — Parallel booking channels (WhatsApp = E2)

Customers may complete a booking entirely on WhatsApp. Operations either:

- **A1.** Manually re-key name, phone, size, suburb, and slot into a (not yet built) admin create form, or  
- **A2.** Integrate WhatsApp Business API so messages become bookings automatically.

| | |
| :--- | :--- |
| **Customer** | No behaviour change. Familiar. |
| **Ops** | Dual intake. Incomplete jobs (missing photos, area m², add-ons, geo). Slot conflicts. Quote inconsistency vs E2 calculator. |
| **Engineering** | A1 needs admin create + training. A2 is a Phase 2+ project (Meta Cloud API, templates, media, session state, field parity with E2). |
| **Data** | Two sources of truth until sync is perfect. Analytics and routing degrade. |
| **Risk** | E2 investment is optional for the customer; conversion to “tech-enabled” stalls. |

**When to pick A:** Leadership explicitly wants WhatsApp-first acquisition to outrank operational consistency in Phase 1.

### Option B — E2 primary; WhatsApp is support only *(recommended)*

The **only** way a booking enters the database is E2 (customer self-serve, or staff completing E2 **on the customer’s behalf**).

WhatsApp stays in the product as:

- Questions before booking (“Do you clean kilims?”, “Do you serve Fourways?”)
- Help finishing the online form
- Later: status notifications (Phase 2 API — *outbound*, not intake)

| | |
| :--- | :--- |
| **Customer** | Homepage and CTAs teach one path: book online. WhatsApp still answers humans. |
| **Ops** | Single playbook: send `/book/rug`, stay on the thread for help, or fill E2 for the customer and reply with the booking ID. |
| **Engineering** | No WhatsApp→DB sync for MVP. Copy + support entry points only. |
| **Data** | Every job has size, price band, slot, and (usually) photos. Admin and tech apps work. |
| **Risk** | Short-term “but I always WhatsApp’d” friction — mitigated by the staff playbook below. |

**When to pick B:** Default for a platform whose strategic goal is self-booking, scheduling, and tracking.

### Option C — WhatsApp as a first-class intake that writes to the same API

A WhatsApp Flow / chatbot collects the **same fields as E2** and `POST /api/bookings`. One database, two front doors.

| | |
| :--- | :--- |
| **Customer** | Books where they already live. Full data quality. |
| **Ops** | Inbox becomes a thin overlay on the same jobs. |
| **Engineering** | Large build: Cloud API, template compliance, media uploads, suburb/slot rules, price engine parity, failure handling, identity (phone vs email). Second UX to maintain whenever E2 changes. |
| **Timing** | Phase 2/3 — after E2 is the proven source of truth. |

**When to pick C:** After E2 is live, if a material share of demand still refuses the website *and* staff-on-behalf is too costly.

---

## 4. Recommendation

**Lock Option B as the interim product decision.**

Reasons, in order:

1. **The database already has one write path.** Admin cannot create bookings. Parallel WhatsApp booking would ship a hole, not a channel.
2. **E2 exists to kill the “message → wait for callback quote” loop** — the same loop WordPress Step 3 still describes. Keeping WhatsApp as an equal booker recreates that loop.
3. **Project summary already assigned WhatsApp to notifications**, not intake (Phase 2: “WhatsApp Business API → Email → Push”).
4. **Option C is not cancelled.** It is sequenced: prove E2, measure how many threads are still “please just book me”, then decide if API intake is worth it.
5. **South African WhatsApp use is respected**, not removed: support links, contact page, and a staff reply template. We stop *advertising* WhatsApp as how you book.

---

## 5. Approved user flow (customers who still WhatsApp a booking)

This is the locked ops + UX flow until leadership reverses Option B.

```
Customer messages WhatsApp
        │
        ▼
Staff reply with the booking link
  https://www.sparkandclean.co.za/book/rug
  + offer to stay on the thread for questions
        │
        ├── Customer completes E2 ──► Booking in DB ──► Confirm ID on WhatsApp
        │
        └── Customer cannot / will not use the form
                    │
                    ▼
           Staff complete E2 on their behalf
           (same wizard, staff device)
                    │
                    ▼
           Booking in DB ──► Send booking ID + “track with this email” on WhatsApp
```

**Do not:** quote a price in WhatsApp as the default, then hope someone types it into admin later. If a price is discussed, it must still land via E2 so the job is schedulable.

**Do not:** promise “we’ll call you with a quote” as the primary next step. That is the old WordPress model.

### Suggested staff reply (copy-paste)

> Thanks for getting in touch. The fastest way to book is our online form — it calculates size, shows an estimate, and lets you pick a collection slot:  
> https://www.sparkandclean.co.za/book/rug  
>  
> Reply here if you get stuck. If you’d rather not use the form, tell us the rug type, size, suburb, and a preferred day and we’ll book it for you and send you the booking ID.

---

## 6. UI impact (implemented — Option B)

Per the ticket: if WhatsApp is support-only, adjust explainer copy and **replace WhatsApp floating buttons with “Chat with support” links**.

| Change | Intent |
| :--- | :--- |
| How it works Step 2 | Copy: **“Fill out our online booking form.”** Inline **Chat with support** link for questions. |
| How it works Step 3 | Matches E2: instant estimate + choose a slot — not “we’ll get back to you”. |
| Floating control | WhatsApp / AI quote float **removed**. Compact **Chat with support** pill opens a support sheet. |
| Support sheet | Primary CTA: book online. WhatsApp Gauteng / Cape Town are **support** links (official mark). |
| Contact + footer | WhatsApp listed as support, not a quote/book shortcut. |
| Service pages | Secondary CTA **Chat with support** → `/contact` (was “Request a Quote”). |

**Out of scope (follow-ups):** admin “create booking on behalf of”, `booking.source` field, WhatsApp Cloud API, in-wizard “Need help?” deep-link. See wiki.

---

## 7. What this unlocks

- **SC-101** — homepage explainer may describe E2 without implying a parallel WhatsApp booker.
- **E2** — wizard remains the system of record; no requirement to ingest WhatsApp payloads in Phase 1.
- **Phase 2 notifications** — WhatsApp API work can stay on *status messages*, not a second booking wizard.

---

## 8. Decision log

| Date | Decision | Owner |
| :--- | :--- | :--- |
| 31 Aug 2026 | Option B locked **interim** so engineering can proceed. | Product / Engineering (this spike) |
| Pending | Countersign or reject Option B. | Noel + Spark & Clean leadership |

## 9. Acceptance criteria

| Criterion | Status |
| :--- | :--- |
| Written options paper for Noel and leadership | This document + canvas briefing |
| Wiki: interim assumption | `docs/wiki/booking-channels.md` — E2 primary; WhatsApp support-only |
| Wiki: approved flow for WhatsApp booking requests | Same wiki — send E2 link or staff complete E2 on behalf |
| Step 2 explainer says “fill out our online booking form” | Homepage How it works |
| WhatsApp floating buttons replaced with “Chat with support” links | Pill + inline link + service-page secondary CTA |
| Choice locked so SC-101 and E2 can proceed | Option B locked interim, 31 Aug 2026 |

Leadership countersignature is requested but **not a blocker** for SC-101 / E2. If they reject Option B, revert copy and the support entry points, then schedule A or C.
