import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve((req: Request) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") return new Response("ok", { headers });

  return new Response(JSON.stringify({
    error: "Legacy Supabase Drive template discovery is retired. Template delivery now uses Cloudflare R2.",
  }), { status: 410, headers });
});
