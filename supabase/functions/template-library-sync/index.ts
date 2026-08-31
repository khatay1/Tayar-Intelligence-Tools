import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const MAX_ASSETS_PER_REQUEST = 10;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_BATCH_BYTES = 120 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_TITLE = 240;
const MAX_CATEGORY = 80;
const MAX_FORMAT = 24;
const MAX_URL = 3000;

const ALLOWED_SOURCE_HOSTS = new Set([
  "24billions.com",
  "www.24billions.com",
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
]);

const ALLOWED_EXTENSIONS = new Set([
  "xlsx", "xls", "csv",
  "docx", "doc",
  "pptx", "ppt",
  "pdf", "pbix",
  "zip", "txt",
  "png", "jpg", "jpeg",
]);

type ImportAsset = {
  title?: unknown;
  category?: unknown;
  format?: unknown;
  sourcePageUrl?: unknown;
  downloadUrl?: unknown;
  filename?: unknown;
};

function json(req: Request, body: unknown, status = 200) {
  const origin = req.headers.get("Origin") || "";
  const allowOrigin = origin === "https://tayar.se"
    || origin === "https://www.tayar.se"
    || origin === "http://localhost:5173"
    ? origin
    : "https://tayar.se";

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}

function bounded(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function assertAllowedSourceUrl(value: unknown) {
  const raw = bounded(value, MAX_URL);
  if (!raw) throw new HttpError(400, "Download URL is required");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new HttpError(400, "Invalid download URL");
  }

  if (parsed.protocol !== "https:" || !ALLOWED_SOURCE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new HttpError(400, "Download host is not allowlisted");
  }

  return parsed.toString();
}

function normalizeGoogleDriveDownloadUrl(value: string) {
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();

  if (host !== "drive.google.com" && host !== "docs.google.com") {
    return value;
  }

  const fileId = parsed.searchParams.get("id")
    || parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    || "";

  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) {
    return value;
  }

  const direct = new URL("https://drive.usercontent.google.com/download");
  direct.searchParams.set("id", fileId);
  direct.searchParams.set("export", "download");
  direct.searchParams.set("confirm", "t");
  return direct.toString();
}

const CONTENT_TYPE_EXTENSIONS: Record<string, string> = {
  "application/zip": "zip",
  "application/pdf": "pdf",
  "text/csv": "csv",
  "text/plain": "txt",
  "image/png": "png",
  "image/jpeg": "jpg",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

function cleanFilename(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 160);
}

function filenameFromContentDisposition(value: string | null) {
  if (!value) return "";

  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^["']|["']$/g, ""));
    } catch {
      // Fall through to the ordinary filename form.
    }
  }

  return value.match(/filename="?([^";]+)"?/i)?.[1]?.trim() || "";
}

function validateFilename(value: string) {
  const cleaned = cleanFilename(value);
  if (!cleaned || !cleaned.includes(".")) {
    throw new HttpError(400, "Could not determine a valid template filename");
  }

  const extension = cleaned.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    throw new HttpError(400, `Unsupported template file extension: ${extension}`);
  }

  return cleaned;
}

function resolveFilename(
  requested: unknown,
  downloadUrl: string,
  downloaded: {
    finalUrl: string;
    contentType: string;
    contentDisposition: string | null;
  },
) {
  const requestedName = bounded(requested, 180);
  const dispositionName = filenameFromContentDisposition(downloaded.contentDisposition);

  let finalUrlName = "";
  let originalUrlName = "";
  try {
    finalUrlName = decodeURIComponent(new URL(downloaded.finalUrl).pathname.split("/").pop() || "");
  } catch {
    finalUrlName = "";
  }
  try {
    originalUrlName = decodeURIComponent(new URL(downloadUrl).pathname.split("/").pop() || "");
  } catch {
    originalUrlName = "";
  }

  for (const candidate of [requestedName, dispositionName, finalUrlName, originalUrlName]) {
    const cleaned = cleanFilename(candidate);
    if (cleaned.includes(".")) return validateFilename(cleaned);
  }

  const inferredExtension = CONTENT_TYPE_EXTENSIONS[downloaded.contentType.toLowerCase()] || "";
  const base = cleanFilename(requestedName || dispositionName || finalUrlName || originalUrlName || "template")
    .replace(/\.+$/, "") || "template";

  if (!inferredExtension) {
    throw new HttpError(400, "Could not determine template file type from source response");
  }

  return validateFilename(`${base}.${inferredExtension}`);
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

async function fetchAllowlisted(url: string) {
  let current = normalizeGoogleDriveDownloadUrl(url);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    assertAllowedSourceUrl(current);

    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Tayar-Template-Mirror/1.0",
        "Accept": "*/*",
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new HttpError(502, "Source returned an invalid redirect");
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) {
      throw new HttpError(502, `Source download failed with status ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES) {
      throw new HttpError(413, "Source file exceeds the 50 MB limit");
    }

    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength <= 0 || body.byteLength > MAX_FILE_BYTES) {
      throw new HttpError(413, "Downloaded file is empty or exceeds the 50 MB limit");
    }

    const contentType = (response.headers.get("content-type") || "application/octet-stream")
      .split(";")[0]
      .trim()
      .slice(0, 160);

    if (contentType === "text/html" || contentType === "application/xhtml+xml") {
      throw new HttpError(
        502,
        "Source returned an HTML page instead of a downloadable template file",
      );
    }

    return {
      bytes: body,
      contentType,
      contentDisposition: response.headers.get("content-disposition"),
      finalUrl: current,
    };
  }

  throw new HttpError(502, "Too many source redirects");
}

async function sha256Hex(bytes: Uint8Array) {
  const source = new Uint8Array(bytes.byteLength);
  source.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", source.buffer);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const admin = createAdminClient();
  let runId = "";

  try {
    const user = await requireUser(req);
    await assertAdmin(admin, user.id);

    const raw = await req.text();
    if (!raw || raw.length > 120_000) throw new HttpError(413, "Import request is too large");

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new HttpError(400, "Invalid JSON request");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(400, "Invalid import request");
    }

    const input = parsed as Record<string, unknown>;
    const assets = Array.isArray(input.assets) ? input.assets : [];
    if (!assets.length || assets.length > MAX_ASSETS_PER_REQUEST) {
      throw new HttpError(400, `Provide 1-${MAX_ASSETS_PER_REQUEST} assets per import request`);
    }

    const { data: source, error: sourceError } = await admin
      .from("template_sources")
      .select("id,provider,can_redistribute,active")
      .eq("provider", "24billions")
      .eq("base_url", "https://24billions.com")
      .maybeSingle();

    if (sourceError || !source || source.active !== true || source.can_redistribute !== true) {
      throw new HttpError(409, "24Billions import source is not enabled");
    }

    const { data: run, error: runError } = await admin
      .from("template_import_runs")
      .insert({
        source_id: source.id,
        requested_by: user.id,
        label: bounded(input.label, 160),
        requested_count: assets.length,
        status: "running",
      })
      .select("id")
      .single();

    if (runError || !run) throw new HttpError(500, "Could not create import run");
    runId = run.id;

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let bytesImported = 0;
    const results: Array<Record<string, unknown>> = [];

    for (const rawAsset of assets as ImportAsset[]) {
      let assetId = "";
      try {
        const downloadUrl = assertAllowedSourceUrl(rawAsset.downloadUrl);
        const sourcePageUrl = rawAsset.sourcePageUrl
          ? assertAllowedSourceUrl(rawAsset.sourcePageUrl)
          : null;

        const { data: existing, error: existingError } = await admin
          .from("template_assets")
          .select("id,title,status,storage_path")
          .eq("source_download_url", downloadUrl)
          .maybeSingle();

        if (existingError) {
          throw new Error("Could not check existing template asset");
        }

        if (existing?.status === "ready" && existing.storage_path) {
          skipped += 1;
          results.push({
            id: existing.id,
            title: existing.title,
            status: "ready",
            skipped: true,
            storagePath: existing.storage_path,
          });
          continue;
        }

        const downloaded = await fetchAllowlisted(downloadUrl);
        if (bytesImported + downloaded.bytes.byteLength > MAX_BATCH_BYTES) {
          throw new HttpError(413, "Import batch exceeds the 120 MB limit");
        }

        const filename = resolveFilename(rawAsset.filename, downloadUrl, downloaded);
        const title = bounded(rawAsset.title, MAX_TITLE) || filename;
        const category = bounded(rawAsset.category, MAX_CATEGORY) || "uncategorized";
        const requestedFormat = bounded(rawAsset.format, MAX_FORMAT).toLowerCase();
        const filenameFormat = filename.split(".").pop()?.toLowerCase() || "file";
        const format = requestedFormat && requestedFormat !== "unknown"
          ? requestedFormat
          : filenameFormat;

        const { data: queued, error: queueError } = await admin
          .from("template_assets")
          .upsert({
            source_id: source.id,
            title,
            category,
            format,
            source_page_url: sourcePageUrl,
            source_download_url: downloadUrl,
            original_filename: filename,
            status: "queued",
            error_message: null,
            is_public: true,
          }, { onConflict: "source_download_url" })
          .select("id")
          .single();

        if (queueError || !queued) throw new Error("Could not queue asset");
        assetId = queued.id;

        const checksum = await sha256Hex(downloaded.bytes);
        const safeCategory = category
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 60) || "uncategorized";
        const storagePath = `24billions/${safeCategory}/${checksum.slice(0, 16)}-${filename}`;

        const { error: uploadError } = await admin.storage
          .from("template-library")
          .upload(storagePath, downloaded.bytes, {
            contentType: downloaded.contentType,
            upsert: true,
          });

        if (uploadError) throw new Error("Could not store imported asset");

        const { error: readyError } = await admin
          .from("template_assets")
          .update({
            storage_path: storagePath,
            mime_type: downloaded.contentType,
            file_size_bytes: downloaded.bytes.byteLength,
            sha256: checksum,
            status: "ready",
            error_message: null,
            updated_at: new Date().toISOString(),
            metadata: {
              final_source_url: downloaded.finalUrl,
              imported_by: user.id,
            },
          })
          .eq("id", assetId);

        if (readyError) throw new Error("Could not finalize mirrored asset metadata");

        imported += 1;
        bytesImported += downloaded.bytes.byteLength;
        results.push({ id: assetId, title, status: "ready", storagePath });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message.slice(0, 500) : "Import failed";

        if (assetId) {
          await admin
            .from("template_assets")
            .update({
              status: "failed",
              error_message: message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", assetId);
        }

        results.push({ id: assetId || null, status: "failed", error: message });
      }
    }

    const runStatus = failed === 0 ? "completed" : imported > 0 ? "partial" : "failed";
    await admin
      .from("template_import_runs")
      .update({
        imported_count: imported,
        failed_count: failed,
        bytes_imported: bytesImported,
        status: runStatus,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);

    return json(req, {
      runId,
      status: runStatus,
      imported,
      skipped,
      failed,
      bytesImported,
      results,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected template import error";

    if (runId) {
      await admin
        .from("template_import_runs")
        .update({
          status: "failed",
          error_message: message.slice(0, 500),
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }

    console.error("[TEMPLATE LIBRARY SYNC]", message);
    return json(req, { error: message }, status);
  }
});
