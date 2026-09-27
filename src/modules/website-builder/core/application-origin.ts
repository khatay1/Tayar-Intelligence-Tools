const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Server configuration only, never a hostname supplied in request JSON/query. */
export function applicationOriginForProject(projectId: string, hostSuffix: string, platformOrigin: string): string {
  const platform = new URL(platformOrigin);
  if (!uuid.test(projectId) || platform.protocol !== 'https:' || platform.origin !== platformOrigin
    || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(hostSuffix)
    || hostSuffix.length > 180 || hostSuffix === platform.hostname || /(?:^|\.)supabase\.co$/.test(hostSuffix)) {
    throw new Error('An isolated application host is required.');
  }
  const applicationOrigin = `https://${projectId.toLowerCase()}.${hostSuffix}`;
  if (applicationOrigin === platformOrigin) throw new Error('An isolated application host is required.');
  return applicationOrigin;
}

export function assertApplicationOriginScope(applicationOrigin: string, projectId: string, platformOrigin: string) {
  const origin = new URL(applicationOrigin);
  const suffix = origin.hostname.slice(projectId.length + 1);
  if (applicationOriginForProject(projectId, suffix, platformOrigin) !== applicationOrigin) throw new Error('Invalid application origin.');
}
