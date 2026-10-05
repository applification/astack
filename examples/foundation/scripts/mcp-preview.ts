import { join } from 'node:path';
import {
  freePort,
  launch,
  localEnvironment,
  stopProcess,
  waitFor,
  type Runtime,
} from './runtime';

export async function startMcpPreview(
  runtime: Runtime,
  options: { emulate?: boolean } = {},
): Promise<{ url: string; stop(): Promise<void> }> {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const process = launch(
    [
      'bunx',
      '--no-install',
      'vite',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    join(runtime.project, 'apps/mcp-ui'),
    {
      ...localEnvironment(),
      VITE_MCP_URL: runtime.mcpUrl,
      ...(options.emulate ? runtime.auth.clientEnvironment() : {}),
    },
    runtime.logs,
  );
  try {
    await waitFor(async () => {
      const response = await fetch(url);
      return response.ok && (await response.text()).includes('MCP App preview')
        ? true
        : false;
    }, 'standalone MCP App development host');
    return { url, stop: () => stopProcess(process) };
  } catch (error) {
    await stopProcess(process);
    throw error;
  }
}
