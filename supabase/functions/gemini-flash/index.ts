import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve((_req: Request) => {
  return new Response(
    JSON.stringify({ error: "This endpoint has been retired. Use ai-engine." }),
    {
      status: 410,
      headers: { "Content-Type": "application/json" },
    },
  );
});
