export function recordFromRoute(route: string): string | undefined {
  if (!route.startsWith('/') || route.startsWith('//') || route.includes('#')) throw new Error('Invalid application route');
  const path = new URL(route, 'https://reference.invalid').pathname;
  if (path === '/') return undefined;
  const id = path.slice('/records/'.length);
  if (!path.startsWith('/records/') || !['alpha', 'beta'].includes(id)) throw new Error('Unknown reference record');
  return id;
}
export class HostSelection {
  private link: string | undefined;
  private contextId: string | undefined;
  apply(current: string | undefined, link: { url: string } | undefined,
    context: { updateId: string; structuredContent?: Record<string, unknown> } | null | undefined): string | undefined {
    let next = current;
    if (link?.url !== this.link) { this.link = link?.url; if (link) next = recordFromRoute(link.url); }
    if (context && context.updateId !== this.contextId) {
      this.contextId = context.updateId;
      if (context.structuredContent?.recordId === 'alpha' || context.structuredContent?.recordId === 'beta') next = context.structuredContent.recordId;
    } else if (context === null && this.contextId !== undefined) { this.contextId = undefined; next = undefined; }
    return next;
  }
}
