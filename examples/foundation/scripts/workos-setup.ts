import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { parseArgs } from 'node:util';

export async function saveWorkosConfiguration(
  root: string,
  clientId: string,
  domain: string,
): Promise<void> {
  if (!/^client_[A-Za-z0-9]+$/.test(clientId))
    throw new Error('Supply the WorkOS staging client ID (client_...).');
  const issuer = new URL(domain);
  if (
    issuer.protocol !== 'https:' ||
    issuer.username ||
    issuer.password ||
    issuer.pathname !== '/' ||
    issuer.search ||
    issuer.hash
  )
    throw new Error(
      'Supply the HTTPS AuthKit domain, without a path or credentials.',
    );
  const paths = [
    [
      'packages/backend/.env.local',
      {
        WORKOS_CLIENT_ID: clientId,
        WORKOS_AUTHKIT_DOMAIN: issuer.origin,
      },
    ],
    [
      'apps/web/.env.local',
      {
        VITE_WORKOS_CLIENT_ID: clientId,
        VITE_WORKOS_DEV_MODE: 'true',
      },
    ],
  ] as const;
  const changes: { path: string; content: string }[] = [];
  for (const [name, values] of paths) {
    const path = join(root, name);
    const content = await readFile(path, 'utf8').catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        return '';
      throw error;
    });
    const current = parseEnv(content);
    for (const [key, value] of Object.entries(values)) {
      if (current[key] && current[key] !== value)
        throw new Error(
          `${name} already has a different ${key}. Preserve that environment and select the intended WorkOS sandbox before changing it.`,
        );
    }
    const missing = Object.entries(values).filter(([key]) => !current[key]);
    // Replace only empty placeholders; preserve the developer's deployment and other settings.
    let updated = content;
    for (const [key, value] of missing) {
      updated = updated.replace(new RegExp(`^${key}=.*(?:\\n|$)`, 'gm'), '');
      updated += `${updated && !updated.endsWith('\n') ? '\n' : ''}${key}=${value}\n`;
    }
    changes.push({ path, content: updated });
  }
  // Validate both files before changing either. Public configuration only; no API key.
  for (const change of changes)
    await writeFile(change.path, change.content, { mode: 0o600 });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      'client-id': { type: 'string' },
      'authkit-domain': { type: 'string' },
    },
  });
  if (!values['client-id'] || !values['authkit-domain'])
    throw new Error(
      'Usage: bun run setup:workos --client-id client_... --authkit-domain https://YOUR-DOMAIN.authkit.app',
    );
  await saveWorkosConfiguration(
    dirname(dirname(fileURLToPath(import.meta.url))),
    values['client-id'],
    values['authkit-domain'],
  );
  console.log(
    'WorkOS public configuration saved locally. bun dev will configure the local Convex provider. In the staging WorkOS application allow redirects/logout and CORS for http://127.0.0.1:5173/ and http://127.0.0.1:5174/; enable DCR and register http://127.0.0.1:3211/mcp as a resource indicator. See README.md.',
  );
}
