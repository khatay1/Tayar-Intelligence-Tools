import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const MAX_PAGE_SIZE = 12;

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

function hasBytes(bytes: Uint8Array, signature: number[], offset = 0) {
  if (bytes.byteLength < offset + signature.length) return false;
  return signature.every((value, index) => bytes[offset + index] === value);
}

function bytesIncludeAscii(bytes: Uint8Array, needle: string) {
  const target = new TextEncoder().encode(needle);
  if (!target.byteLength || target.byteLength > bytes.byteLength) return false;

  outer:
  for (let index = 0; index <= bytes.byteLength - target.byteLength; index += 1) {
    if (bytes[index] !== target[0]) continue;
    for (let needleIndex = 1; needleIndex < target.byteLength; needleIndex += 1) {
      if (bytes[index + needleIndex] !== target[needleIndex]) continue outer;
    }
    return true;
  }

  return false;
}

function isZipContainer(bytes: Uint8Array) {
  return hasBytes(bytes, [0x50, 0x4b, 0x03, 0x04])
    || hasBytes(bytes, [0x50, 0x4b, 0x05, 0x06])
    || hasBytes(bytes, [0x50, 0x4b, 0x07, 0x08]);
}

function isOleCompoundDocument(bytes: Uint8Array) {
  return hasBytes(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
}

function looksLikeHtml(bytes: Uint8Array) {
  const sample = new TextDecoder()
    .decode(bytes.slice(0, Math.min(bytes.byteLength, 4096)))
    .trimStart()
    .toLowerCase();

  return sample.startsWith("<!doctype html")
    || sample.startsWith("<html")
    || sample.includes("<body")
    || sample.includes("<head");
}

function inferExtensionFromBytes(bytes: Uint8Array) {
  if (hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return "jpg";

  if (isZipContainer(bytes)) {
    if (bytesIncludeAscii(bytes, "xl/workbook.xml")) return "xlsx";
    if (bytesIncludeAscii(bytes, "word/document.xml")) return "docx";
    if (bytesIncludeAscii(bytes, "ppt/presentation.xml")) return "pptx";
    if (
      bytesIncludeAscii(bytes, "Report/Layout")
      || bytesIncludeAscii(bytes, "DataModel")
    ) {
      return "pbix";
    }
    return "zip";
  }

  if (isOleCompoundDocument(bytes)) return "ole-office";
  return "";
}

function inspectFile(filename: string, bytes: Uint8Array) {
  const extension = filename.split(".").pop()?.toLowerCase() || "";
  const detected = inferExtensionFromBytes(bytes);
  let valid = true;

  switch (extension) {
    case "pdf":
      valid = detected === "pdf";
      break;
    case "png":
      valid = detected === "png";
      break;
    case "jpg":
    case "jpeg":
      valid = detected === "jpg";
      break;
    case "xlsx":
    case "docx":
    case "pptx":
    case "pbix":
      valid = detected === extension;
      break;
    case "zip":
      valid = isZipContainer(bytes);
      break;
    case "xls":
    case "doc":
    case "ppt":
      valid = isOleCompoundDocument(bytes);
      break;
    case "csv":
    case "txt":
      valid = !looksLikeHtml(bytes);
      break;
    default:
      valid = false;
  }

  if (looksLikeHtml(bytes)) {
    return {
      valid: false,
      extension,
      detected: "html",
      reason: "Stored object contains HTML instead of the expected downloadable file",
    };
  }

  return {
    valid,
    extension,
    detected: detected || "unknown",
    reason: valid
      ? null
      : `Filename expects .${extension || "unknown"} but stored content was detected as ${detected || "unknown"}`,
  };
}

async function assertAdmin(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
) {
  const { data, error } = await admin
    .from("profiles")
    .select("role,suspended")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new HttpError(503, "Admin status could not be verified");
  if (!data || data.suspended === true || data.role !== "admin") {
    throw new HttpError(403, "Admin access required");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    const admin = createAdminClient();
    await assertAdmin(admin, user.id);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const offset = Math.max(0, Math.floor(Number(body.offset || 0)));
    const requestedLimit = Math.floor(Number(body.limit || 8));
    const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, Number.isFinite(requestedLimit) ? requestedLimit : 8));

    const { data, error, count } = await admin
      .from("template_assets")
      .select(
        "id,title,format,original_filename,storage_path,mime_type,file_size_bytes",
        { count: "exact" },
      )
      .eq("status", "ready")
      .like("storage_path", "24billions/%")
      .not("storage_path", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw new HttpError(500, "Could not load template assets for audit");

    let valid = 0;
    let invalid = 0;
    let missing = 0;
    const issues: Array<Record<string, unknown>> = [];

    for (const asset of data || []) {
      const storagePath = String(asset.storage_path || "");
      const filename = String(asset.original_filename || asset.title || "");
      const { data: blob, error: downloadError } = await admin.storage
        .from("template-library")
        .download(storagePath);

      if (downloadError || !blob) {
        missing += 1;
        invalid += 1;
        issues.push({
          id: asset.id,
          title: asset.title,
          format: asset.format,
          filename,
          storagePath,
          issue: "storage-download-failed",
        });
        continue;
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const inspection = inspectFile(filename, bytes);
      const expectedSize = Number(asset.file_size_bytes || 0);
      const sizeMismatch = expectedSize > 0 && expectedSize !== bytes.byteLength;

      if (inspection.valid && !sizeMismatch) {
        valid += 1;
        continue;
      }

      invalid += 1;
      issues.push({
        id: asset.id,
        title: asset.title,
        format: asset.format,
        filename,
        storagePath,
        mimeType: asset.mime_type,
        expectedBytes: expectedSize || null,
        actualBytes: bytes.byteLength,
        detected: inspection.detected,
        issue: sizeMismatch ? "size-mismatch" : "content-mismatch",
        reason: sizeMismatch
          ? `Metadata size ${expectedSize} does not match stored object size ${bytes.byteLength}`
          : inspection.reason,
      });
    }

    const scanned = (data || []).length;
    const total = Math.max(0, Number(count || 0));
    const nextOffset = offset + scanned < total ? offset + scanned : null;

    return json(req, {
      ok: true,
      readOnly: true,
      offset,
      scanned,
      valid,
      invalid,
      missing,
      total,
      nextOffset,
      issues,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected audit error";
    console.error("[TEMPLATE_LIBRARY_AUDIT]", message);
    return json(req, { error: message }, status);
  }
});
