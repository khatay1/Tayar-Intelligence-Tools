import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY is not configured" }),
        {
          status: 503,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        },
      );
    }

    const body = await req.json();

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const model = "gemini-3.6-flash";

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "Messages are required" }),
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        },
      );
    }

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

    console.log("[AI ENGINE] Calling Gemini:", model);

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent` +
      `?alt=sse&key=${encodeURIComponent(GEMINI_API_KEY)}`;

    console.log("[AI ENGINE] Starting Gemini streaming:", model);

    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!upstream.ok) {
      const rawError = await upstream.text();

      console.error("[GEMINI ERROR]", upstream.status, rawError);

      return new Response(
        JSON.stringify({
          error: "Gemini request failed",
          status: upstream.status,
          details: rawError.slice(0, 3000),
        }),
        {
          status: 502,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json",
          },
        },
      );
    }
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        let buffer = "";

        const send = (data: any) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              buffer += decoder.decode();
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() || "";

            for (const event of events) {
              const lines = event.split(/\r?\n/);

              for (const line of lines) {
                if (!line.startsWith("data:")) continue;

                const payload = line.slice(5).trim();
                if (!payload || payload === "[DONE]") continue;

                try {
                  const chunk = JSON.parse(payload);

                  const content =
                    chunk?.candidates?.[0]?.content?.parts
                      ?.map((p: any) => p?.text || "")
                      .join("") || "";

                  if (content) {
                    send({ content });
                  }
                } catch {
                  console.warn("[AI ENGINE] Could not parse Gemini chunk");
                }
              }
            }
          }

          if (buffer.trim()) {
            const lines = buffer.split(/\r?\n/);

            for (const line of lines) {
              if (!line.startsWith("data:")) continue;

              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;

              try {
                const chunk = JSON.parse(payload);

                const content =
                  chunk?.candidates?.[0]?.content?.parts
                    ?.map((p: any) => p?.text || "")
                    .join("") || "";

                if (content) {
                  send({ content });
                }
              } catch {
                // Ignore incomplete final chunk
              }
            }
          }

          send({
            done: true,
            provider: "gemini",
            model,
          });

          controller.close();
        } catch (error) {
          console.error("[AI ENGINE STREAM ERROR]", error);

          send({
            error: error instanceof Error
              ? error.message
              : "Streaming failed",
            code: "STREAM_ERROR",
          });

          controller.close();
        }
      },
    });
  } catch (error) {
    console.error("[AI ENGINE ERROR]", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
        },
      },
    );
  }
});

