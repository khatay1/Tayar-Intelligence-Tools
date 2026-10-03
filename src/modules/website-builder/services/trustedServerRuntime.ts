type DenoGlobal = { Deno?: { version?: { deno?: unknown } } };

/** Deno Edge exposes `window` for web compatibility, so `window` alone cannot
 * distinguish a browser bundle from a trusted Edge server runtime. */
export function isUntrustedBrowserRuntime(): boolean {
  const deno = (globalThis as DenoGlobal).Deno;
  return typeof window !== 'undefined' && typeof deno?.version?.deno !== 'string';
}
