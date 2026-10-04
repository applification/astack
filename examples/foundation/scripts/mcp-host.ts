import { freePort, type Runtime } from "./runtime";

/** Local Apps SDK host: its tool/resource traffic reaches the actual Convex MCP endpoint. */
export async function startMcpHost(
  runtime: Runtime,
): Promise<{ url: string; stop(): Promise<void> }> {
  const entrypoint = new URL("./mcp-host-browser.ts", import.meta.url).pathname;
  const build = await Bun.build({
    entrypoints: [entrypoint],
    target: "browser",
    format: "esm",
    minify: false,
  });
  if (!build.success)
    throw new Error(
      `MCP host build failed: ${build.logs.map((log) => log.message).join("\n")}`,
    );
  const bundle = build.outputs[0];
  if (!bundle) throw new Error("MCP host build produced no bundle");
  const javascript = await bundle.text();
  const port = await freePort();
  const server = Bun.serve({
    port,
    hostname: "127.0.0.1",
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/host.js")
        return new Response(javascript, {
          headers: { "content-type": "text/javascript" },
        });
      if (path === "/mcp") {
        const headers = new Headers(request.headers);
        headers.delete("host");
        headers.set("authorization", `Bearer ${runtime.tokens.mcp}`);
        const upstream = await fetch(runtime.mcpUrl, {
          method: request.method,
          headers,
          ...(["GET", "HEAD"].includes(request.method)
            ? {}
            : { body: await request.arrayBuffer() }),
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: upstream.headers,
        });
      }
      if (path === "/")
        return new Response(
          '<!doctype html><html><head><meta charset="utf-8"><title>Local MCP App host</title></head><body><h1>Local MCP App host</h1><p id="status" role="status">Connecting</p><iframe id="app" title="Work items MCP App" sandbox="allow-scripts" style="width:100%;height:700px;border:1px solid #ddd"></iframe><script type="module" src="/host.js"></script></body></html>',
          { headers: { "content-type": "text/html" } },
        );
      return new Response("Not found", { status: 404 });
    },
  });
  return {
    url: `http://127.0.0.1:${port}`,
    stop: async () => {
      await server.stop(true);
    },
  };
}
