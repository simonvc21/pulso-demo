// L.8 — Email delivery via Resend.
//
// Single-call abstraction so the rest of the app doesn't bind to Resend.
// If we ever swap providers (Postmark, SES), only this file changes.
//
// All sends are best-effort: the caller awaits the result, but a failure
// never throws — it logs and returns { ok: false }. This keeps the UX
// non-blocking for things like "form sent to 8 founders" where one bad
// address shouldn't roll back the whole thing.

import { Resend } from "resend";

interface SendInput {
  to: string | string[];
  subject: string;
  /** HTML body. Plain text fallback is generated automatically. */
  html: string;
  /** Optional reply-to so the founder can hit Reply and reach the GP. */
  replyTo?: string | null;
  /** Optional cc list (e.g. when reminders escalate to the partner). */
  cc?: string[];
  /** Tag for analytics — e.g. "form_invite", "form_reminder", "newsletter". */
  tag?: string;
}

export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}

let resendClient: Resend | null = null;

function client(): Resend | null {
  if (resendClient) return resendClient;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resendClient = new Resend(key);
  return resendClient;
}

export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(input: SendInput): Promise<SendResult> {
  const c = client();
  if (!c) {
    console.warn("[email] RESEND_API_KEY not set — skipping send", { to: input.to, subject: input.subject });
    return { ok: false, error: "Email service not configured" };
  }

  const fromEmail = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  const fromName = process.env.EMAIL_FROM_NAME ?? "Pulso";
  const from = `${fromName} <${fromEmail}>`;

  // Resend accepts a single address or an array. Filter out empty/invalid
  // entries here so callers don't have to.
  const cleanTo = Array.isArray(input.to)
    ? input.to.map((e) => e.trim()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    : (input.to.trim().match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/) ? [input.to.trim()] : []);
  if (cleanTo.length === 0) {
    return { ok: false, error: "No valid recipient email" };
  }

  const cleanCc = (input.cc ?? [])
    .map((e) => e.trim())
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

  try {
    const r = await c.emails.send({
      from,
      to: cleanTo,
      cc: cleanCc.length > 0 ? cleanCc : undefined,
      subject: input.subject,
      html: input.html,
      text: htmlToText(input.html),
      replyTo: input.replyTo ?? undefined,
      tags: input.tag ? [{ name: "kind", value: input.tag }] : undefined,
    });
    if (r.error) {
      console.error("[email] resend returned error", r.error, { to: cleanTo, subject: input.subject });
      return { ok: false, error: r.error.message ?? "Send failed" };
    }
    return { ok: true, id: r.data?.id };
  } catch (err: any) {
    console.error("[email] send threw", err?.message ?? err, { to: cleanTo, subject: input.subject });
    return { ok: false, error: err?.message ?? "Send failed" };
  }
}

// ---------------------------------------------------------------------------
// Light HTML → text fallback so plain-text mail clients still get something
// readable. Strips tags, decodes basic entities, keeps line breaks.
// ---------------------------------------------------------------------------
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Template helpers — substitute {placeholder} tokens. The form schedule
// already uses this pattern in lib/form-schedule.ts; mirroring here keeps
// email-side rendering self-contained.
// ---------------------------------------------------------------------------
export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? vars[name] : `{${name}}`));
}

/** Minimal HTML wrapper so the body has decent styling in mail clients. */
export function wrapHtmlEmail(opts: {
  fundName: string;
  body: string;       // plain text or HTML — newlines become <br>
  ctaText?: string;
  ctaUrl?: string;
  footer?: string;
}): string {
  const safeBody = escapeHtml(opts.body).replace(/\n/g, "<br>");
  const cta = opts.ctaText && opts.ctaUrl ? `
    <p style="margin: 24px 0;">
      <a href="${opts.ctaUrl}" style="display:inline-block;background:#0a1f44;color:#f4b740;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
        ${escapeHtml(opts.ctaText)}
      </a>
    </p>` : "";
  const footer = opts.footer ?? `Sent by ${escapeHtml(opts.fundName)} via Pulso.`;
  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a2332;line-height:1.6;max-width:560px;margin:0 auto;padding:24px;">
  <div style="font-size:14px;">${safeBody}</div>
  ${cta}
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
  <p style="font-size:11px;color:#94a3b8;">${footer}</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
