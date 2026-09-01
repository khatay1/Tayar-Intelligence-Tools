import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, HttpError, requireUser } from "../_shared/billing.ts";

const MAX_ASSET_IDS = 200;

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

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const assetIds = Array.isArray(body.assetIds)
      ? [...new Set(body.assetIds.filter((value): value is string => (
        typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)
      )))]
      : [];

    if (!assetIds.length || assetIds.length > MAX_ASSET_IDS) {
      throw new HttpError(400, `Provide 1-${MAX_ASSET_IDS} valid asset IDs`);
    }

    const { data: assets, error: loadError } = await admin
      .from("template_assets")
      .select("id,title,storage_path")
      .in("id", assetIds);

    if (loadError) throw new HttpError(500, "Could not load invalid template assets");

    const loadedIds = (assets || []).map((asset) => String(asset.id));
    const rejected = (assets || []).filter((asset) => !String(asset.storage_path || "").startsWith("24billions/"));
    if (rejected.length > 0) {
      throw new HttpError(409, "Deletion request contains a non-24Billions asset");
    }

    const targetIdSet = new Set(loadedIds);
    const candidatePaths = [...new Set((assets || [])
      .map((asset) => String(asset.storage_path || ""))
      .filter((path) => path.startsWith("24billions/")))];

    const removablePaths: string[] = [];
    const preservedSharedPaths: string[] = [];

    for (const path of candidatePaths) {
      const { data: refs, error: refsError } = await admin
        .from("template_assets")
        .select("id")
        .eq("storage_path", path)
        .limit(50);

      if (refsError) throw new HttpError(500, "Could not verify shared template storage references");

      const hasExternalReference = (refs || []).some((row) => !targetIdSet.has(String(row.id)));
      if (hasExternalReference) preservedSharedPaths.push(path);
      else removablePaths.push(path);
    }

    let storageDeleted = 0;
    const storageDeleteFailures: Array<{ path: string; error: string }> = [];

    for (const path of removablePaths) {
      const { error: storageError } = await admin.storage.from("template-library").remove([path]);
      if (storageError) {
        storageDeleteFailures.push({ path, error: storageError.message || "Storage delete failed" });
      } else {
        storageDeleted += 1;
      }
    }

    const { error: deleteError } = await admin
      .from("template_assets")
      .delete()
      .in("id", loadedIds);

    if (deleteError) {
      throw new HttpError(500, "Could not delete invalid template database rows");
    }

    return json(req, {
      ok: true,
      requested: assetIds.length,
      loaded: loadedIds.length,
      deletedRows: loadedIds.length,
      missingRows: Math.max(0, assetIds.length - loadedIds.length),
      storageCandidates: candidatePaths.length,
      storageDeleted,
      preservedSharedStorage: preservedSharedPaths.length,
      storageDeleteFailures,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected invalid template deletion error";
    console.error("[TEMPLATE_LIBRARY_DELETE_INVALID]", message);
    return json(req, { error: message }, status);
  }
});
