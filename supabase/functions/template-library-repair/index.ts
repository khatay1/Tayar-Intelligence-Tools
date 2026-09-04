import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

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

async function assertAdmin(admin: ReturnType<typeof createAdminClient>, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("role,suspended")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new HttpError(503, "Admin status could not be verified");
  if (!data || data.role !== "admin" || data.suspended === true) {
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

    return json(req, {
      error: "Template repair is temporarily disabled to protect the Supabase egress quota.",
    }, 423);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected repair error";
    return json(req, { error: message }, status);
  }
});
