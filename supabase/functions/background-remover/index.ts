import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

Deno.serve(() => new Response(JSON.stringify({
  error: "Background Remover now runs locally in the browser. Update Tayar to use the local version.",
  retired: true,
}), {
  status: 410,
  headers,
}));
