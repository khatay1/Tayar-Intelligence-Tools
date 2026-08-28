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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const user = await requireUser(req);
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
    params.set("return_url", `${safeAppOrigin(req)}/?billing=portal-return`);
    const session = await stripeRequest("/v1/billing_portal/sessions", { params });
    if (!session?.url) throw new HttpError(502, "Stripe did not return a portal URL");
    return jsonResponse({ url: session.url });
  } catch (error) {
    return handleError(error);
  }
});
