# Booking channels

**Status:** Choice locked (interim). This spike is resolvable; SC-101 and E2 are unblocked.  
**Spike:** [WhatsApp Booking Integration Strategy](../spikes/whatsapp-booking-integration.md)  
**Locked:** 31 August 2026  
**Countersignature:** Pending Noel / Spark & Clean leadership (engineering proceeds on this assumption)

---

## Key questions (locked answers)

| Question | Decision |
| :--- | :--- |
| Does WhatsApp remain an equal parallel booking channel? | **No.** E2 (`/book/rug`) is the primary — and only — booking wizard. |
| Or is WhatsApp support/queries only? | **Yes.** WhatsApp is support and assistance, including help finishing the online form. |
| If WhatsApp booking remains, how does it sync with the booking database? | It does **not** remain as a booker, so there is **no WhatsApp → MongoDB sync** in Phase 1. |
| Do admins manually input WhatsApp details into the admin dashboard? | **No transcription into admin.** Admin cannot create bookings. Staff send the E2 link, or complete E2 **on the customer’s behalf**, then confirm the booking ID on WhatsApp. |

---

## Interim assumption

**E2 (`/book/rug`) is the primary — and only — booking channel that writes to the booking database.**

WhatsApp remains in the product for **support and assistance only**. It is not an equal parallel booker. There is no WhatsApp → MongoDB sync in Phase 1.

Phase 2 WhatsApp Business API (see `docs/project_summary.md`) is for **notifications** (status, reminders), not a second intake wizard.

---

## Why

- Admin cannot create bookings today; a WhatsApp job has nowhere to land except E2.
- E2 captures size, photos, price band, and collection slot — the data ops and technicians actually use.
- Advertising WhatsApp as “how you book” recreates the WordPress callback-quote loop E2 was built to replace.

---

## Approved flow: customer still asks to book on WhatsApp

1. Customer messages a branch WhatsApp number.
2. Staff send the E2 link (`/book/rug`) and offer to help on the thread.
3. Customer completes E2 → booking exists → staff confirm the **booking ID** on WhatsApp.
4. If the customer cannot use the form (device, language, preference), **staff complete E2 on their behalf** on a staff device, then send the booking ID and “track with this email” instructions.
5. Conversation stays on WhatsApp for questions. The **system of record** is always the E2 booking.

Staff do not transcribe into a separate spreadsheet or the admin detail screen (there is no create form). Staff do not treat a WhatsApp “yes please collect Thursday” as a booked job until E2 has been submitted.

---

## Customer-facing rules

| Do | Don’t |
| :--- | :--- |
| Primary CTAs: “Book a collection” → `/book/rug` | Floating green WhatsApp buttons that imply booking |
| How it works Step 2: fill out the online booking form | “WhatsApp or the form” as equal options |
| “Chat with support” → questions + help with the form | AI / chat quoting as a third booker |
| Contact page: WhatsApp labelled as support | Collect measurements on WhatsApp as the default quote path |

WhatsApp numbers currently use each branch’s primary mobile (`branchContacts.whatsapp`). Ops should confirm these are the live Business numbers before launch.

---

## Follow-ups (not required to close this spike)

| Item | Notes |
| :--- | :--- |
| SC-101 | Explainer copy aligned with E2 (Step 2/3 updated with this spike). |
| E2 | No WhatsApp booking CTA inside the wizard. Optional later: “Need help?” → support. |
| Admin create-on-behalf | Nice-to-have; until then staff use E2 themselves. |
| `booking.source` | `online` \| `staff_assisted` \| (later) `whatsapp_api` — analytics only. |
| Option C revisit | If assisted-WhatsApp volume stays high after launch, consider Cloud API intake that posts to the same `/api/bookings`. |
