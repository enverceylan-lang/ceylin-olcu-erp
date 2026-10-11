/** Exact build identity. Unknown means unverified, never "current". */
export type VersionCheck = 'current' | 'outdated' | 'unverified';
export function compareClientBuild(client: string | undefined, server: string | null): VersionCheck {
  if (!client || !server) return 'unverified';
  return client === server ? 'current' : 'outdated';
}
export async function fetchServerBuild(): Promise<string | null> {
  const response = await fetch('/api/client-version', { cache: 'no-store' });
  if (!response.ok) throw new Error('CLIENT_VERSION_CHECK_FAILED');
  const json: unknown = await response.json();
  if (!json || typeof json !== 'object' || !('build' in json)) return null;
  const build = (json as {build: unknown}).build;
  return typeof build === 'string' && /^[a-f0-9]{7,40}$/i.test(build) ? build : null;
}
