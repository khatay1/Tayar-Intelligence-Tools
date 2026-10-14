/** Production custom-code execution requires its own final activation switch.
 * Preview/local use keeps the existing pair of runtime and feature flags. */
export function isWebsiteCustomExecutionEnabled(
  environment: Record<string, string | undefined> = process.env,
): boolean {
  if (environment.WEBSITE_APPLICATION_RUNTIME_ENABLED !== 'true'
    || environment.WEBSITE_CUSTOM_EXECUTION_ENABLED !== 'true') return false;
  return environment.VERCEL_ENV !== 'production'
    || environment.WEBSITE_CUSTOM_EXECUTION_PRODUCTION_ENABLED === 'true';
}
