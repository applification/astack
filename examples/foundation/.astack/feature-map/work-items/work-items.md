# Create and change work items

In the web app, open **Work items**, fill **Title**, and select **Add work item**. The new item appears in the authenticated list. **Mark done** and **Reopen** change its status. URL status filtering limits the list to the chosen state.

The MCP tools `work_items_list`, `work_items_create`, `work_items_set_status`, and `work_items_delete` reach the same domain. The MCP App opens the `ui://foundation/work-items.html` resource in a compatible host.

Run `./.codex/skills/astack-work-items/control.ts verify --json`. It creates through the actual web, checks a fresh Convex read, changes status through the running MCP endpoint, reloads the web and renders the resource through AppBridge. A visible row supports presentation; the independent authenticated query supports persistence. It also checks anonymous, expired, wrong-audience and other-user denials.

Prerequisites are installed frozen dependencies and Chromium (`bunx playwright install chromium` if unavailable). The local proof issuer is allowed only in the disposable loopback environment. It verifies ownership and authentication boundaries; it does not verify live WorkOS login or the installed ChatGPT host.
