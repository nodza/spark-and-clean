# Creating New Pages — Developer Guide

> **TL;DR**: Pick a layout shell → build content with design system components and classes → done.
> Full token/component reference: [`src/components/DESIGN_SYSTEM.md`](../src/components/DESIGN_SYSTEM.md)
> Interactive reference: open [`design/Design Reference.dc.html`](../design/Design%20Reference.dc.html) in a browser.

---

## 1. Choose a layout shell

Every page in this app belongs to one of three shells. Pick by asking **who is this page for?**

| Shell | File | Use for | Example route |
|---|---|---|---|
| `AuthLayout` | `src/components/layout/AuthLayout.tsx` | Sign-in, sign-up, password reset | `/login`, `/register`, `/admin/login` |
| `PortalLayout` | `src/components/layout/PortalLayout.tsx` | Admin portal, Client portal | `/admin`, `/admin/bookings`, `/dashboard` |
| `TechLayout` | `src/components/layout/TechLayout.tsx` | Technician field app | `/tech/dashboard`, `/tech/job/[id]` |

---

## 2. Scaffold an auth page

```tsx
// src/app/login/page.tsx
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <AuthLayout
      portalLabel="CLIENT PORTAL"
      tagline={
        <>
          Cleaned in <span style={{ color: "#ffdc39" }}>7 minutes</span>.
          Booked in about the same.
        </>
      }
      subtext="Book collections, track your rugs and reorder past cleans."
    >
      {/* Form */}
      <h1 className="text-page-title" style={{ color: "#000b49" }}>
        Welcome back
      </h1>
      <p className="text-body mt-[9px]" style={{ color: "#6b7280" }}>
        Log in to manage your bookings.
      </p>

      <div className="mt-[24px] flex flex-col gap-[14px]">
        <label className="flex flex-col gap-[7px]">
          <span className="text-eyebrow" style={{ color: "#6b7280" }}>EMAIL</span>
          <Input type="email" placeholder="you@example.com" />
        </label>
        <label className="flex flex-col gap-[7px]">
          <span className="text-eyebrow" style={{ color: "#6b7280" }}>PASSWORD</span>
          <Input type="password" placeholder="••••••••" />
        </label>
      </div>

      <Button className="mt-[20px] w-full justify-center py-[14px]">
        Log in
      </Button>
    </AuthLayout>
  );
}
```

**For admin login**, pass `portalLabel="OPERATIONS"` — no other changes needed. Do **not** include a registration link (accounts are admin-provisioned).

---

## 3. Scaffold a portal page (Admin or Client)

```tsx
// src/app/admin/my-new-section/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { PortalLayout } from "@/components/layout/PortalLayout";
import { SidebarNavItem, SidebarNavGroup } from "@/components/ui/sidebar-nav";
import { LayoutGrid, CalendarDays } from "lucide-react";

function AdminUserFooter() {
  return (
    <div className="flex items-center gap-[11px]">
      <div className="flex size-9 flex-none items-center justify-center rounded-full text-[14px] font-extrabold"
        style={{ background: "#6cf3d5", color: "#000b49" }}>
        LM
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-white">Lerato Mabaso</div>
        <div className="text-[11px]" style={{ color: "rgba(255,255,255,.5)" }}>
          Operations manager
        </div>
      </div>
    </div>
  );
}

export default function MyNewSection() {
  const router = useRouter();

  return (
    <PortalLayout
      portalLabel="OPERATIONS"
      portalLabelColor="#ffdc39"     // yellow for admin, "#6cf3d5" teal for client
      pageTitle="My New Section"
      sidebar={
        <SidebarNavGroup>
          <SidebarNavItem
            icon={<LayoutGrid size={17} strokeWidth={1.8} />}
            label="Overview"
            onClick={() => router.push("/admin")}
          />
          <SidebarNavItem
            icon={<CalendarDays size={17} strokeWidth={1.8} />}
            label="My New Section"
            active                   // mark whichever item is current
          />
        </SidebarNavGroup>
      }
      sidebarFooter={<AdminUserFooter />}
    >
      {/* Wrap content in portal-page for correct padding */}
      <div className="portal-page">
        {/* your page content here */}
      </div>
    </PortalLayout>
  );
}
```

> ⚠️ **Sidebar is repeated per page for now.** Once we have 3+ portal pages, extract the sidebar into a shared `AdminSidebar` component and import it everywhere.

---

## 4. Build page content

### Standard card

```tsx
<div className="ds-card">
  <p className="text-body">Card content goes here.</p>
</div>
```

### Card with header row

```tsx
<div className="ds-card p-0">
  <div className="ds-card-header">
    <span className="text-card-title" style={{ color: "#000b49" }}>Section title</span>
    <button className="ds-text-action">View all</button>
  </div>
  <div className="p-[22px]">
    {/* content */}
  </div>
</div>
```

### KPI / stat tile

```tsx
<div className="ds-card">
  <div className="text-eyebrow" style={{ color: "#9aa0a6" }}>BOOKINGS TODAY</div>
  <div className="tabular mt-[10px]"
    style={{ fontSize: 29, fontWeight: 800, color: "#000b49", letterSpacing: "-0.02em" }}>
    18
  </div>
  <div className="text-meta mt-[7px]" style={{ color: "#0a7a63" }}>+4 vs yesterday</div>
</div>
```

### Navy feature panel

```tsx
<div className="ds-panel-navy">
  <div className="text-eyebrow" style={{ color: "#6cf3d5" }}>EYEBROW</div>
  <div className="text-section text-white mt-[4px]">Heading</div>
  <div className="text-body mt-[8px]" style={{ color: "rgba(255,255,255,.62)" }}>
    Supporting copy.
  </div>
</div>
```

### Grid layout (KPI row)

```tsx
<div className="grid grid-cols-2 gap-[14px] lg:grid-cols-4">
  <StatTile ... />
  <StatTile ... />
</div>
```

---

## 5. Typography — use semantic classes

| What | Class | Notes |
|---|---|---|
| Page title | `text-page-title` | 26px / 800 |
| Section heading | `text-section` | 22px / 800 |
| Card title | `text-card-title` | 15px / 800 |
| Body copy | `text-body` | 13.5px / 600 |
| Meta / sub-text | `text-meta` | 12.5px / 500 |
| Form labels, eyebrows | `text-eyebrow` | 10.5px / 800 / uppercase |
| Table column headers | `text-th` | 10.5px / 800 / uppercase / grey |

**Never** use raw Tailwind `text-2xl font-bold` etc. — always use the semantic classes above.

---

## 6. Buttons

```tsx
<Button>Primary (navy)</Button>
<Button variant="accent">Accent (teal)</Button>
<Button variant="secondary">Secondary (white/border)</Button>
<Button variant="highlight">Highlight (yellow)</Button>
<Button variant="ghost">Ghost (green text action)</Button>
<Button size="sm">Small button</Button>

{/* Full-width (common inside forms) */}
<Button className="w-full justify-center py-[14px]">Submit</Button>
```

---

## 7. Status badges

Map your booking status directly to a variant — no custom styling needed:

```tsx
import { Badge } from "@/components/ui/badge";

<Badge variant="status-new">New</Badge>
<Badge variant="status-collected">Collected</Badge>
<Badge variant="status-cleaning">In cleaning</Badge>
<Badge variant="status-delivering">Out for delivery</Badge>
<Badge variant="status-completed">Completed</Badge>
<Badge variant="status-overdue">Overdue</Badge>
```

---

## 8. Inputs and forms

```tsx
<label className="flex flex-col gap-[7px]">
  <span className="text-eyebrow" style={{ color: "#6b7280" }}>FIELD LABEL</span>
  <Input placeholder="Placeholder" />
</label>

{/* Error state — just add aria-invalid */}
<Input aria-invalid="true" />
<p className="mt-1 text-[12px] font-semibold" style={{ color: "#d64545" }}>
  Error message here.
</p>
```

---

## 9. Tables

Use a CSS grid for tables (not the HTML `<table>` element) — this matches the design spec and makes horizontal scroll easy.

```tsx
{/* Header */}
<div className="grid px-[22px] py-[14px]"
  style={{
    gridTemplateColumns: "140px 1fr 1fr 120px 110px 80px",
    background: "#f7f9fb",
    borderBottom: "1px solid #f0f2f6",
  }}>
  {["ID", "Customer", "Area", "Date", "Status", ""].map((h) => (
    <div key={h} className="text-th">{h}</div>
  ))}
</div>

{/* Rows */}
{items.map((item) => (
  <div key={item.id}
    className="grid cursor-pointer px-[22px] py-[14px] transition-colors hover:bg-[#f7f9fb]"
    style={{
      gridTemplateColumns: "140px 1fr 1fr 120px 110px 80px",
      borderBottom: "1px solid #f0f2f6",
      alignItems: "center",
    }}
    onClick={() => router.push(`/admin/bookings/${item.id}`)}>
    <div className="text-body tabular" style={{ color: "#000b49" }}>{item.id}</div>
    {/* ... rest of cells */}
  </div>
))}
```

---

## 10. Technician app page

```tsx
// src/app/tech/my-screen/page.tsx
"use client";

import { useState } from "react";
import { TechLayout, TechTab } from "@/components/layout/TechLayout";
import { CalendarDays, CheckCircle, User } from "lucide-react";

const TABS: TechTab[] = [
  { key: "today", label: "Today", icon: <CalendarDays size={21} strokeWidth={1.8} /> },
  { key: "history", label: "Completed", icon: <CheckCircle size={21} strokeWidth={1.8} /> },
  { key: "profile", label: "Profile", icon: <User size={21} strokeWidth={1.8} /> },
];

export default function TechScreen() {
  const [tab, setTab] = useState("today");

  return (
    <TechLayout
      driverName="Thabo Mokoena"
      driverSubtitle="Gauteng · Sandton route"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
    >
      <div className="p-[18px]">
        {/* tab content */}
      </div>
    </TechLayout>
  );
}
```

---

## 11. Checklist before submitting a PR

- [ ] Page uses the correct layout shell (`AuthLayout` / `PortalLayout` / `TechLayout`)
- [ ] Page content is wrapped in `<div className="portal-page">` (portal pages only)
- [ ] Typography uses semantic classes (`text-page-title`, `text-body`, `text-eyebrow`, etc.)
- [ ] Status colours come from `<Badge variant="status-*">` — no custom hex status colours
- [ ] All buttons use `<Button variant="...">` — no raw `<button>` with inline styles
- [ ] Inputs use `<Input>` — focus and error states are handled automatically
- [ ] Cards use `ds-card` / `ds-card-header` classes or the equivalent component
- [ ] No arbitrary inline hex colours for things already covered by the design system
- [ ] `npm run build` passes with zero TypeScript errors

---

## Reference files

| File | Purpose |
|---|---|
| [`src/components/DESIGN_SYSTEM.md`](../src/components/DESIGN_SYSTEM.md) | Full token + component reference |
| [`design/Design Reference.dc.html`](../design/Design%20Reference.dc.html) | Interactive swatches (open in browser) |
| [`src/app/admin/page.tsx`](../src/app/admin/page.tsx) | **Working example** — use this as a template |
| [`src/components/layout/PortalLayout.tsx`](../src/components/layout/PortalLayout.tsx) | Portal shell props |
| [`src/components/layout/AuthLayout.tsx`](../src/components/layout/AuthLayout.tsx) | Auth shell props |
| [`src/components/layout/TechLayout.tsx`](../src/components/layout/TechLayout.tsx) | Tech shell props |
