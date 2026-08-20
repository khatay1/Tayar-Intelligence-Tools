import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const FAL_KEY = Deno.env.get("FAL_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const body = await req.json();

    // Image generation route
    if (body.action === "generate-image") {
      if (!FAL_KEY) {
        return new Response(
          JSON.stringify({ error: "FAL_KEY is not configured" }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const prompt =
        String(body.prompt || "Professional website image");

      const imageResponse = await fetch(
        "https://fal.run/fal-ai/flux/dev",
        {
          method: "POST",
          headers: {
            "Authorization": `Key ${FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            image_size: "landscape_16_9",
            num_images: 1,
          }),
        },
      );

      const rawImageResponse = await imageResponse.text();

      let imageData: any;
      try {
        imageData = JSON.parse(rawImageResponse);
      } catch {
        imageData = { raw: rawImageResponse };
      }

      console.log("[IMAGE PROVIDER]", imageResponse.status, imageData);

      if (!imageResponse.ok) {
        return new Response(
          JSON.stringify({
            error: "Image provider request failed",
            providerStatus: imageResponse.status,
            details: imageData,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const imageUrl =
        imageData?.images?.[0]?.url;

      if (!imageUrl) {
        return new Response(
          JSON.stringify({
            error: "Image provider returned no image",
            details: imageData,
          }),
          {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          content: JSON.stringify({
            url: imageUrl,
          }),
          json: {
            url: imageUrl,
          },
          model: "flux",
          provider: "fal",
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "Messages are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const model = "gemini-3.6-flash";

    const system = messages.find((m: any) => m.role === "system");
    const chatMessages = messages.filter((m: any) => m.role !== "system");

    const contents = chatMessages.map((m: any) => ({
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

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
      `?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    console.log("[AI ENGINE] Calling Gemini:", model);

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

    if (!text) {
      console.error("[AI ENGINE] Empty Gemini response:", raw);

      return new Response(
        JSON.stringify({
          error: "Gemini returned an empty response",
          details: raw.slice(0, 3000),
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        content: text,
        tokensIn: 0,
        tokensOut: 0,
        model,
        provider: "gemini",
        costUsd: 0,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
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
