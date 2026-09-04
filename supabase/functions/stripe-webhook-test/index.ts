import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve((_req: Request) => {
  return new Response(
    JSON.stringify({ error: "Test Stripe webhook endpoint retired in production." }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    },
  );
});
