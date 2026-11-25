import { branchContacts } from "@/data/branchContacts";
import { getAppBaseUrl } from "@/lib/email/appUrl";

export type EmailLedgerRow = {
  label: string;
  value: string;
  /** Green value, used for paid, free, and discount rows. */
  tone?: "good";
};

export type EmailTimelineStep = {
  title: string;
  meta: string;
  state: "done" | "now" | "next";
};

/**
 * Shared transactional card. Customer mail and later admin/driver mail
 * (SCW-116) both render through this so the header, type, and footer match
 * design/Transactional Emails.dc.html.
 */
export type TransactionalEmail = {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  hero?: { label: string; value: string; note: string };
  stamps?: { filled: number; total: number; note: string };
  timeline?: EmailTimelineStep[];
  ledger?: EmailLedgerRow[];
  cta: { label: string; href: string };
  /** Further absolute links, after the footnote. Booking mail uses these for the booking page. */
  links?: { label: string; href: string }[];
  footnote: string;
};

const GAUTENG_PHONE =
  branchContacts.find((branch) => /gauteng/i.test(branch.name))?.phones[0]
    ?.number ?? "064 289 2384";
const CAPE_TOWN_PHONE =
  branchContacts.find((branch) => /cape/i.test(branch.name))?.phones[0]
    ?.number ?? "064 043 6902";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stampCells(filled: number, total: number): string {
  const count = Math.max(0, total);
  const done = Math.min(count, Math.max(0, filled));
  const cells: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const background = index < done ? "#0a7a63" : "#eef1f5";
    const emptyClass = index < done ? "" : " stamp-empty";
    cells.push(
      `<td class="${emptyClass.trim()}" style="width:${Math.floor(100 / count)}%;padding:0 3px;">` +
        `<div class="${emptyClass.trim()}" style="height:10px;border-radius:99px;background:${background};font-size:0;line-height:0;">&nbsp;</div>` +
        `</td>`
    );
  }
  return cells.join("");
}

function timelineHtml(steps: EmailTimelineStep[]): string {
  return steps
    .map((step, index) => {
      const last = index === steps.length - 1;
      const done = step.state === "done";
      const now = step.state === "now";
      const dotBg = done ? "#0a7a63" : now ? "#6cf3d5" : "#eef1f5";
      const dotColor = done ? "#ffffff" : now ? "#000b49" : "#b3b9c2";
      const mark = done ? "&#10003;" : now ? "&#9679;" : "";
      const line = done ? "#0a7a63" : "#e3e7ed";
      const lineClass = done ? "" : " step-line-muted";
      const titleColor = step.state === "next" ? "#9aa0a6" : "#000b49";
      const titleClass = step.state === "next" ? "email-meta" : "email-strong";
      const lineCell = last
        ? ""
        : `<div class="step-line${lineClass}" style="width:2px;min-height:24px;background:${line};font-size:0;line-height:0;">&nbsp;</div>`;
      return (
        `<tr>` +
        `<td valign="top" style="width:36px;padding:0;">` +
        `<div class="${now ? "" : step.state === "next" ? "step-next" : ""}" style="width:22px;height:22px;border-radius:50%;background:${dotBg};color:${dotColor};font-size:11px;font-weight:800;line-height:22px;text-align:center;font-family:Inter,Arial,Helvetica,sans-serif;">${mark}</div>` +
        lineCell +
        `</td>` +
        `<td valign="top" style="padding:0 0 16px 14px;">` +
        `<div class="${titleClass}" style="font-size:14.5px;font-weight:700;line-height:1.35;color:${titleColor};font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(step.title)}</div>` +
        `<div class="email-meta" style="font-size:12.5px;line-height:1.4;color:#9aa0a6;margin-top:4px;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(step.meta)}</div>` +
        `</td>` +
        `</tr>`
      );
    })
    .join("");
}

function ledgerHtml(rows: EmailLedgerRow[]): string {
  return rows
    .map((row) => {
      const color = row.tone === "good" ? "#0a7a63" : "#000b49";
      const valueClass = row.tone === "good" ? "email-link" : "email-strong";
      return (
        `<tr>` +
        `<td class="email-meta" style="padding:13px 12px 13px 2px;border-bottom:1px solid #e9edf2;font-size:14px;line-height:1.4;color:#9aa0a6;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(row.label)}</td>` +
        `<td class="${valueClass} email-line" style="padding:13px 2px 13px 12px;border-bottom:1px solid #e9edf2;font-size:14px;font-weight:700;line-height:1.4;color:${color};text-align:right;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(row.value)}</td>` +
        `</tr>`
      );
    })
    .join("");
}

export function renderTransactionalEmail(email: TransactionalEmail): {
  html: string;
  text: string;
} {
  const base = getAppBaseUrl();
  const logo = `${base}/uploads/spark-and-clean-22.png`;
  const contactUrl = `${base}/contact`;
  const year = new Date().getFullYear();
  const filled = email.stamps?.filled ?? 0;
  const total = email.stamps?.total ?? 0;

  const hero = email.hero
    ? `<table role="presentation" class="email-panel" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f7f9fb;border:1px solid #e9edf2;border-radius:12px;">` +
      `<tr><td align="center" style="padding:26px;">` +
      `<div class="email-meta" style="font-size:10.5px;font-weight:800;letter-spacing:.13em;color:#9aa0a6;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.hero.label)}</div>` +
      `<div class="email-hero email-strong" style="font-size:38px;font-weight:800;letter-spacing:-.02em;color:#000b49;margin-top:11px;line-height:1.1;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.hero.value)}</div>` +
      `<div class="email-soft" style="font-size:13.5px;font-weight:600;color:#5a626c;margin-top:10px;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.hero.note)}</div>` +
      `</td></tr></table>`
    : "";

  const stamps =
    email.stamps && total > 0
      ? `<table role="presentation" class="email-panel" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:#f7f9fb;border:1px solid #e9edf2;border-radius:12px;">` +
        `<tr><td style="padding:22px;">` +
        `<div class="email-meta" style="font-size:10.5px;font-weight:800;letter-spacing:.13em;color:#9aa0a6;margin-bottom:13px;font-family:Inter,Arial,Helvetica,sans-serif;">YOUR CARD</div>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${stampCells(filled, total)}</tr></table>` +
        `<div class="email-soft" style="font-size:13.5px;line-height:1.6;color:#5a626c;margin-top:13px;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.stamps.note)}</div>` +
        `</td></tr></table>`
      : "";

  const timeline = email.timeline?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:26px;">${timelineHtml(email.timeline)}</table>`
    : "";

  const ledger = email.ledger?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">${ledgerHtml(email.ledger)}</table>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(email.subject)}</title>
<style>
  body { margin:0; padding:0; background:#e6eaf0; }
  a { text-decoration:none; }
  @media only screen and (max-width:600px) {
    .email-shell { width:100% !important; }
    .email-pad { padding-left:22px !important; padding-right:22px !important; }
    .email-heading { font-size:24px !important; }
    .email-hero { font-size:32px !important; }
    .email-btn a { display:block !important; text-align:center !important; }
  }
  @media (prefers-color-scheme: dark) {
    .email-card { background:#101a3d !important; border-color:rgba(255,255,255,.12) !important; }
    .email-heading, .email-strong { color:#ffffff !important; }
    .email-soft { color:rgba(255,255,255,.72) !important; }
    .email-meta { color:rgba(255,255,255,.5) !important; }
    .email-eyebrow, .email-link, .email-hero { color:#6cf3d5 !important; }
    .email-panel { background:rgba(255,255,255,.04) !important; border-color:rgba(255,255,255,.12) !important; }
    .email-btn { background:#6cf3d5 !important; }
    .email-btn a { color:#000b49 !important; }
    .email-rule { background:rgba(255,255,255,.12) !important; }
    .stamp-empty, .step-next { background:rgba(255,255,255,.12) !important; }
    .step-next { color:rgba(255,255,255,.4) !important; }
    .step-line-muted { background:rgba(255,255,255,.14) !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#e6eaf0;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(email.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e6eaf0;">
  <tr>
    <td align="center" style="padding:24px 12px 40px;">
      <table role="presentation" class="email-shell email-card" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#ffffff;border:1px solid #e9edf2;border-radius:14px;overflow:hidden;">
        <tr>
          <td align="center" bgcolor="#000b49" style="background:#000b49;padding:26px 16px 24px;">
            <span style="display:inline-block;background:#ffffff;border-radius:10px;padding:9px 13px;">
              <img src="${escapeHtml(logo)}" alt="Spark &amp; Clean" width="148" height="26" style="height:26px;width:auto;display:block;border:0;">
            </span>
          </td>
        </tr>
        <tr>
          <td style="height:3px;background:#6cf3d5;font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td class="email-pad" style="padding:38px 44px 6px;">
            <div class="email-eyebrow" style="font-size:10.5px;font-weight:800;letter-spacing:.16em;color:#0a7a63;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.eyebrow)}</div>
            <div class="email-heading email-strong" style="font-size:27px;font-weight:800;line-height:1.2;letter-spacing:-.02em;color:#000b49;margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.heading)}</div>
            <div class="email-soft" style="font-size:15px;line-height:1.65;color:#5a626c;margin-top:14px;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.intro)}</div>
            ${hero}
            ${stamps}
            ${timeline}
            ${ledger}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 6px;">
              <tr>
                <td class="email-btn" bgcolor="#000b49" style="background:#000b49;border-radius:999px;">
                  <a href="${escapeHtml(email.cta.href)}" style="display:inline-block;background:#000b49;color:#ffffff;font-size:14.5px;font-weight:800;line-height:1;padding:16px 32px;border-radius:999px;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.cta.label)}</a>
                </td>
              </tr>
            </table>
            <div class="email-meta" style="font-size:13px;line-height:1.65;color:#9aa0a6;margin-top:16px;font-family:Inter,Arial,Helvetica,sans-serif;">${escapeHtml(email.footnote)}</div>
            ${(email.links ?? [])
              .map(
                (link) =>
                  `<div style="margin-top:8px;font-size:13px;line-height:1.65;font-family:Inter,Arial,Helvetica,sans-serif;"><a class="email-link" href="${escapeHtml(link.href)}" style="color:#0a7a63;font-weight:600;">${escapeHtml(link.label)}</a></div>`
              )
              .join("")}
          </td>
        </tr>
        <tr>
          <td class="email-pad" style="padding:0 44px;">
            <div class="email-rule" style="height:1px;background:#e9edf2;font-size:0;line-height:0;margin-top:32px;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td class="email-pad" align="center" style="padding:24px 44px 32px;text-align:center;">
            <div class="email-meta" style="font-size:12.5px;line-height:1.7;color:#9aa0a6;font-family:Inter,Arial,Helvetica,sans-serif;">Spark &amp; Clean · Gauteng ${escapeHtml(GAUTENG_PHONE)} · Cape Town ${escapeHtml(CAPE_TOWN_PHONE)}</div>
            <div class="email-meta" style="font-size:12px;color:#9aa0a6;margin-top:9px;font-family:Inter,Arial,Helvetica,sans-serif;">
              <a class="email-link" href="${escapeHtml(contactUrl)}" style="color:#0a7a63;font-weight:600;">Contact us</a>
            </div>
            <div class="email-meta" style="font-size:11.5px;color:#9aa0a6;margin-top:12px;font-family:Inter,Arial,Helvetica,sans-serif;">Copyright ${year} Spark &amp; Clean. Rugs cleaned and dried in 7 minutes.</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const textLines = [
    email.eyebrow,
    email.heading,
    "",
    email.intro,
    "",
  ];
  if (email.hero) {
    textLines.push(
      `${email.hero.label}: ${email.hero.value}`,
      email.hero.note,
      ""
    );
  }
  if (email.stamps) {
    textLines.push(`Loyalty card: ${email.stamps.filled} of ${email.stamps.total}`, email.stamps.note, "");
  }
  for (const step of email.timeline ?? []) {
    textLines.push(`- ${step.title} (${step.meta})`);
  }
  if (email.timeline?.length) textLines.push("");
  for (const row of email.ledger ?? []) {
    textLines.push(`${row.label}: ${row.value}`);
  }
  if (email.ledger?.length) textLines.push("");
  textLines.push(`${email.cta.label}: ${email.cta.href}`);
  for (const link of email.links ?? []) {
    textLines.push(`${link.label}: ${link.href}`);
  }
  textLines.push("", email.footnote, "", `Contact us: ${contactUrl}`);

  return { html, text: textLines.join("\n") };
}
