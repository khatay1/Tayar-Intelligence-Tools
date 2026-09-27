import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError } from "../_shared/billing.ts";
import { deliverSignedWebsiteWebhook, validWebsiteWebhookDestination } from "../_shared/website-webhook-security.ts";

type FormField = {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  validation?: Record<string, unknown>;
  conditions?: Array<{ fieldName: string; operator: string; value?: string }>;
};
type Automation = { id: string; name: string; enabled: boolean; action: "email" | "webhook"; destination: string };
type Definition = { id: string; name: string; fields: FormField[]; spamProtection?: "standard" | "enhanced"; minimumCompletionSeconds?: number; automations?: Automation[] };

const allowedMimeTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function cors(req: Request) {
  return {
    "Access-Control-Allow-Origin": req.headers.get("Origin") || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Vary": "Origin",
  };
}
function response(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function text(value: unknown, max = 4000) { return String(value ?? "").trim().slice(0, max); }
function safeValidationPattern(value: unknown) {
  const pattern = text(value, 200);
  if (!pattern || /\\[1-9]|\(\?[=!<]|(?:\*|\+|\{\d+,?\d*\})\s*(?:\*|\+|\{)|\([^)]*(?:\*|\+|\{\d+,?\d*\})[^)]*\)\s*(?:\*|\+|\{)/.test(pattern)) return null;
  try { return new RegExp(pattern); } catch { return null; }
}
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function visible(field: FormField, values: Record<string, unknown>) {
  return !(field.conditions || []).length || field.conditions!.every((rule) => {
    const actual = text(values[rule.fieldName], 1000);
    const expected = text(rule.value, 1000);
    if (rule.operator === "equals") return actual === expected;
    if (rule.operator === "not-equals") return actual !== expected;
    if (rule.operator === "contains") return actual.toLowerCase().includes(expected.toLowerCase());
    if (rule.operator === "not-empty") return Boolean(actual);
    return !actual;
  });
}
function validate(definition: Definition, values: Record<string, unknown>) {
  const clean: Record<string, string | boolean> = {};
  for (const field of (definition.fields || []).slice(0, 45)) {
    if (!visible(field, values) || field.type === "file") continue;
    const raw = field.type === "checkbox" ? values[field.name] === true || values[field.name] === "true" || values[field.name] === "on" : text(values[field.name], 10_000);
    if (field.required && (raw === "" || raw === false)) throw new HttpError(400, `${field.label || field.name} is required`);
    if (typeof raw === "string") {
      const rules = field.validation || {};
      if (Number.isFinite(Number(rules.minLength)) && raw.length < Number(rules.minLength)) throw new HttpError(400, `${field.label} is too short`);
      if (Number.isFinite(Number(rules.maxLength)) && raw.length > Number(rules.maxLength)) throw new HttpError(400, `${field.label} is too long`);
      if (field.type === "email" && raw && !validEmail(raw)) throw new HttpError(400, "Invalid email address");
      if ((field.type === "select" || field.type === "radio") && raw && !(field.options || []).includes(raw)) throw new HttpError(400, `Invalid ${field.label}`);
      if (rules.pattern && raw) {
        const pattern = safeValidationPattern(rules.pattern);
        if (!pattern || !pattern.test(raw)) throw new HttpError(400, `${field.label} is invalid`);
      }
      if (field.type === "number" && raw) {
        const number = Number(raw);
        if (!Number.isFinite(number)) throw new HttpError(400, `${field.label} must be a number`);
        if (Number.isFinite(Number(rules.min)) && number < Number(rules.min)) throw new HttpError(400, `${field.label} is below the minimum`);
        if (Number.isFinite(Number(rules.max)) && number > Number(rules.max)) throw new HttpError(400, `${field.label} is above the maximum`);
      }
    }
    clean[field.name] = raw;
  }
  return clean;
}
function escapeHtml(value: unknown) {
  return text(value, 10_000).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return response(req, { error: "Method not allowed" }, 405);
  let cleanup: { admin: ReturnType<typeof createAdminClient>; paths: string[] } | null = null;
  try {
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 32 * 1024 * 1024) throw new HttpError(413, "Submission is too large");
    const body = await req.formData();
    const projectId = text(body.get("_tayar_project_id"), 80);
    const formId = text(body.get("_tayar_form_id"), 120);
    const pagePath = text(body.get("_tayar_page_path"), 500);
    const startedAt = Date.parse(text(body.get("_tayar_started_at"), 60));
    if (!/^[0-9a-f-]{36}$/i.test(projectId) || !formId) throw new HttpError(400, "Invalid form target");
    if (text(body.get("_tayar_company"), 200)) throw new HttpError(400, "Spam rejected");

    const admin = createAdminClient();
    cleanup = { admin, paths: [] };
    const { data: formRow, error: formError } = await admin.from("website_forms")
      .select("definition,user_id,name").eq("project_id", projectId).eq("form_id", formId).maybeSingle();
    if (formError || !formRow) throw new HttpError(404, "Published form not found");
    const definition = formRow.definition as Definition;
    const enhancedProtection = definition.spamProtection === "enhanced";
    const minimumSeconds = Math.min(60, Math.max(enhancedProtection ? 5 : 1, Number(definition.minimumCompletionSeconds) || 3));
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < minimumSeconds * 1000) throw new HttpError(400, "Submission completed too quickly");

    let context: Record<string, unknown> = {};
    try { context = JSON.parse(text(body.get("_tayar_context"), 20_000)); } catch { throw new HttpError(400, "Invalid form data"); }
    const values = validate(definition, context);
    const clientIp = text(req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80);
    const clientKey = text(`${clientIp}|${values.email || values.name || "anonymous"}`, 200);
    const { error: rateError } = await admin.rpc("enforce_website_public_rate_limit", { p_project_id: projectId, p_bucket: enhancedProtection ? "form-max-enhanced" : "form-max", p_limit: enhancedProtection ? 4 : 8, p_window_seconds: 900, p_client_key: clientKey });
    if (rateError) throw new HttpError(/too many/i.test(rateError.message) ? 429 : 503, rateError.message);
    const { data: limit } = await admin.rpc("website_public_ingestion_limit", { p_project_id: projectId, p_kind: "leads" });
    const { count } = await admin.from("website_leads").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    if ((count || 0) >= Number(limit || 50)) throw new HttpError(429, "Lead storage limit reached");

    const leadId = crypto.randomUUID();
    const files: Array<{ name: string; path: string; size: number; type: string }> = [];
    for (const field of (definition.fields || []).filter((item) => item.type === "file" && visible(item, values))) {
      const file = body.get(field.name);
      if (!(file instanceof File) || file.size === 0) {
        if (field.required) throw new HttpError(400, `${field.label} is required`);
        continue;
      }
      const maxMb = Math.min(10, Math.max(1, Number(field.validation?.maxFileSizeMb) || 5));
      if (file.size > maxMb * 1024 * 1024 || !allowedMimeTypes.has(file.type)) throw new HttpError(400, `Invalid file for ${field.label}`);
      const extension = file.name.includes(".") ? `.${file.name.split(".").pop()!.replace(/[^a-z0-9]/gi, "").slice(0, 10)}` : "";
      const path = `${projectId}/${leadId}/${field.name}${extension}`;
      const { error } = await admin.storage.from("website-form-uploads").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new HttpError(503, "File upload failed");
      files.push({ name: file.name.slice(0, 255), path, size: file.size, type: file.type });
      cleanup.paths.push(path);
    }

    const find = (needle: string) => Object.entries(values).find(([key]) => key.toLowerCase().includes(needle))?.[1];
    const automations = (definition.automations || []).filter((item) => item.enabled && (
      item.action === "email" ? validEmail(text(item.destination, 320)) : item.action === "webhook" && validWebsiteWebhookDestination(text(item.destination, 1000))
    )).slice(0, 10);
    const lead = {
      id: leadId, project_id: projectId, user_id: formRow.user_id, form_id: formId, form_name: text(formRow.name, 120),
      name: text(find("name") || "Website visitor", 120), email: text(find("email"), 200).toLowerCase(),
      message: text(find("message") || Object.entries(values).map(([key, value]) => `${key}: ${value}`).join("\n"), 4000),
      form_data: values, page_path: pagePath || null, files, workflow_status: automations.length ? "processing" : "completed",
    };
    const { error: insertError } = await admin.from("website_leads").insert(lead);
    if (insertError) throw new HttpError(503, "Could not store submission");
    cleanup.paths = [];

    let delivered = 0;
    for (const automation of automations) {
      const deliveryId = crypto.randomUUID();
      const hint = automation.action === "email" ? automation.destination.replace(/^(.{2}).*(@.*)$/, "$1…$2") : new URL(automation.destination).host;
      await admin.from("website_form_deliveries").insert({ id: deliveryId, project_id: projectId, lead_id: leadId, user_id: formRow.user_id, automation_id: automation.id, action_type: automation.action, destination_hint: hint, status: "processing", attempts: 1 });
      try {
        const payload = JSON.stringify({ event: "website.form.submitted", projectId, formId, leadId, formName: formRow.name, pagePath, values, files, createdAt: new Date().toISOString() });
        let deliveryResponse: Response;
        if (automation.action === "webhook") {
          deliveryResponse = await deliverSignedWebsiteWebhook(automation.destination, payload, Deno.env.get("WEBSITE_FORM_WEBHOOK_SECRET"));
        } else {
          const apiKey = Deno.env.get("EMAIL_API_KEY");
          if (!apiKey) throw new Error("Email provider is not configured");
          deliveryResponse = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: `${Deno.env.get("EMAIL_FROM_NAME") || "Tayar Intelligence"} <${Deno.env.get("EMAIL_FROM") || "noreply@tayar.se"}>`, to: [automation.destination], subject: `New ${text(formRow.name, 100)} submission`, html: `<h2>New form submission</h2>${Object.entries(values).map(([key, value]) => `<p><strong>${escapeHtml(key)}</strong>: ${escapeHtml(value)}</p>`).join("")}` }) });
        }
        if (!deliveryResponse.ok) throw new Error(`Delivery failed (${deliveryResponse.status})`);
        delivered += 1;
        await admin.from("website_form_deliveries").update({ status: "delivered", response_status: deliveryResponse.status, delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", deliveryId);
      } catch (error) {
        await admin.from("website_form_deliveries").update({ status: "failed", last_error: error instanceof Error && error.message === "Webhook signing is not configured" ? error.message : "Delivery failed", updated_at: new Date().toISOString() }).eq("id", deliveryId);
      }
    }
    if (automations.length) await admin.from("website_leads").update({ workflow_status: delivered === automations.length ? "completed" : delivered ? "partial" : "failed" }).eq("id", leadId);
    return response(req, { success: true, submissionId: leadId, workflowStatus: automations.length ? (delivered === automations.length ? "completed" : delivered ? "partial" : "failed") : "completed" });
  } catch (error) {
    if (cleanup?.paths.length) {
      const { error: cleanupError } = await cleanup.admin.storage.from("website-form-uploads").remove(cleanup.paths);
      if (cleanupError) console.error("[WEBSITE FORM] upload cleanup failed");
    }
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error("[WEBSITE FORM] submission failed", error);
    return response(req, { error: error instanceof HttpError ? error.message : "Submission failed" }, status);
  }
});
