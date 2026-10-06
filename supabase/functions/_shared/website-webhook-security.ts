type WebhookConnection = { write(data: Uint8Array): Promise<number>; read(data: Uint8Array): Promise<number | null>; close(): void };
type WebhookNetwork = {
  resolve(host: string): Promise<string[]>;
  connect(address: string, hostname: string, signal: AbortSignal): Promise<WebhookConnection>;
};

export function publicWebhookAddress(address: string): boolean {
  if (address.includes(":")) {
    // Fail closed: this transport currently uses IPv4 only. IPv6 and mapped
    // addresses cannot bypass the IPv4 private/special-use checks below.
    return false;
  }
  const octets = address.split(".");
  if (octets.length !== 4 || octets.some(x => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return false;
  const [a, b, c] = octets.map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) || (a === 203 && b === 0 && c === 113));
}

const runtimeNetwork: WebhookNetwork = {
  async resolve(host) {
    // Resolve only the family this transport supports. The connection below
    // consumes this exact numeric result, so DNS is never queried a second time.
    return Deno.resolveDns(host, "A");
  },
  async connect(address, hostname, signal) {
    const tcp = await Deno.connect({ hostname: address, port: 443 });
    const close = () => { try { tcp.close(); } catch { /* already closed */ } };
    signal.addEventListener("abort", close, { once: true });
    try { signal.throwIfAborted(); return await Deno.startTls(tcp, { hostname }); }
    catch (error) { close(); throw error; }
    finally { signal.removeEventListener("abort", close); }
  },
};

/** Pure lexical preflight for saved form configuration. Network delivery also pins DNS. */
export function validWebsiteWebhookDestination(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (url.protocol !== "https:" || url.username || url.password || url.hash || (url.port && url.port !== "443")) return false;
    if ([...url.searchParams.keys()].some(key => /^(api[_-]?key|access[_-]?token|token|secret|password|authorization)$/i.test(key))) return false;
    // Require a DNS name; reject every IPv4/IPv6 literal without treating DNS
    // prefixes such as "fcloud" or "fdomain" as private IPv6 addresses.
    if (/^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".") || /(^|\.)(localhost|local|internal|test|invalid|onion)$/.test(host)) return false;
    if (/^127\.|^10\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    return true;
  } catch { return false; }
}

export async function deliverSignedWebsiteWebhook(url: string, payload: string, secret: string | undefined, send: typeof fetch = sendPinnedWebsiteWebhook): Promise<Response> {
  if (!validWebsiteWebhookDestination(url)) throw new Error("Invalid webhook destination");
  if (!secret) throw new Error("Webhook signing is not configured");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return send(url, { method: "POST", redirect: "error", headers: {
    "Content-Type": "application/json", "X-Tayar-Event": "website.form.submitted", "X-Tayar-Signature": hex,
  }, body: payload, signal: AbortSignal.timeout(10_000) });
}

/** Connect to the checked numeric IP, then use the original hostname for
 * TLS certificate validation/SNI. Send HTTP/1.1 directly: no redirect or
 * implicit DNS resolution is possible, and response headers are bounded. */
export async function sendPinnedWebsiteWebhook(url: string | URL | Request, init?: RequestInit,
  network: WebhookNetwork = runtimeNetwork): Promise<Response> {
  const target = new URL(String(url));
  if (!validWebsiteWebhookDestination(target.href)) throw new Error("Invalid webhook destination");
  const signal = init?.signal ?? AbortSignal.timeout(10_000);
  let connection: WebhookConnection | undefined;
  const close = () => { try { connection?.close(); } catch { /* already closed */ } };
  const bounded = <T>(operation: Promise<T>): Promise<T> => new Promise((resolve, reject) => {
    const abort = () => { close(); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    if (signal.aborted) abort();
  });
  signal.throwIfAborted();
  try {
    const addresses = await bounded(network.resolve(target.hostname));
    signal.throwIfAborted();
    if (!addresses.length || addresses.some(address => !publicWebhookAddress(address))) throw new Error("Invalid webhook DNS destination");
    connection = await bounded(network.connect(addresses[0], target.hostname, signal).then(conn => {
      if (signal.aborted) { conn.close(); throw signal.reason; }
      connection = conn;
      return conn;
    }));
    const body = String(init?.body ?? "");
    const headers = new Headers(init?.headers);
    headers.set("Host", target.hostname);
    headers.set("Connection", "close");
    headers.set("Content-Length", String(new TextEncoder().encode(body).length));
    // No transfer framing or proxy headers supplied by callers.
    headers.delete("Transfer-Encoding");
    const serialized = [...headers].map(([key, value]) => `${key}: ${value}\r\n`).join("");
    const bytes = new TextEncoder().encode(`POST ${target.pathname}${target.search} HTTP/1.1\r\n${serialized}\r\n${body}`);
    let offset = 0;
    while (offset < bytes.length) {
      const written = await bounded(connection.write(bytes.subarray(offset)));
      if (written <= 0) throw new Error("Webhook connection closed");
      offset += written;
    }
    const buffer = new Uint8Array(8192);
    let used = 0;
    while (used < buffer.length) {
      const read = await bounded(connection.read(buffer.subarray(used)));
      if (read === null || read === 0) throw new Error("Webhook response incomplete");
      used += read;
      const text = new TextDecoder().decode(buffer.subarray(0, used));
      if (!text.includes("\r\n\r\n")) continue;
      const match = /^HTTP\/1\.[01] ([2-5]\d{2})[ \r]/.exec(text);
      if (!match) throw new Error("Invalid webhook response");
      const status = Number(match[1]);
      if (status >= 300 && status < 400) throw new Error("Webhook redirects are forbidden");
      return new Response(null, { status });
    }
    throw new Error("Webhook response headers too large");
  } finally { close(); }
}
