import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  createAdminClient,
  handleError,
  HttpError,
  jsonResponse,
  requireUser,
  safeAppOrigin,
  stripeRequest,
} from "../_shared/billing.ts";

function billingPortalReturnUrl(origin: string, nativeClient: boolean): string {
  const url = new URL(origin);
  url.pathname = "/";
  url.searchParams.set("billing", "portal-return");
  if (nativeClient) url.searchParams.set("native", "1");
  url.hash = "workspace/subscription";
  return url.toString();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const nativeClient = String(body?.client || "web").trim().toLowerCase() === "native";
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new HttpError(500, "Could not load billing account");
    if (!data?.stripe_customer_id) throw new HttpError(409, "No Stripe billing profile exists yet");

    const params = new URLSearchParams();
    params.set("customer", data.stripe_customer_id);
    params.set("return_url", billingPortalReturnUrl(safeAppOrigin(req), nativeClient));
    const session = await stripeRequest("/v1/billing_portal/sessions", { params });
    if (!session?.url) throw new HttpError(502, "Stripe did not return a portal URL");
    return jsonResponse({ url: session.url });
  } catch (error) {
    return handleError(error);
  }
});
