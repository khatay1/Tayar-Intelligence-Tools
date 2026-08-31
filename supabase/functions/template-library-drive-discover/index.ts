import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const MAX_REQUEST_CHARS = 30_000;
const MAX_FOLDERS_PER_REQUEST = 12;
const MAX_RESULTS_PER_REQUEST = 600;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

type FolderInput = {
  id?: unknown;
  path?: unknown;
};

type DiscoveredFile = {
  id: string;
  name: string;
  format: string;
  path: string;
  parentFolderId: string;
  downloadUrl: string;
};

type DiscoveredFolder = {
  id: string;
  name: string;
  path: string;
  parentFolderId: string;
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

function assertFolderId(value: unknown) {
  const id = bounded(value, 220);
  if (!/^[a-zA-Z0-9_-]{10,200}$/.test(id)) {
    throw new HttpError(400, "Invalid Google Drive folder id");
  }
  return id;
}

function sanitizePathPart(value: string) {
  const cleaned = [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || '\\/:*?"<>|'.includes(char) ? "-" : char;
    })
    .join("");

  return cleaned
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "unnamed";
}

function normalizePath(value: unknown) {
  const raw = bounded(value, 1200);
  if (!raw) return "";
  return raw
    .split("/")
    .map((part) => sanitizePathPart(part))
    .filter(Boolean)
    .join("/")
    .slice(0, 1000);
}

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_match, decimal) => {
      const code = Number(decimal);
      return Number.isFinite(code) ? String.fromCharCode(code) : "";
    })
    .replace(/\s+/g, " ")
    .trim();
}

function formatFromName(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]{1,10})$/);
  return match?.[1] || "unknown";
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

async function fetchFolderHtml(folderId: string) {
  let current = `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}`;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const parsed = new URL(current);
    if (
      parsed.protocol !== "https:"
      || (parsed.hostname !== "drive.google.com" && parsed.hostname !== "www.google.com")
    ) {
      throw new HttpError(502, "Google Drive folder redirect left the allowlisted host");
    }

    const response = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 Tayar-Template-Library/1.0",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new HttpError(502, "Google Drive returned an invalid redirect");
      current = new URL(location, current).toString();
      continue;
    }

    if (!response.ok) {
      throw new HttpError(502, `Google Drive folder request failed with status ${response.status}`);
    }

    const contentLength = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
      throw new HttpError(413, "Google Drive folder page exceeds the discovery limit");
    }

    const html = await response.text();
    if (!html || html.length > MAX_HTML_BYTES) {
      throw new HttpError(413, "Google Drive folder page is empty or exceeds the discovery limit");
    }

    return html;
  }

  throw new HttpError(502, "Too many Google Drive folder redirects");
}

function parseFolderHtml(
  html: string,
  parent: { id: string; path: string },
): { files: DiscoveredFile[]; folders: DiscoveredFolder[] } {
  const files: DiscoveredFile[] = [];
  const folders: DiscoveredFolder[] = [];
  const seen = new Set<string>();

  const anchorPattern = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const href = (match[1] || match[2] || "").replace(/&amp;/g, "&");
    const rawName = decodeHtml(match[3] || "");
    const name = sanitizePathPart(rawName || "unnamed");

    const fileMatch = href.match(/^https:\/\/drive\.google\.com\/file\/d\/([-\w]{10,200})\/view/i);
    if (fileMatch) {
      const id = fileMatch[1];
      if (seen.has(`file:${id}`)) continue;
      seen.add(`file:${id}`);
      files.push({
        id,
        name,
        format: formatFromName(name),
        path: [parent.path, name].filter(Boolean).join("/"),
        parentFolderId: parent.id,
        downloadUrl: `https://drive.google.com/uc?id=${encodeURIComponent(id)}`,
      });
      continue;
    }

    const docsMatch = href.match(/^https:\/\/docs\.google\.com\/[a-z]+\/d\/([-\w]{10,200})\//i);
    if (docsMatch) {
      const id = docsMatch[1];
      if (seen.has(`file:${id}`)) continue;
      seen.add(`file:${id}`);
      files.push({
        id,
        name,
        format: formatFromName(name),
        path: [parent.path, name].filter(Boolean).join("/"),
        parentFolderId: parent.id,
        downloadUrl: `https://drive.google.com/uc?id=${encodeURIComponent(id)}`,
      });
      continue;
    }

    const folderMatch = href.match(/^https:\/\/drive\.google\.com\/drive\/folders\/([-\w]{10,200})/i);
    if (folderMatch) {
      const id = folderMatch[1];
      if (seen.has(`folder:${id}`)) continue;
      seen.add(`folder:${id}`);
      folders.push({
        id,
        name,
        path: [parent.path, name].filter(Boolean).join("/"),
        parentFolderId: parent.id,
      });
    }
  }

  return { files, folders };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const admin = createAdminClient();

  try {
    const user = await requireUser(req);
    await assertAdmin(admin, user.id);

    const raw = await req.text();
    if (!raw || raw.length > MAX_REQUEST_CHARS) {
      throw new HttpError(413, "Discovery request is empty or too large");
    }

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
    const suppliedFolders = Array.isArray(input.folders)
      ? input.folders
      : input.folderId
        ? [{ id: input.folderId, path: input.path }]
        : [];

    if (!suppliedFolders.length || suppliedFolders.length > MAX_FOLDERS_PER_REQUEST) {
      throw new HttpError(
        400,
        `Provide 1-${MAX_FOLDERS_PER_REQUEST} Google Drive folders per request`,
      );
    }

    const requested = suppliedFolders.map((entry) => {
      const folder = (entry && typeof entry === "object" && !Array.isArray(entry))
        ? entry as FolderInput
        : {};
      return {
        id: assertFolderId(folder.id),
        path: normalizePath(folder.path),
      };
    });

    const files: DiscoveredFile[] = [];
    const folders: DiscoveredFolder[] = [];
    const errors: Array<{ folderId: string; error: string }> = [];

    for (const folder of requested) {
      try {
        const html = await fetchFolderHtml(folder.id);
        const parsedFolder = parseFolderHtml(html, folder);

        for (const file of parsedFolder.files) {
          if (files.length + folders.length >= MAX_RESULTS_PER_REQUEST) break;
          files.push(file);
        }
        for (const child of parsedFolder.folders) {
          if (files.length + folders.length >= MAX_RESULTS_PER_REQUEST) break;
          folders.push(child);
        }
      } catch (error) {
        errors.push({
          folderId: folder.id,
          error: error instanceof Error ? error.message.slice(0, 400) : "Folder discovery failed",
        });
      }

      if (files.length + folders.length >= MAX_RESULTS_PER_REQUEST) break;
    }

    return json(req, {
      requestedFolderCount: requested.length,
      fileCount: files.length,
      folderCount: folders.length,
      files,
      folders,
      errors,
      limits: {
        maxFoldersPerRequest: MAX_FOLDERS_PER_REQUEST,
        maxResultsPerRequest: MAX_RESULTS_PER_REQUEST,
      },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected Drive discovery error";
    console.error("[TEMPLATE DRIVE DISCOVERY]", message);
    return json(req, { error: message }, status);
  }
});
