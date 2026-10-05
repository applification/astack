import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import type { AppEventMap } from '@modelcontextprotocol/ext-apps';
import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
} from '@modelcontextprotocol/ext-apps';
import { WorkItemsResultSchema, errorMessage } from '@foundation/domain';
import type { WorkItem } from '@foundation/domain';
import { Notice, Workspace, WorkItemList } from '@foundation/ui';
import '@foundation/ui/styles.css';

function McpWorkItems() {
  const [items, setItems] = useState<WorkItem[]>();
  const [error, setError] = useState<string>();
  const [bridge, setBridge] = useState<App>();
  const [pendingId, setPendingId] = useState<string>();
  const connectedApp = useRef<App | undefined>(undefined);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    let disposeSizeNotifications: (() => void) | undefined;
    let fontCss: string | undefined;
    const app = new App(
      { name: 'astack-work-items', version: '1.0.0' },
      {},
      { autoResize: false },
    );
    const onResult = (result: AppEventMap['toolresult']) => {
      if (!active) return;
      try {
        setItems(WorkItemsResultSchema.parse(result.structuredContent).items);
        setError(undefined);
      } catch {
        setError('The host returned an invalid work-item result.');
      }
    };
    const onContext = (context: AppEventMap['hostcontextchanged']) => {
      if (!active) return;
      if (context.theme) applyDocumentTheme(context.theme);
      if (context.styles?.variables)
        applyHostStyleVariables(context.styles.variables);
      const suppliedFonts = context.styles?.css?.fonts;
      if (suppliedFonts !== undefined && suppliedFonts !== fontCss) {
        // The SDK helper injects once. Remove our previous block when the host
        // supplies replacement fonts, then let the helper install the new CSS.
        if (fontCss !== undefined)
          document.getElementById('__mcp-host-fonts')?.remove();
        applyHostFonts(suppliedFonts);
        fontCss = suppliedFonts;
      }
    };
    const invalidate = () => {
      active = false;
      connectedApp.current = undefined;
      saving.current = false;
      disposeSizeNotifications?.();
      disposeSizeNotifications = undefined;
      app.removeEventListener('toolresult', onResult);
      app.removeEventListener('hostcontextchanged', onContext);
    };
    const close = () => {
      invalidate();
      app.close().catch(console.error);
    };
    window.addEventListener('pagehide', close);
    app.addEventListener('toolresult', onResult);
    app.addEventListener('hostcontextchanged', onContext);
    app.onteardown = () => {
      invalidate();
      setBridge(undefined);
      setPendingId(undefined);
      // The transport stays open until the host receives this acknowledgement.
      // Pagehide or component cleanup closes the transport after the host can
      // safely remove the acknowledged iframe.
      return {};
    };
    app
      .connect()
      .then(() => {
        if (active) {
          connectedApp.current = app;
          setBridge(app);
          const context = app.getHostContext();
          if (context) onContext(context);
          disposeSizeNotifications = app.setupSizeChangedNotifications();
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      invalidate();
      window.removeEventListener('pagehide', close);
      app.onteardown = undefined;
      close();
    };
  }, []);
  async function toggle(item: WorkItem) {
    if (!bridge || connectedApp.current !== bridge || saving.current) return;
    saving.current = true;
    setPendingId(item.id);
    setError(undefined);
    try {
      const changed = await bridge.callServerTool({
        name: 'work_items_set_status',
        arguments: {
          id: item.id,
          status: item.status === 'open' ? 'done' : 'open',
        },
      });
      if (connectedApp.current !== bridge) return;
      if (changed.isError)
        throw new Error(
          'Saving failed. Your work item has not been confirmed as changed.',
        );
      const fresh = await bridge.callServerTool({
        name: 'work_items_list',
        arguments: {},
      });
      if (connectedApp.current !== bridge) return;
      if (fresh.isError)
        throw new Error(
          'Saved, but refresh failed. Reopen the work-item view.',
        );
      setItems(WorkItemsResultSchema.parse(fresh.structuredContent).items);
    } catch (failure) {
      if (connectedApp.current === bridge) setError(errorMessage(failure));
    } finally {
      if (connectedApp.current === bridge) {
        saving.current = false;
        setPendingId(undefined);
      }
    }
  }
  return (
    <Workspace embedded>
      {error && <Notice tone="error">{error}</Notice>}
      {items ? (
        <WorkItemList
          items={items}
          emptyMessage="Ask your assistant to add a work item."
          {...(pendingId ? { pendingId } : {})}
          onStatusChange={(item) => {
            toggle(item).catch((failure: unknown) => {
              if (connectedApp.current === bridge)
                setError(errorMessage(failure));
            });
          }}
        />
      ) : (
        <Notice>Waiting for the host’s work-item result…</Notice>
      )}
    </Workspace>
  );
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing MCP UI root.');
createRoot(root).render(
  window.parent === window ? (
    <Workspace embedded>
      <Notice>
        Open this MCP App in a host. For local development, run bun dev and open
        the MCP App preview at http://127.0.0.1:5174/.
      </Notice>
    </Workspace>
  ) : (
    <McpWorkItems />
  ),
);
