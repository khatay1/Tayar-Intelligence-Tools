import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient } from "../_shared/billing.ts";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sandbox = "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation; default-src 'self' https: data: blob:; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src 'self' https: data: blob:; object-src 'none'; base-uri 'none'";

Deno.serve(async (req: Request) => {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": sandbox };
  const fail = (status: number) => new Response("Published file is unavailable", { status, headers });
  if (!["GET", "HEAD"].includes(req.method)) return fail(405);
  try {
    const url = new URL(req.url);
    const ownerId = url.searchParams.get("ownerId") || "";
    const projectId = url.searchParams.get("projectId") || "";
    const file = url.searchParams.get("file") || "index.html";
    const token = url.searchParams.get("previewToken") || "";
    const parts = file.split("/");
    if (!uuid.test(ownerId) || !uuid.test(projectId) || file.length > 500
      || parts.some(part => !part || part === "." || part === ".." || !/^[\p{L}\p{N}._-]+$/u.test(part))
      || /^(versions|previews|staging|release)(?:\/|$)/i.test(file)
      || (token && !/^[a-zA-Z0-9_-]{12,128}$/.test(token))) return fail(404);
    const admin = createAdminClient();
    const { data: project, error } = await admin.from("projects").select("id,content")
      .eq("id", projectId).eq("user_id", ownerId).eq("type", "website-builder").is("deleted_at", null).maybeSingle();
    if (error) return fail(503);
    if (!project || project.content?.application?.auth?.enabled === true) return fail(404);
    // The live root is installed only by publication. Preview roots require
    // their opaque share token. Internal archives and private apps never pass.
    const root = `${ownerId}/${projectId}${token ? `/previews/${token}` : ""}`;
    const download = await admin.storage.from("published-sites").download(`${root}/${file}`);
    if (download.error || !download.data) return fail(404);
    if (download.data.size > 5 * 1024 * 1024) return fail(413);
    return new Response(req.method === "HEAD" ? null : download.data, { headers: {
      ...headers, "Content-Type": download.data.type || "application/octet-stream",
      ...(token ? { "X-Robots-Tag": "noindex, nofollow, noarchive" } : {}),
    } });
  } catch { return fail(503); }
});
