/** Lexical network preflight. Infrastructure egress policy must also block private DNS answers. */
export function validWebsiteWebhookDestination(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) return false;
    if ([...url.searchParams.keys()].some(key => /^(api[_-]?key|access[_-]?token|token|secret|password|authorization)$/i.test(key))) return false;
    if (/^[\d.]+$/.test(host) || !host.includes(".") || /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host)) return false;
    if (/^127\.|^10\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (/^fc|^fd|^fe[89ab]/i.test(host.replaceAll(":", ""))) return false;
    return true;
  } catch { return false; }
}

export async function deliverSignedWebsiteWebhook(url: string, payload: string, secret: string | undefined, send: typeof fetch = fetch): Promise<Response> {
  if (!validWebsiteWebhookDestination(url)) throw new Error("Invalid webhook destination");
  if (!secret) throw new Error("Webhook signing is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return send(url, { method: "POST", redirect: "error", headers: {
    "Content-Type": "application/json", "X-Tayar-Event": "website.form.submitted", "X-Tayar-Signature": hex,
  }, body: payload, signal: AbortSignal.timeout(10_000) });
}
