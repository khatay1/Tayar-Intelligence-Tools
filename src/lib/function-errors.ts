export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: unknown };
        if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
      } catch {
        // Preserve the SDK or fallback message when the response is not JSON.
      }
    }
  }
  return error instanceof Error && error.message ? error.message : fallback;
}
