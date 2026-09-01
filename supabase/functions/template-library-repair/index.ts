import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const MAX_ASSETS_PER_REQUEST = 12;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_URL = 3000;

const ALLOWED_SOURCE_HOSTS = new Set([
  "24billions.com",
  "www.24billions.com",
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  doc: "application/msword",
  ppt: "application/vnd.ms-powerpoint",
  zip: "application/zip",
  csv: "text/csv",
  txt: "text/plain",
  pbix: "application/octet-stream",
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

function inferExtension(bytes: Uint8Array) {
  if (hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  if (hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (hasBytes(bytes, [0xff, 0xd8, 0xff])) return "jpg";

  if (isZipContainer(bytes)) {
    if (bytesIncludeAscii(bytes, "ppt/presentation.xml")) return "pptx";
    if (bytesIncludeAscii(bytes, "word/document.xml")) return "docx";
    if (bytesIncludeAscii(bytes, "xl/workbook.xml")) return "xlsx";
    if (bytesIncludeAscii(bytes, "Report/Layout") || bytesIncludeAscii(bytes, "DataModel")) return "pbix";
    return "zip";
  }

  if (isOleCompoundDocument(bytes)) return "ole-office";
  return "";
}

function matchesExpected(extension: string, bytes: Uint8Array) {
  switch (extension) {
    case "pdf": return hasBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    case "png": return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg": return hasBytes(bytes, [0xff, 0xd8, 0xff]);
    case "xlsx": return isZipContainer(bytes) && bytesIncludeAscii(bytes, "xl/workbook.xml");
    case "docx": return isZipContainer(bytes) && bytesIncludeAscii(bytes, "word/document.xml");
    case "pptx": return isZipContainer(bytes) && bytesIncludeAscii(bytes, "ppt/presentation.xml");
    case "pbix": return isZipContainer(bytes) && (bytesIncludeAscii(bytes, "Report/Layout") || bytesIncludeAscii(bytes, "DataModel"));
    case "zip": return isZipContainer(bytes);
    case "xls":
    case "doc":
    case "ppt": return isOleCompoundDocument(bytes);
    case "csv":
    case "txt": return !looksLikeHtml(bytes);
    default: return false;
  }
}

function extensionOf(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function replaceExtension(filename: string, extension: string) {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 145) || "template";
  return `${base}.${extension}`;
}

function isKnownJunk(title: string, filename: string) {
  const rawTitle = title.trim();
  const rawName = filename.trim();
  return rawTitle.startsWith("._")
    || rawTitle.startsWith("~$")
    || rawName.startsWith("._")
    || rawName.startsWith("~$")
    || /^-.*\.(xlsx|xls|docx|doc|pptx|ppt)$/i.test(rawName) && rawTitle.startsWith("~$");
}

function safeCanonicalExtension(expected: string, detected: string) {
  if (!detected || detected === "unknown" || detected === "ole-office") return "";
  if (detected === expected) return expected;

  const officeUpgrade = new Set(["ppt:pptx", "xls:xlsx", "doc:docx"]);
  if (officeUpgrade.has(`${expected}:${detected}`)) return detected;

  return "";
}

function boundedUrl(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, MAX_URL) : "";
}

function assertAllowedSourceUrl(value: unknown) {
  const raw = boundedUrl(value);
  if (!raw) throw new HttpError(400, "Asset has no source download URL");

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new HttpError(400, "Asset has an invalid source download URL");
  }

  if (parsed.protocol !== "https:" || !ALLOWED_SOURCE_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new HttpError(400, "Asset source download host is not allowlisted");
  }
  return parsed.toString();
}

function normalizeGoogleDriveDownloadUrl(value: string) {
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") return value;

  const fileId = parsed.searchParams.get("id")
    || parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    || "";
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(fileId)) return value;

  const direct = new URL("https://drive.usercontent.google.com/download");
  direct.searchParams.set("id", fileId);
  direct.searchParams.set("export", "download");
  direct.searchParams.set("confirm", "t");
  return direct.toString();
}

async function fetchAllowlisted(url: string) {
  let current = normalizeGoogleDriveDownloadUrl(url);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    assertAllowedSourceUrl(current);
    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Tayar-Template-Repair/1.0", "Accept": "*/*" },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new HttpError(502, "Source returned an invalid redirect");
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) throw new HttpError(502, `Source download failed with status ${response.status}`);

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES) {
      throw new HttpError(413, "Source file exceeds the 50 MB repair limit");
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_FILE_BYTES) {
      throw new HttpError(413, "Source file is empty or exceeds the 50 MB repair limit");
    }
    if (looksLikeHtml(bytes)) throw new HttpError(422, "Source returned HTML instead of a file");

    const contentType = (response.headers.get("content-type") || "application/octet-stream")
      .split(";")[0].trim().slice(0, 160);
    return { bytes, contentType, finalUrl: current };
  }

  throw new HttpError(502, "Too many source redirects");
}

async function sha256Hex(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function assertAdmin(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin.from("profiles").select("role,suspended").eq("id", userId).maybeSingle();
  if (error) throw new HttpError(503, "Admin status could not be verified");
  if (!data || data.role !== "admin" || data.suspended === true) throw new HttpError(403, "Admin access required");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    const admin = createAdminClient();
    await assertAdmin(admin, user.id);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const dryRun = body.dryRun !== false;
    const assetIds = Array.isArray(body.assetIds)
      ? [...new Set(body.assetIds.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)))]
      : [];

    if (!assetIds.length || assetIds.length > MAX_ASSETS_PER_REQUEST) {
      throw new HttpError(400, `Provide 1-${MAX_ASSETS_PER_REQUEST} valid asset IDs`);
    }

    const { data: assets, error: loadError } = await admin
      .from("template_assets")
      .select("id,title,category,format,source_download_url,original_filename,storage_path,mime_type,file_size_bytes,sha256,status,is_public,metadata")
      .in("id", assetIds);

    if (loadError) throw new HttpError(500, "Could not load template assets for repair");

    const results: Array<Record<string, unknown>> = [];
    let repairable = 0;
    let repaired = 0;
    let hidden = 0;
    let unchanged = 0;
    let failed = 0;

    for (const asset of assets || []) {
      const id = String(asset.id);
      const title = String(asset.title || "");
      const filename = String(asset.original_filename || title || "template");
      const storagePath = String(asset.storage_path || "");
      const expected = extensionOf(filename);

      try {
        if (asset.status !== "ready" || !storagePath.startsWith("24billions/")) {
          unchanged += 1;
          results.push({ id, title, status: "unchanged", reason: "Asset is not a ready 24Billions storage asset" });
          continue;
        }

        if (isKnownJunk(title, filename)) {
          repairable += 1;
          if (!dryRun) {
            const { error: hideError } = await admin.from("template_assets").update({
              status: "failed",
              is_public: false,
              error_message: "Excluded temporary/macOS metadata file during integrity repair",
              updated_at: new Date().toISOString(),
            }).eq("id", id);
            if (hideError) throw new Error("Could not hide junk asset");
            hidden += 1;
          }
          results.push({ id, title, status: dryRun ? "planned" : "hidden", action: "hide-junk", oldStoragePath: storagePath });
          continue;
        }

        let storedBytes: Uint8Array | null = null;
        const { data: storedBlob } = await admin.storage.from("template-library").download(storagePath);
        if (storedBlob) storedBytes = new Uint8Array(await storedBlob.arrayBuffer());

        if (storedBytes && matchesExpected(expected, storedBytes) && Number(asset.file_size_bytes || 0) === storedBytes.byteLength) {
          unchanged += 1;
          results.push({ id, title, status: "unchanged", reason: "Stored object now validates successfully" });
          continue;
        }

        const detectedStored = storedBytes ? inferExtension(storedBytes) : "";
        const canonicalStored = storedBytes ? safeCanonicalExtension(expected, detectedStored) : "";

        let sourceBytes: Uint8Array;
        let sourceContentType: string;
        let finalSourceUrl: string;
        let canonicalExtension = canonicalStored;
        let origin = "stored-object";

        if (canonicalStored && storedBytes) {
          sourceBytes = storedBytes;
          sourceContentType = MIME_BY_EXTENSION[canonicalStored] || String(asset.mime_type || "application/octet-stream");
          finalSourceUrl = String((asset.metadata as Record<string, unknown> | null)?.final_source_url || asset.source_download_url || "");
        } else {
          const sourceUrl = assertAllowedSourceUrl(asset.source_download_url);
          const downloaded = await fetchAllowlisted(sourceUrl);
          sourceBytes = downloaded.bytes;
          sourceContentType = downloaded.contentType;
          finalSourceUrl = downloaded.finalUrl;
          origin = "source-redownload";

          const detectedSource = inferExtension(sourceBytes);
          canonicalExtension = matchesExpected(expected, sourceBytes)
            ? expected
            : safeCanonicalExtension(expected, detectedSource);

          if (!canonicalExtension) {
            throw new HttpError(422, `Source still does not match .${expected || "unknown"} (detected: ${detectedSource || "unknown"})`);
          }
        }

        repairable += 1;
        const newFilename = canonicalExtension === expected ? filename : replaceExtension(filename, canonicalExtension);
        const newFormat = canonicalExtension;
        const checksum = await sha256Hex(sourceBytes);
        const safeCategory = String(asset.category || "uncategorized")
          .toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "uncategorized";
        const newStoragePath = `24billions/${safeCategory}/${checksum.slice(0, 16)}-${newFilename}`;
        const mimeType = MIME_BY_EXTENSION[canonicalExtension] || sourceContentType || "application/octet-stream";

        if (!dryRun) {
          const { error: uploadError } = await admin.storage.from("template-library").upload(newStoragePath, sourceBytes, {
            contentType: mimeType,
            upsert: true,
          });
          if (uploadError) throw new Error("Could not write repaired storage object");

          const oldMetadata = asset.metadata && typeof asset.metadata === "object" ? asset.metadata as Record<string, unknown> : {};
          const { error: updateError } = await admin.from("template_assets").update({
            original_filename: newFilename,
            format: newFormat,
            storage_path: newStoragePath,
            mime_type: mimeType,
            file_size_bytes: sourceBytes.byteLength,
            sha256: checksum,
            status: "ready",
            is_public: true,
            error_message: null,
            updated_at: new Date().toISOString(),
            metadata: {
              ...oldMetadata,
              final_source_url: finalSourceUrl,
              repaired_at: new Date().toISOString(),
              repaired_by: user.id,
              repair_origin: origin,
              previous_storage_path: storagePath,
              previous_filename: filename,
            },
          }).eq("id", id);
          if (updateError) throw new Error("Could not finalize repaired asset metadata");
          repaired += 1;
        }

        results.push({
          id,
          title,
          status: dryRun ? "planned" : "repaired",
          action: canonicalExtension === expected ? "restore-content" : "canonicalize-extension",
          origin,
          expected,
          detectedStored: detectedStored || "missing",
          newExtension: canonicalExtension,
          oldFilename: filename,
          newFilename,
          oldStoragePath: storagePath,
          newStoragePath,
          bytes: sourceBytes.byteLength,
        });
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "Repair failed";
        results.push({ id, title, status: "failed", error: message.slice(0, 500) });
      }
    }

    return json(req, {
      ok: true,
      dryRun,
      requested: assetIds.length,
      loaded: (assets || []).length,
      repairable,
      repaired,
      hidden,
      unchanged,
      failed,
      results,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected template repair error";
    console.error("[TEMPLATE_LIBRARY_REPAIR]", message);
    return json(req, { error: message }, status);
  }
});
