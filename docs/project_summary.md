# Spark & Clean Digital Platform - Project Summary

**Date:** 30 Nov 2025
**Prepared For:** Spark & Clean Leadership + Development Team
**Prepared By:** Noel (Product Lead)

---

## 1. Background

Spark & Clean is a fast-growing rug and upholstery cleaning business operating primarily in Cape Town and Johannesburg. The business currently relies heavily on manual workflows, including Instagram DMs, WhatsApp messages, handwritten booking books, and physical operational documentation.

Demand has outgrown these systems, resulting in:
*   Booking friction and inconsistent customer experience
*   Operational inefficiencies
*   Delays in communication and logistics coordination
*   Difficulty tracking payments and customer history
*   Lack of consolidated reporting and data-driven decision making

The business now seeks to move toward a digitally enabled operation that improves customer booking, job management, technician coordination, and repeat business retention.

---

## 2. Strategic Goal

The overarching objective is to create a modern, scalable service platform that:
*   Automates and streamlines customer self-booking
*   Provides operational visibility and consistency
*   Enables technician mobile workflows
*   Supports future expansion (multiple cities → franchise model)
*   Provides data insights to guide business growth
*   Enhances customer loyalty and retention

This transformation positions Spark & Clean as South Africa’s most modern, tech-enabled cleaning service provider.

---

## 3. Core Use Cases

| Persona | Needs |
| :--- | :--- |
| **Customer** | Book online, upload photos, know pricing expectation, track rug cleaning status, pay easily, earn loyalty rewards |
| **Admin/Operations** | Central dashboard for bookings, scheduling by area, confirm pricing, route assignment, payment tracking, reports |
| **Technician/Driver** | Mobile app showing today’s pickup/delivery jobs, addresses, rug details, before/after photos, update job progress |
| **Future Franchise Owner / Manager** | Multi-location management, performance reporting, standardized processes |

---

## 4. Phase Approach

The solution will roll out in phases:

### Phase 1 — MVP Prototype (Current Work)

A functional, interactive prototype using:
*   Next.js (Web)
*   Expo (Mobile App)
*   Static mock data (no backend)

**Purpose:** Demonstrate booking flow, admin control panel, technician workflow, and customer tracking experience for:
*   Leadership review
*   Investor presentations
*   User testing

### Phase 2 — MVP Platform (Live Release)

Integration with:
*   Real authentication
*   Database (MongoDB)
*   Scheduling logic
*   Payment partners (Stripe + OZO/South African gateways)
*   WhatsApp Business communication
*   Route optimization logic

### Phase 3 — Scaling & Intelligence

*   AI rug recognition and stain severity estimation
*   Automated quoting engine
*   Franchise/region-based pricing and dashboards
*   Recurring services (subscriptions, monthly maintenance plans)
*   Deep customer insights and BI dashboard

---

## 5. Key Functional Pillars

| Pillar | Description |
| :--- | :--- |
| **Customer Booking System** | Guided booking wizard with rug type, sizing, photos, address, estimated price, scheduling, online confirmation |
| **Payment & Billing Experience** | Deposit + balance logic, EFT + tap payments initially, automation later |
| **Order Tracking & Notification System** | Status timeline, automated messaging via WhatsApp + email |
| **Admin Operations Hub** | Centralized scheduling, job management, technician assignment, price validation, reporting |
| **Technician/Driver App** | Mobile workflow with daily job list, navigation, status updates, images, customer confirmation |
| **Loyalty & Retention System** | Punch-card model: Clean X rugs → reward structure |

---

## 6. Technical Direction

| Area | Choice |
| :--- | :--- |
| **Web Framework** | Next.js 14 + TypeScript + Tailwind |
| **Mobile** | Expo + React Native |
| **Backend (Later)** | Node/Express or tRPC + MongoDB Atlas |
| **Notifications** | WhatsApp Business API → Email → Push |
| **File Storage** | Local mock now → AWS S3/Supabase in later phases |
| **Charts/Reporting** | Recharts (mock), later integrated analytics pipelines |

---

## 7. Prototype Scope (What will be demoed)

✔ **Self-service booking flow with:**
*   Rug type select
*   Size calculator
*   Photo upload
*   Area-based collection scheduling
*   Hybrid pricing estimate

✔ **Booking confirmation + ability to view booking status.**

✔ **Admin dashboard with:**
*   Job list
*   Detail view
*   Status + payment updates
*   Mock analytics

✔ **Technician app with:**
*   Fake login
*   Today’s jobs
*   Job detail + actions (collected/delivered)
*   Summary screen

✔ **All powered by realistic mock JSON, no backend.**

---

## 8. Expected Demonstration Narrative

1.  Customer discovers site → books a rug collection in under 2 minutes
2.  Admin reviews booking → confirms schedule, assigns driver
3.  Technician sees job from mobile → marks progress
4.  Customer sees status change in real-time
5.  Leadership sees reporting and scalability potential

---

## 9. Why This Matters

This platform will:
*   Reduce operational overhead
*   Increase conversion rates
*   Improve NPS and client trust
*   Enable geographic scaling
*   Formalize financial tracking
*   Open up recurring revenue models
*   Increase valuation and investor attractiveness

In summary, this sets Spark & Clean apart as the first fully tech-enabled cleaning logistics company in the region.
