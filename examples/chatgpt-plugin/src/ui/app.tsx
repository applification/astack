import { App, applyDocumentTheme, applyHostStyleVariables } from '@modelcontextprotocol/ext-apps';
import { OpenAIExtensions, OpenAIFileEntrypointInputSchema } from '@openai/mcp-extensions/app';
import { createRoot } from 'react-dom/client';
import { RecordList } from './RecordList';
import { RecordsSchema, records } from '../records';
import { HostSelection } from './navigation';
import { FileDraft } from './file-draft';
import './style.css';
const root = createRoot(document.getElementById('root')!);
const app = new App({ name: 'astack-reference', version: '0.1.0' });
const extensions = new OpenAIExtensions(app);
let items = records;
let selectedId: string | undefined;
let error: string | undefined;
const draft = new FileDraft();
const hostSelection = new HostSelection();
let disposeUpdate: (() => void) | undefined;
function fail(reason: unknown) { error = reason instanceof Error ? reason.message : 'Request failed'; render(); }
async function reloadFile(discard = false) {
  const uri = draft.uri;
  if (!uri || !extensions.resources) return;
  const result = await extensions.resources.read({ uri, representation: 'text' });
  const content = result.contents[0];
  draft.receive(uri, content && 'text' in content ? content.text : '', content?.openaiMetadata?.etag,
    content?.openaiMetadata?.writable === true, discard);
  render();
}
async function renderInput(args: unknown) {
  const input = OpenAIFileEntrypointInputSchema.safeParse(args);
  if (!input.success) return;
  if (!extensions.resources) { fail(new Error('This host does not support file resources.')); return; }
  if (input.data.file.resourceUri === draft.uri) return;
  const previous = draft.uri;
  draft.open(input.data.file.resourceUri); error = undefined; render();
  disposeUpdate?.();
  if (previous) await extensions.resources.unsubscribe({ uri: previous });
  disposeUpdate = extensions.resources.addUpdateHandler(async ({ params }) => {
    if (params.uri !== draft.uri) return;
    if (draft.notified()) await reloadFile().catch(fail); else render();
  });
  await extensions.resources.subscribe({ uri: draft.uri! });
  await reloadFile();
}
async function select(id: string) {
  selectedId = id; error = undefined; render();
  const record = items.find(item => item.id === id);
  if (record) await app.updateModelContext({ content: [{ type: 'text', text: `Selected record: ${record.title}` }], structuredContent: { recordId: id } });
}
async function save() {
  const uri = draft.uri;
  if (!uri || !draft.writable || draft.busy || !extensions.resources) return;
  draft.busy = true; render();
  try {
    const result = await extensions.resources.write(uri, { text: draft.text, ...(draft.etag ? { ifMatch: draft.etag } : {}) });
    if (uri !== draft.uri) return;
    if (result?.outcome === 'conflict') { draft.stale = true; fail(new Error('The file changed elsewhere. Your draft is preserved. Reload to resolve the conflict.')); }
    else if (result?.outcome === 'too-large') fail(new Error(`File exceeds ${result.maxBytes} bytes.`));
    else if (result?.outcome === 'saved') { draft.dirty = false; error = undefined; await reloadFile(); }
  } finally { draft.busy = false; render(); }
}
function render() {
  root.render(<main>
    {draft.uri ? <section aria-label="File editor"><h1>Reference file</h1>
      {error && <p role="alert">{error}</p>}
      <label htmlFor="file-text">File contents</label>
      <textarea id="file-text" value={draft.text} readOnly={!draft.writable || draft.busy} onChange={event => { draft.edit(event.target.value); render(); }} />
      <p role="status">{draft.stale ? 'File changed elsewhere; your draft is preserved.' : draft.dirty ? 'Unsaved draft' : ''}</p>
      <div className="actions"><button disabled={!draft.writable || draft.busy || draft.stale} onClick={() => void save().catch(fail)}>Save</button><button disabled={draft.busy} onClick={() => { error = undefined; void reloadFile(true).catch(fail); }}>{draft.dirty ? 'Reload and discard draft' : 'Reload'}</button></div>
    </section> : <><RecordList items={items} selectedId={selectedId} onSelect={id => void select(id).catch(fail)} error={error} />
      <div className="actions"><button onClick={() => void app.callServerTool({ name: 'records.list', arguments: {} }).then(result => {
        const data = RecordsSchema.parse(result.structuredContent); items = data.records; render();
      }).catch(fail)}>Refresh records</button>
      <button disabled={!selectedId || !extensions.message} onClick={() => void extensions.message?.send({ role: 'user', content: [{ type: 'text', text: `Explain reference record ${selectedId}.` }] }).catch(fail)}>Discuss selected record</button></div>
    </>}
  </main>);
}
let pendingInput: unknown;
app.ontoolinput = ({ arguments: args }) => { pendingInput = args; if (connected) void renderInput(args).catch(fail); };
app.ontoolresult = result => { const parsed = RecordsSchema.safeParse(result.structuredContent); if (parsed.success) items = parsed.data.records; render(); };
function hostChanged() {
  const context = app.getHostContext();
  if (context?.theme) applyDocumentTheme(context.theme);
  if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
  try { selectedId = hostSelection.apply(selectedId, extensions.deepLink.getCurrent(), extensions.modelContext?.getCurrent()); }
  catch (reason) { fail(reason); }
  render();
}
app.addEventListener('hostcontextchanged', hostChanged);
app.onteardown = async () => { disposeUpdate?.(); if (draft.uri) await extensions.resources?.unsubscribe({ uri: draft.uri }); app.removeEventListener('hostcontextchanged', hostChanged); root.unmount(); return {}; };
let connected = false;
render();
await app.connect();
connected = true;
hostChanged();
if (pendingInput) await renderInput(pendingInput).catch(fail);
