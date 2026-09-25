import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim() || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")?.trim() || "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!SUPABASE_URL || !ANON_KEY) return json({ error: "Scheduler runtime is not configured" }, 503);

  let request: { action?: unknown } = {};
  try { request = await req.clone().json(); } catch { /* Empty cron requests are valid. */ }
  if (request.action === "status") {
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || "";
    const caller = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await caller.auth.getUser(token);
    if (error || !data.user) return json({ error: "Unauthorized" }, 401);
    return json({ ready: false });
  }

  // Publishing must be bound to a specific release snapshot and support rollback.
  // The former executor selected the newest preview and deleted live files first.
  return json({ error: "Scheduled publishing is unavailable until the release executor is safe" }, 503);
});
