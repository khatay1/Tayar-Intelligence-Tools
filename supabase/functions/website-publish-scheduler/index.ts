import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim() || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SECRET_KEY")?.trim() || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
const CRON_SECRET = Deno.env.get("WEBSITE_PUBLISH_CRON_SECRET")?.trim() || "";
const BATCH_SIZE = 10;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function safeSegment(value: unknown): string {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function authorize(req: Request): boolean {
  if (!CRON_SECRET) return false;
  const bearer = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
  const header = req.headers.get("x-cron-secret")?.trim() || "";
  return bearer === CRON_SECRET || header === CRON_SECRET;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "Scheduler runtime is not configured" }, 503);
  if (!authorize(req)) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date().toISOString();
  const { data: due, error: dueError } = await admin
    .from("website_publish_schedules")
    .select("id,project_id,user_id,environment,mode,page_ids,scheduled_at,release_note,status")
    .eq("status", "scheduled")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (dueError) return json({ error: "Could not load scheduled publishes" }, 500);

  const results: Array<{ id: string; status: string; error?: string }> = [];
  for (const schedule of due || []) {
    const id = String(schedule.id || "");
    try {
      const { data: claimed, error: claimError } = await admin
        .from("website_publish_schedules")
        .update({ status: "processing", last_error: null, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "scheduled")
        .select("id")
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claimed) continue;

      const ownerId = safeSegment(schedule.user_id);
      const projectId = safeSegment(schedule.project_id);
      if (!ownerId || !projectId) throw new Error("Invalid publish owner or project id");
      if (schedule.environment !== "production") throw new Error("Scheduled executor currently accepts production releases only");

      const previewRoot = `${ownerId}/${projectId}/previews`;
      const productionRoot = `${ownerId}/${projectId}`;
      const { data: previewObjects, error: listError } = await admin.storage.from("website-published").list(previewRoot, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (listError) throw listError;
      const tokenFolder = (previewObjects || []).find((item) => item.name && !item.name.includes("."));
      if (!tokenFolder?.name) throw new Error("No staged release is available for this scheduled publish");
      const releaseRoot = `${previewRoot}/${tokenFolder.name}/release`;
      const { data: releaseFiles, error: releaseError } = await admin.storage.from("website-published").list(releaseRoot, { limit: 1000 });
      if (releaseError) throw releaseError;
      const files = (releaseFiles || []).filter((item) => item.name && item.name !== ".emptyFolderPlaceholder");
      if (!files.length) throw new Error("Scheduled release bundle is empty");

      const { data: currentFiles } = await admin.storage.from("website-published").list(productionRoot, { limit: 1000 });
      const removable = (currentFiles || []).filter((item) => item.name && !item.name.includes("/") && item.name !== "previews").map((item) => `${productionRoot}/${item.name}`);
      if (removable.length) {
        const { error } = await admin.storage.from("website-published").remove(removable);
        if (error) throw error;
      }

      for (const file of files) {
        const sourcePath = `${releaseRoot}/${file.name}`;
        const { data: blob, error: downloadError } = await admin.storage.from("website-published").download(sourcePath);
        if (downloadError || !blob) throw downloadError || new Error(`Could not read ${file.name}`);
        const { error: uploadError } = await admin.storage.from("website-published").upload(`${productionRoot}/${file.name}`, blob, { upsert: true, contentType: blob.type || undefined });
        if (uploadError) throw uploadError;
      }

      const publishedAt = new Date().toISOString();
      const { error: projectError } = await admin.from("projects").update({ published: true, updated_at: publishedAt }).eq("id", projectId).eq("user_id", ownerId);
      if (projectError) throw projectError;
      const { error: finishError } = await admin.from("website_publish_schedules").update({ status: "published", last_error: null, updated_at: publishedAt }).eq("id", id).eq("status", "processing");
      if (finishError) throw finishError;
      results.push({ id, status: "published" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scheduled publish failed";
      await admin.from("website_publish_schedules").update({ status: "failed", last_error: message.slice(0, 1000), updated_at: new Date().toISOString() }).eq("id", id).eq("status", "processing");
      results.push({ id, status: "failed", error: message });
    }
  }

  return json({ processed: results.length, results });
});
