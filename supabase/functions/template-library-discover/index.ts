import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_CANDIDATES = 500;
const MAX_REDIRECTS = 5;
const MAX_URL = 3000;

const FILE_EXTENSIONS = new Set([
  "xlsx", "xls", "csv",
  "docx", "doc",
  "pptx", "ppt",
  "pdf", "pbix",
  "zip", "txt",
  "png", "jpg", "jpeg",
]);

const CANDIDATE_HOSTS = new Set([
  "24billions.com",
  "www.24billions.com",
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
]);

function json(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = origin === "https://tayar.se"
    || origin === "https://www.tayar.se"
    || origin === "http://localhost:5173"
    ? origin
    : "https://tayar.se";

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

function bounded(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function assertAdmin(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("role,suspended")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data || data.role !== "admin" || data.suspended === true) {
    throw new HttpError(403, "Administrator access required");
  }
}

function assert24BillionsPageUrl(value: unknown) {
  const raw = bounded(value, MAX_URL);
  if (!raw) throw new HttpError(400, "Page URL is required");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new HttpError(400, "Invalid page URL");
  }

  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:" || (host !== "24billions.com" && host !== "www.24billions.com")) {
    throw new HttpError(400, "Discovery only accepts 24Billions pages");
  }

  return parsed.toString();
}

function isAllowedCandidateUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && CANDIDATE_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function decodeHtmlUrl(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#038;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .trim();
}

function extensionFromUrl(value: string) {
  try {
    const parsed = new URL(value);
    const name = decodeURIComponent(parsed.pathname.split("/").pop() || "");
    const extension = name.includes(".") ? name.split(".").pop()?.toLowerCase() || "" : "";
    return FILE_EXTENSIONS.has(extension) ? extension : "";
  } catch {
    return "";
  }
}

function filenameFromUrl(value: string) {
  try {
    return decodeURIComponent(new URL(value).pathname.split("/").pop() || "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^\.+/, "")
      .slice(0, 180);
  } catch {
    return "";
  }
}

async function fetchHtml(pageUrl: string) {
  let current = pageUrl;

  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    current = assert24BillionsPageUrl(current);

    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": "Tayar-Template-Discovery/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new HttpError(502, "Source returned an invalid redirect");
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) throw new HttpError(502, `Source page returned status ${response.status}`);

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      throw new HttpError(413, "Source page is too large");
    }

    const text = await response.text();
    if (text.length > MAX_HTML_BYTES) throw new HttpError(413, "Source page is too large");

    return { html: text, finalUrl: current };
  }

  throw new HttpError(502, "Too many page redirects");
}

function discoverCandidates(html: string, pageUrl: string) {
  const candidates = new Map<string, {
    downloadUrl: string;
    filename: string;
    format: string;
    sourcePageUrl: string;
  }>();

  const hrefPattern = /href\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  let match: RegExpExecArray | null = null;

  while ((match = hrefPattern.exec(html)) && candidates.size < MAX_CANDIDATES) {
    const rawHref = decodeHtmlUrl(match[1] || match[2] || "");
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("mailto:") || rawHref.startsWith("javascript:")) {
      continue;
    }

    let resolved = "";
    try {
      resolved = new URL(rawHref, pageUrl).toString();
    } catch {
      continue;
    }

    if (!isAllowedCandidateUrl(resolved)) continue;

    const host = new URL(resolved).hostname.toLowerCase();
    const format = extensionFromUrl(resolved);
    const isDrive = host.includes("google");
    const isUpload = resolved.includes("/wp-content/uploads/");

    if (!format && !isDrive && !isUpload) continue;

    candidates.set(resolved, {
      downloadUrl: resolved,
      filename: filenameFromUrl(resolved),
      format: format || "unknown",
      sourcePageUrl: pageUrl,
    });
  }

  return [...candidates.values()];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    const admin = createAdminClient();
    await assertAdmin(admin, user.id);

    const raw = await req.text();
    if (!raw || raw.length > 20_000) throw new HttpError(413, "Discovery request is too large");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Invalid JSON request");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(400, "Invalid discovery request");
    }

    const input = parsed as Record<string, unknown>;
    const pageUrl = assert24BillionsPageUrl(input.pageUrl);
    const { html, finalUrl } = await fetchHtml(pageUrl);
    const candidates = discoverCandidates(html, finalUrl);

    return json(req, {
      pageUrl: finalUrl,
      candidateCount: candidates.length,
      candidates,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected discovery error";
    console.error("[TEMPLATE LIBRARY DISCOVER]", message);
    return json(req, { error: message }, status);
  }
});
