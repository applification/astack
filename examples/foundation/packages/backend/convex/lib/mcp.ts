import { statusSchema, titleSchema, WorkItemSchema } from "@foundation/domain";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { mcpUiHtml } from "../generated/mcp-ui";

export const UI_RESOURCE_URI = "ui://foundation/work-items.html";

function serializedWorkItemId(value: string): Id<"workItems"> {
  // API 01: the receiving mutation validates this serialized ID with v.id("workItems").
  // This adapter restores its compile-time brand; it does not claim runtime validation.
  return value as Id<"workItems">;
}

export async function handleMcpRequest(ctx: ActionCtx, request: Request): Promise<Response> {
  const server = new McpServer({ name: "astack-foundation", version: "0.1.0" });
  registerAppResource(server, "work-items", UI_RESOURCE_URI, {}, async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: RESOURCE_MIME_TYPE,
        text: mcpUiHtml,
        _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } } },
      },
    ],
  }));

  registerAppTool(
    server,
    "work_items_list",
    {
      title: "Your work items",
      description: "List up to 100 of your most recent work items and open the work item view.",
      inputSchema: {},
      outputSchema: { items: z.array(WorkItemSchema) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: { ui: { resourceUri: UI_RESOURCE_URI } },
    },
    async () => {
      const items = await ctx.runQuery(api.workItems.list, {});
      return { content: [{ type: "text", text: `${items.length} work items.` }], structuredContent: { items } };
    },
  );
  registerAppTool(
    server,
    "work_items_create",
    {
      title: "Create a work item",
      description: "Create an open work item owned by the authenticated user.",
      inputSchema: { title: titleSchema },
      outputSchema: { item: WorkItemSchema },
      annotations: { destructiveHint: false, openWorldHint: false },
    },
    async ({ title }) => {
      const item = await ctx.runMutation(api.workItems.create, { title });
      return { content: [{ type: "text", text: "Work item created." }], structuredContent: { item } };
    },
  );
  registerAppTool(
    server,
    "work_items_set_status",
    {
      title: "Update a work item",
      description: "Set an owned work item to open or done.",
      inputSchema: { id: z.string().min(1), status: statusSchema },
      outputSchema: { item: WorkItemSchema },
      annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async ({ id, status }) => {
      const item = await ctx.runMutation(api.workItems.setStatus, { id: serializedWorkItemId(id), status });
      return { content: [{ type: "text", text: "Work item updated." }], structuredContent: { item } };
    },
  );
  registerAppTool(
    server,
    "work_items_delete",
    {
      title: "Delete a work item",
      description: "Delete a work item owned by the authenticated user.",
      inputSchema: { id: z.string().min(1) },
      outputSchema: { deleted: z.literal(true) },
      annotations: { destructiveHint: true, openWorldHint: false },
    },
    async ({ id }) => {
      await ctx.runMutation(api.workItems.deleteItem, { id: serializedWorkItemId(id) });
      return { content: [{ type: "text", text: "Work item deleted." }], structuredContent: { deleted: true } };
    },
  );

  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
