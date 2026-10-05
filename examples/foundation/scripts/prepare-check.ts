// Convex's generated API references the embedded resource module. Fresh copies omit build output.
export {};
if (!(await Bun.file('packages/backend/convex/generated/mcp_ui.ts').exists())) {
  const build = Bun.spawnSync(['bun', 'run', 'build:mcp-ui'], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (build.exitCode !== 0)
    throw new Error('Build the MCP resource before source checks.');
}
