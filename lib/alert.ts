// lib/alert.ts
// Cron-failure observability helpers — Resend email + cron_failures table writes.
//
// All helpers are BEST-EFFORT: they never throw. A failure inside an alert path
// must not mask the upstream error (or worse, replace a 500 with an alert-side
// 500 that hides the real cause). Each helper catches everything internally
// and logs to console as a last resort.
//
// Used by:
//   • app/api/cron/box-office/refresh — wraps Apify ingestion
//   • app/api/admin/backfill-rapidapi — wraps the historical RapidAPI walk
//   • Future scheduled jobs — same `job` string keys the table for filtering

import { supabaseAdmin } from "@/lib/supabase-server";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO;
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || "alerts@filmglance.com";

interface AlertContext {
  [key: string]: unknown;
}

function errorToString(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function errorToContext(err: unknown): AlertContext {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { value: errorToString(err) };
}

/**
 * Send a plain-text alert email via Resend.
 * No-ops (with a console log) if RESEND_API_KEY or ALERT_EMAIL_TO is unset.
 */
export async function sendAlertEmail(
  subject: string,
  err: unknown,
  context?: AlertContext
): Promise<void> {
  if (!RESEND_API_KEY || !ALERT_EMAIL_TO) {
    console.warn(
      `[alert] RESEND_API_KEY or ALERT_EMAIL_TO not configured — alert NOT sent: ${subject}`
    );
    return;
  }

  const errSummary = errorToString(err);
  const ctxJson = context
    ? JSON.stringify(context, null, 2)
    : "(no additional context)";

  const text = `Subject: ${subject}\n\nError:\n${errSummary}\n\nContext:\n${ctxJson}\n\n— filmglance.com cron alert`;

  const html = `<p><strong>${subject}</strong></p>
<p><strong>Error:</strong></p>
<pre style="background:#111;color:#eee;padding:12px;border-radius:6px;overflow-x:auto;">${escapeHtml(
    errSummary
  )}</pre>
<p><strong>Context:</strong></p>
<pre style="background:#111;color:#eee;padding:12px;border-radius:6px;overflow-x:auto;">${escapeHtml(
    ctxJson
  )}</pre>
<p style="color:#888;font-size:12px;">— filmglance.com cron alert</p>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: ALERT_EMAIL_FROM,
        to: [ALERT_EMAIL_TO],
        subject: `[filmglance] ${subject}`,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[alert] Resend rejected (${res.status}): ${body}`);
    }
  } catch (sendErr) {
    console.error("[alert] Resend send failed:", errorToString(sendErr));
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Insert a row into cron_failures. Each call represents one failed run.
 * The next successful run of the same `job` will mark these resolved.
 */
export async function logCronFailure(
  job: string,
  err: unknown,
  context?: AlertContext
): Promise<void> {
  try {
    await supabaseAdmin.from("cron_failures").insert({
      job,
      failure_reason: errorToString(err).slice(0, 500),
      context: { ...errorToContext(err), ...(context ?? {}) },
    });
  } catch (logErr) {
    console.error(
      `[alert] cron_failures insert failed for job=${job}:`,
      errorToString(logErr)
    );
  }
}

/**
 * Mark all unresolved failures of a given `job` as resolved (now()).
 * Called at the end of a successful cron run.
 */
export async function markCronFailuresResolved(job: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("cron_failures")
      .update({ resolved_at: new Date().toISOString() })
      .eq("job", job)
      .is("resolved_at", null);
  } catch (markErr) {
    console.error(
      `[alert] cron_failures resolve failed for job=${job}:`,
      errorToString(markErr)
    );
  }
}
