import { httpRouter } from "convex/server";
import { envelopeSchema } from "@astack/agent-observability";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const router = httpRouter();
const cors = (request: Request) => {
  const origin = request.headers.get("origin");
  const permitted = process.env.OBSERVATORY_UI_ORIGIN;
  return {
    "cache-control": "no-store",
    "content-type": "application/json",
    ...(origin && origin === permitted
      ? { "access-control-allow-origin": origin, vary: "Origin" }
      : {}),
  };
};
router.route({
  path: "/auth/session",
  method: "OPTIONS",
  handler: httpAction(
    async (_ctx, request) =>
      new Response(null, {
        status: 204,
        headers: {
          ...cors(request),
          "access-control-allow-methods": "GET, POST",
          "access-control-allow-headers": "content-type, authorization",
        },
      }),
  ),
});
router.route({
  path: "/auth/session",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Only Tailscale Serve may reach this endpoint remotely; backend ports stay bound to loopback.
    const subject = request.headers.get("tailscale-user-login");
    if (
      !subject ||
      !process.env.OBSERVATORY_OWNER ||
      subject !== process.env.OBSERVATORY_OWNER
    )
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors(request),
      });
    const token = await ctx.runAction(internal.auth.issue, {});
    return new Response(JSON.stringify({ token }), { headers: cors(request) });
  }),
});
router.route({
  path: "/auth/session",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authorization = request.headers.get("authorization");
    if (
      !authorization?.startsWith("Bearer ") ||
      authorization.length > 1024 ||
      !process.env.OBSERVATORY_OWNER ||
      !(await ctx.runAction(internal.auth.viewer, {
        credential: authorization.slice(7),
      }))
    )
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors(request),
      });
    const token = await ctx.runAction(internal.auth.issue, {});
    return new Response(JSON.stringify({ token }), { headers: cors(request) });
  }),
});
router.route({
  path: "/agentlog/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const denied = () =>
      new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
        },
      });
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ") || auth.length > 1024) return denied();
    const machineId = await ctx.runAction(internal.auth.machine, {
      credential: auth.slice(7),
    });
    if (!machineId) return denied();
    try {
      const body = await request.text();
      if (new TextEncoder().encode(body).byteLength > 1024 * 1024)
        return new Response("Payload too large", { status: 413 });
      const envelope = envelopeSchema.parse(JSON.parse(body));
      if (envelope.machineId !== machineId) return denied();
      for (let index = 0; index < envelope.records.length; index += 3)
        await ctx.runMutation(internal.ingestion.ingest, {
          machineId,
          records: envelope.records.slice(index, index + 3).map((entry) => ({
            revision: entry.revision,
            record: JSON.stringify(entry.record),
          })),
        });
      return new Response(
        JSON.stringify({ schemaVersion: 1, accepted: envelope.records.length }),
        {
          headers: {
            "content-type": "application/json",
            "cache-control": "no-store",
          },
        },
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid telemetry batch" }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }
  }),
});
export default router;
