const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST required" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const auth = req.headers.get("Authorization");

    if (!auth) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = messages.find((m: any) => m.role === "system");
    const contents = messages
      .filter((m: any) => m.role !== "system")
      .map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: String(m.content ?? "") }],
      }));

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: body.temperature ?? 0.7,
        maxOutputTokens: body.maxTokens ?? 4096,
      },
    };

    if (system) {
      requestBody.systemInstruction = {
        parts: [{ text: String(system.content ?? "") }],
      };
    }

    if (body.jsonMode) {
      requestBody.generationConfig.responseMimeType = "application/json";
    }

    const model = body.model || "gemini-3.6-flash";

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const raw = await upstream.text();

    if (!upstream.ok) {
      console.error("[GEMINI ERROR]", upstream.status, raw);

      return new Response(
        JSON.stringify({
          error: "Gemini request failed",
          status: upstream.status,
          details: raw.slice(0, 3000),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = JSON.parse(raw);

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text || "")
        .join("") || "";

    const encoder = new TextEncoder();`r`n    const output = new ReadableStream({`r`n      start(controller) {`r`n        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}` + "`r`n`r`n"));`r`n        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, provider: "gemini", model })}` + "`r`n`r`n"));`r`n        controller.close();`r`n      },`r`n    });`r`n`r`n    return new Response(output, {`r`n      status: 200,`r`n      headers: { ...corsHeaders, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },`r`n    });
  } catch (error) {
    console.error("[AI ENGINE ERROR]", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});


