// ssh destinations: optional user@, host alias / hostname / IP. No leading '-' (option injection).
const SSH_HOST_RE = /^[A-Za-z0-9][A-Za-z0-9._@-]*$/;

// git refs, repo URLs, install paths, remote names: a conservative token charset only.
const SAFE_ARG_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@=+-]*$/;

export function assertValidSshHost(host: string): string {
  if (typeof host !== 'string' || !SSH_HOST_RE.test(host)) {
    throw new Error(
      `Invalid ssh host '${host}': allowed characters are letters, digits, '.', '_', '@', '-' and it may not start with '-'.`
    );
  }
  return host;
}

export function assertShellSafe(value: string, label: string): string {
  if (typeof value !== 'string' || !SAFE_ARG_RE.test(value)) {
    throw new Error(`Refusing to build remote command: ${label} '${value}' contains unsafe characters.`);
  }
  return value;
}
