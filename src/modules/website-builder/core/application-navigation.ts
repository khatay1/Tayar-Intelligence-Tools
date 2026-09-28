/** Only authored HTML routes in the immutable release participate in session
 * synchronization. External links, downloads, anchors and new tabs stay native. */
export function applicationNavigationTarget(href: string, currentHref: string, paths: readonly string[]): string | null {
  try {
    const current = new URL(currentHref);
    const next = new URL(href, current);
    if (next.origin !== current.origin || next.username || next.password || !paths.includes(next.pathname)) return null;
    if (next.pathname === current.pathname && next.search === current.search && next.hash) return null;
    return next.href;
  } catch { return null; }
}

export function createApplicationNavigator(options: {
  currentUrl: () => string;
  paths: readonly string[];
  synchronize: () => Promise<void>;
  navigate: (url: string) => void;
}) {
  const paths = [...options.paths];
  let busy = false, disposed = false;
  return {
    target: (href: string) => disposed ? null : applicationNavigationTarget(href, options.currentUrl(), paths),
    async go(href: string): Promise<boolean> {
      if (disposed || busy) return false;
      const target = applicationNavigationTarget(href, options.currentUrl(), paths);
      if (!target) return false;
      busy = true;
      try {
        await options.synchronize();
        if (disposed) return false;
        options.navigate(target);
        return true;
      } finally { busy = false; }
    },
    dispose() { disposed = true; },
  };
}
