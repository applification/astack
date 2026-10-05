import { join, resolve } from 'node:path';
import { foundationRoot } from './runtime';
import { readSettings } from './development';
import {
  stagingClient,
  createDisposableUser,
  cleanupDisposableUser,
  recoverDisposableUser,
} from './staging-fixtures';

const api = stagingClient({
  ...(await readSettings(join(foundationRoot, '.env.workos-staging'))),
  ...process.env,
});
const directory = join(foundationRoot, '.auth-fixtures');
const [command, filename] = process.argv.slice(2).filter((arg) => arg !== '--');
try {
  if (command === 'create' && !filename) {
    const fixture = await createDisposableUser(
      api.userManagement,
      directory,
      true,
    );
    console.log(
      `Temporary acceptance identity created. Credentials are private in ${fixture.path}; remove it after G1/G2 with bun run auth:acceptance -- cleanup ${fixture.user.externalId?.split(':')[1] ?? ''}. No acceptance behavior has been verified by creating it.`,
    );
  } else if (
    ['cleanup', 'recover'].includes(command ?? '') &&
    filename &&
    /^[0-9a-f-]{36}$/.test(filename)
  ) {
    if (command === 'recover')
      await recoverDisposableUser(api.userManagement, directory, filename);
    else
      await cleanupDisposableUser(
        api.userManagement,
        resolve(directory, `${filename}.json`),
      );
    console.log(
      'Temporary acceptance identity and private credentials removed.',
    );
  } else
    throw new Error(
      'Usage: auth:acceptance -- create | cleanup <run-uuid> | recover <run-uuid>',
    );
} catch {
  throw new Error(
    'Acceptance fixture operation failed. Preserve .auth-fixtures for recovery; check staging settings and the create/cleanup command.',
  );
}
