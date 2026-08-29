import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { HttpError, requireUser } from "../_shared/billing.ts";

type EmailTemplate =
  | "welcome"
  | "verify-email"
  | "reset-password"
  | "subscription-confirmation"
  | "payment-receipt"
  | "trial-ending"
  | "contact-form";

interface EmailRequest {
  template?: unknown;
  to?: unknown;
  data?: unknown;
}

const ALLOWED_TEMPLATES = new Set<EmailTemplate>([
  "welcome",
  "verify-email",
  "reset-password",
  "subscription-confirmation",
  "payment-receipt",
  "trial-ending",
  "contact-form",
]);

function allowedOrigins(): Set<string> {
  const origins = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  for (const raw of [Deno.env.get("APP_URL"), ...(Deno.env.get("ALLOWED_ORIGINS") || "").split(",")]) {
    const value = raw?.trim();
    if (!value) continue;
    try { origins.add(new URL(value).origin); } catch { /* ignore invalid configured origins */ }
  }
  return origins;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin")?.trim();
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
    "Vary": "Origin",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function assertAllowedOrigin(req: Request): void {
  const origin = req.headers.get("Origin")?.trim();
  if (origin && !allowedOrigins().has(origin)) throw new HttpError(403, "Origin is not allowed");
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeHref(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" && url.protocol !== "http:") return fallback;
    return escapeHtml(url.toString());
  } catch {
    return fallback;
  }
}

function cleanData(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 30)) {
    const text = String(raw ?? "").slice(0, key === "message" ? 10_000 : 1_000);
    result[key] = escapeHtml(text);
  }
  if (typeof (value as Record<string, unknown>).link === "string") {
    result.link = safeHref(String((value as Record<string, unknown>).link), "#");
  }
  if (typeof (value as Record<string, unknown>).appUrl === "string") {
    result.appUrl = safeHref(String((value as Record<string, unknown>).appUrl), safeHref(Deno.env.get("APP_URL") || "https://tayar.se", "https://tayar.se"));
  }
  return result;
}

function normalizeEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpError(400, "Invalid recipient email");
  }
  return email;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    try { assertAllowedOrigin(req); return new Response(null, { status: 204, headers: corsHeaders(req) }); }
    catch { return new Response("Forbidden", { status: 403, headers: corsHeaders(req) }); }
  }
  if (req.method !== "POST") return jsonResponse(req, { error: "Method not allowed" }, 405);

  try {
    assertAllowedOrigin(req);
    const user = await requireUser(req);
    const raw = await req.text();
    if (!raw || raw.length > 20_000) throw new HttpError(raw ? 413 : 400, raw ? "Email request is too large" : "Request body is required");

    let body: EmailRequest;
    try { body = JSON.parse(raw) as EmailRequest; }
    catch { throw new HttpError(400, "Invalid JSON request"); }

    const template = String(body.template || "") as EmailTemplate;
    if (!ALLOWED_TEMPLATES.has(template)) throw new HttpError(400, "Unsupported email template");

    const data = cleanData(body.data);
    let recipient: string;

    if (template === "contact-form") {
      const supportEmail = Deno.env.get("SUPPORT_EMAIL");
      if (!supportEmail) throw new HttpError(503, "Support email is not configured");
      recipient = normalizeEmail(supportEmail);
      if (user.email) data.email = escapeHtml(user.email);
    } else {
      if (!user.email) throw new HttpError(400, "Signed-in account has no email address");
      recipient = normalizeEmail(user.email);
      if (body.to && normalizeEmail(body.to) !== recipient) {
        throw new HttpError(403, "Email recipient must match the signed-in account");
      }
    }

    const { subject, html } = renderTemplate(template, data);
    const emailApiKey = Deno.env.get("EMAIL_API_KEY");
    const emailDevMode = Deno.env.get("EMAIL_DEV_MODE") === "true";
    const fromEmail = Deno.env.get("EMAIL_FROM") || "noreply@tayar.se";
    const fromName = Deno.env.get("EMAIL_FROM_NAME") || "Tayar Intelligence";

    if (emailApiKey) {
      const providerResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${emailApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [recipient], subject, html }),
      });

      if (!providerResponse.ok) {
        console.error(`[EMAIL SERVICE] Provider failed (${providerResponse.status})`);
        return jsonResponse(req, { error: "Email provider is temporarily unavailable" }, 502);
      }
    } else if (!emailDevMode) {
      return jsonResponse(req, { error: "Email provider is not configured" }, 503);
    }

    return jsonResponse(req, {
      success: true,
      message: emailApiKey ? "Email queued" : "Email skipped in development mode",
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "Email request failed";
    if (status >= 500) console.error(`[EMAIL SERVICE] Request failed (${status})`);
    return jsonResponse(req, { error: message }, status);
  }
});

function renderTemplate(template: EmailTemplate, data: Record<string, string>): { subject: string; html: string } {
  const appUrl = data.appUrl || safeHref(Deno.env.get("APP_URL") || "https://tayar.se", "https://tayar.se");
  const templates: Record<EmailTemplate, { subject: (d: Record<string, string>) => string; html: (d: Record<string, string>) => string }> = {
    welcome: {
      subject: () => "Welcome to Tayar Intelligence Tools!",
      html: (d) => emailShell(`
        <h1 style="font-size:28px;font-weight:700;color:#fff;margin:0 0 16px;">Welcome to Tayar Intelligence, ${d.name || "there"}!</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">We are thrilled to have you on board. Tayar Intelligence Tools is your AI-powered workspace for creating websites, CVs, content, translations, and more.</p>
        <a href="${appUrl}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Get Started</a>
      `),
    },
    "verify-email": {
      subject: () => "Verify your email address",
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">Verify Your Email</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Hi ${d.name || "there"}, please confirm your email address to secure your account.</p>
        <a href="${d.link || "#"}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Verify Email</a>
      `),
    },
    "reset-password": {
      subject: () => "Reset your password",
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">Password Reset Request</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Hi ${d.name || "there"}, we received a request to reset your password.</p>
        <a href="${d.link || "#"}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Reset Password</a>
        <p style="font-size:13px;color:#666;margin:24px 0 0;">If you did not request this, you can safely ignore this email.</p>
      `),
    },
    "subscription-confirmation": {
      subject: (d) => `Subscription Confirmed — ${d.plan || "Pro"}`,
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">You are now on the ${d.plan || "Pro"} Plan!</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Thank you for upgrading. Your plan features are now available.</p>
        <a href="${appUrl}" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">Open Tayar</a>
      `),
    },
    "payment-receipt": {
      subject: (d) => `Payment Receipt${d.amount ? ` — ${d.amount}` : ""}`,
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">Payment Receipt</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Thank you for your payment.</p>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:20px;margin:0 0 24px;">
          <p style="margin:0 0 8px;color:#a0a0b8;font-size:14px;">Amount: <span style="color:#fff;font-weight:700;">${d.amount || ""}</span></p>
          <p style="margin:0 0 8px;color:#a0a0b8;font-size:14px;">Date: <span style="color:#fff;">${d.date || ""}</span></p>
          <p style="margin:0;color:#a0a0b8;font-size:14px;">Transaction ID: <span style="color:#fff;font-family:monospace;">${d.transactionId || ""}</span></p>
        </div>
      `),
    },
    "trial-ending": {
      subject: () => "Your Pro trial ends soon",
      html: (d) => emailShell(`
        <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 16px;">Your Trial Ends in ${d.daysLeft || "3"} Days</h1>
        <p style="font-size:16px;color:#a0a0b8;line-height:1.6;margin:0 0 24px;">Hi ${d.name || "there"}, your Pro trial is ending soon.</p>
        <a href="${appUrl}#subscription" style="display:inline-block;background:#8b5cf6;color:#fff;font-weight:600;padding:12px 32px;border-radius:12px;text-decoration:none;font-size:15px;">View Subscription</a>
      `),
    },
    "contact-form": {
      subject: (d) => `New Contact Form Message${d.name ? ` from ${d.name}` : ""}`,
      html: (d) => emailShell(`
        <h1 style="font-size:22px;font-weight:700;color:#fff;margin:0 0 16px;">New Contact Form Submission</h1>
        <p style="color:#a0a0b8;">From: ${d.name || ""}</p>
        <p style="color:#a0a0b8;">Email: ${d.email || ""}</p>
        ${d.subject ? `<p style="color:#a0a0b8;">Subject: ${d.subject}</p>` : ""}
        <div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:16px;color:#a0a0b8;font-size:15px;line-height:1.6;">${d.message || ""}</div>
      `),
    },
  };

  const selected = templates[template];
  return { subject: selected.subject(data).slice(0, 200), html: selected.html(data) };
}

function emailShell(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#06060f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <div style="text-align:center;margin-bottom:32px;"><div style="display:inline-block;width:40px;height:40px;background:#8b5cf6;border-radius:12px;line-height:40px;text-align:center;color:#fff;font-weight:700;font-size:18px;">T</div><p style="color:#fff;font-weight:700;font-size:16px;margin:8px 0 0;">Tayar Intelligence Tools</p></div>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;">${content}</div>
      <p style="text-align:center;color:#555;font-size:13px;margin:32px 0 0;">© ${new Date().getFullYear()} Tayar Intelligence. All rights reserved.</p>
    </div>
  </body></html>`;
}
