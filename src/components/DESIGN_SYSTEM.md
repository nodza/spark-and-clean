# Spark & Clean — Design System

Reference: [`/design/Design Reference.dc.html`](/design/Design%20Reference.dc.html) — open in a browser for interactive token swatches and the full component catalogue.

---

## Colour tokens

| CSS var | Hex | Tailwind class | Use |
|---|---|---|---|
| `--color-navy` | `#000b49` | `text-navy` / `bg-navy` | Primary surface, headings, primary button |
| `--color-teal` | `#6cf3d5` | `text-teal` / `bg-teal` | Accent, active nav, focus ring, progress |
| `--color-yellow` | `#ffdc39` | `text-yellow` / `bg-yellow` | Counts, highlight badges, attention |
| `--color-green` | `#0a7a63` | `text-green` / `bg-green` | Links, inline actions, success, toggle-on |
| `--color-ink` | `#32373c` | `text-ink` | Body text |
| `--color-grey-600` | `#6b7280` | `text-grey-600` | Secondary text |
| `--color-grey-400` | `#9aa0a6` | `text-grey-400` | Meta, labels, placeholders |
| `--color-line` | `#e3e7ed` | `border-line` | All 1px borders |
| `--color-rule` | `#f0f2f6` | `bg-rule` | Inner dividers, disabled fills |
| `--color-surface-page` | `#f5f7fa` | `bg-surface-page` | App backgrounds |
| `--color-surface-head` | `#f7f9fb` | `bg-surface-head` | Table header rows |

---

## Typography — semantic classes

Use these classes instead of arbitrary Tailwind `text-*` utilities.

| Class | Spec | Use |
|---|---|---|
| `.text-display` | 40px / 900 / -0.02em | Hero headlines |
| `.text-page-title` | 26px / 800 | Portal page titles |
| `.text-section` | 22px / 800 | Section headings |
| `.text-card-title` | 15px / 800 | Card titles, table section labels |
| `.text-body` | 13.5px / 600 | Default body copy |
| `.text-meta` | 12.5px / 500 | Timestamps, addresses, supporting info |
| `.text-eyebrow` | 10.5px / 800 / 0.14em uppercase | Form field labels, section eyebrows |
| `.text-th` | 10.5px / 800 / 0.08em uppercase grey | Table column headers |

---

## Buttons — `<Button>`

```tsx
<Button>Primary (navy)</Button>
<Button variant="accent">Accent (teal)</Button>
<Button variant="secondary">Secondary (white/border)</Button>
<Button variant="highlight">Highlight (yellow)</Button>
<Button variant="ghost">Ghost text action (green)</Button>
<Button variant="destructive">Destructive</Button>
<Button size="sm">Small button</Button>
```

All buttons use pill radius (999px) and font-weight 800.

---

## Status badges — `<Badge>`

Map booking status strings directly to the `variant` prop:

```tsx
<Badge variant="status-new">New</Badge>
<Badge variant="status-collected">Collected</Badge>
<Badge variant="status-cleaning">In cleaning</Badge>
<Badge variant="status-delivering">Out for delivery</Badge>
<Badge variant="status-completed">Completed</Badge>
<Badge variant="status-overdue">Overdue</Badge>
```

---

## Inputs — `<Input>`

No special props needed — focus and error states are built in:

```tsx
<Input placeholder="you@example.com" />

{/* Error state — set aria-invalid */}
<Input aria-invalid="true" />
<p className="text-[12px] font-semibold text-[#d64545] mt-1">Enter a valid email.</p>
```

---

## Toggle — `<Toggle>`

```tsx
const [active, setActive] = useState(false);
<Toggle checked={active} onChange={setActive} label="Send SMS confirmation" />
```

---

## Sidebar nav — `<SidebarNavItem>`

```tsx
import { SidebarNavItem, SidebarNavDivider, SidebarNavGroup } from "@/components/ui/sidebar-nav";

<SidebarNavGroup label="MY ACCOUNT">
  <SidebarNavItem icon={<HomeIcon />} label="My Bookings" active />
  <SidebarNavItem icon={<PinIcon />} label="Addresses" />
  <SidebarNavItem icon={<UserIcon />} label="Profile" badge={3} />
</SidebarNavGroup>
<SidebarNavDivider />
```

---

## Layout shells

### Auth pages — `<AuthLayout>`

Use for `/login`, `/register`, `/admin/login`:

```tsx
import { AuthLayout } from "@/components/layout/AuthLayout";

export default function LoginPage() {
  return (
    <AuthLayout
      portalLabel="CLIENT PORTAL"
      tagline={<>Cleaned in <span style={{ color: "#ffdc39" }}>7 minutes</span>. Booked in about the same.</>}
      subtext="Book collections, track your rugs and reorder past cleans."
    >
      {/* form goes here */}
    </AuthLayout>
  );
}
```

For the admin login, use `portalLabel="OPERATIONS"` — no other changes needed.

### Portal pages — `<PortalLayout>`

Use for `/dashboard`, `/admin/*`, `/admin/analytics`, etc.:

```tsx
import { PortalLayout } from "@/components/layout/PortalLayout";

export default function AdminPage() {
  return (
    <PortalLayout
      portalLabel="OPERATIONS"
      portalLabelColor="#ffdc39"
      sidebar={<>...</>}
      sidebarFooter={<>...</>}
      pageTitle="Operations Dashboard"
      topbarActions={<>...</>}
    >
      <div className="portal-page">
        {/* page content */}
      </div>
    </PortalLayout>
  );
}
```

- Client portal: `portalLabelColor="#6cf3d5"` (teal)
- Admin portal: `portalLabelColor="#ffdc39"` (yellow)
- Sidebar width is unified at **248px** for both portals.

### Technician app — `<TechLayout>`

Use for `/tech/dashboard`, `/tech/job/[id]`:

```tsx
import { TechLayout } from "@/components/layout/TechLayout";

const tabs = [
  { key: "today", label: "Today", icon: <CalendarIcon size={21} /> },
  { key: "history", label: "Completed", icon: <CheckIcon size={21} /> },
  { key: "profile", label: "Profile", icon: <UserIcon size={21} /> },
];

export default function TechDashboard() {
  const [activeTab, setActiveTab] = useState("today");
  return (
    <TechLayout
      driverName="Thabo Mokoena"
      driverSubtitle="Gauteng · Sandton route"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {/* tab content */}
    </TechLayout>
  );
}
```

---

## Structural helpers

```tsx
// White card
<div className="ds-card">...</div>

// Card with header row + content
<div className="ds-card p-0">
  <div className="ds-card-header">
    <span className="text-card-title text-navy">Title</span>
    <button className="ds-text-action">View all</button>
  </div>
  <div className="p-[22px]">content</div>
</div>

// Navy feature panel
<div className="ds-panel-navy">
  <div className="text-eyebrow text-teal">EYEBROW</div>
  <div className="text-page-title text-white mt-2">Big number</div>
</div>

// Search pill
<div className="ds-search">
  <SearchIcon className="text-grey-400" size={16} />
  <input className="bg-transparent outline-none text-body flex-1" placeholder="Search..." />
</div>
```

---

## Elevation & borders

| Token | Value | Use |
|---|---|---|
| Card border | `1px solid #e3e7ed` | All white cards (`border-line`) |
| Raised shadow | `shadow-raised` | Hover cards, dropdowns |
| Overlay shadow | `shadow-overlay` | Modals, drawers |

---

## Spacing

4px base. Key values:
- Page gutter: `32px` (`.portal-page` handles this)
- Card padding: `20–22px`
- Grid gap: `14px` (`gap-[14px]`)
- Table row padding: `14px 22px`
- Sidebar nav item gap: `3px`
