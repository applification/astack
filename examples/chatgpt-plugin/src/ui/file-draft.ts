export class FileDraft {
  uri?: string;
  text = '';
  etag?: string;
  writable = false;
  dirty = false;
  stale = false;
  busy = false;
  open(uri: string) {
    if (this.dirty && uri !== this.uri) throw new Error('Save or reload the current draft before opening another file.');
    this.uri = uri; this.text = ''; this.etag = undefined; this.writable = false; this.dirty = false; this.stale = false;
  }
  edit(text: string) { this.text = text; this.dirty = true; }
  receive(uri: string, text: string, etag: string | undefined, writable: boolean, discard = false) {
    if (this.uri !== uri) return;
    if (this.dirty && !discard) { this.stale = true; return; }
    this.text = text; this.etag = etag; this.writable = writable; this.dirty = false; this.stale = false;
  }
  notified() { if (this.dirty || this.busy) { this.stale = true; return false; } return true; }
}
