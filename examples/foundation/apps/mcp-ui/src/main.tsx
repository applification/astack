import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import type { AppEventMap } from '@modelcontextprotocol/ext-apps';
import { App } from '@modelcontextprotocol/ext-apps';
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
    const app = new App({ name: 'astack-work-items', version: '1.0.0' });
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
      if (context.theme)
        document.documentElement.style.colorScheme = context.theme;
    };
    app.addEventListener('toolresult', onResult);
    app.addEventListener('hostcontextchanged', onContext);
    app
      .connect()
      .then(() => {
        if (active) {
          connectedApp.current = app;
          setBridge(app);
          const context = app.getHostContext();
          if (context) onContext(context);
        }
      })
      .catch((failure: unknown) => {
        if (active) setError(errorMessage(failure));
      });
    return () => {
      active = false;
      connectedApp.current = undefined;
      app.removeEventListener('toolresult', onResult);
      app.removeEventListener('hostcontextchanged', onContext);
      app.close().catch(console.error);
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
      saving.current = false;
      if (connectedApp.current === bridge) setPendingId(undefined);
    }
  }
  return (
    <Workspace>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {items ? (
        <WorkItemList
          items={items}
          {...(pendingId ? { pendingId } : {})}
          onStatusChange={(item) => {
            toggle(item).catch((failure: unknown) => {
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
createRoot(root).render(<McpWorkItems />);
