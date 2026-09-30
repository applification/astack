import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import { z } from 'zod';
import { ProtocolError } from '@modelcontextprotocol/server';
import { FileStore } from './store';
import { sendCallback, type CallbackSender } from './webhook';
import { recordId, readRecord } from './records';
const eventName = z.literal('record.updated');
export const SubscribeSchema = z.object({ name: eventName, arguments: z.object({ record_id: recordId }).strict(),
  delivery: z.object({ mode: z.literal('webhook'), url: z.url(), secret: z.string() }).strict(),
  ttlMs: z.number().int().min(1000).nullable().optional(), cursor: z.null().optional() }).strict();
export const UnsubscribeSchema = SubscribeSchema.omit({ ttlMs: true, cursor: true }).extend({
  delivery: z.object({ mode: z.literal('webhook'), url: z.url() }).strict(),
});
type Subscription = { id: string; owner: string; recordId: string; url: string; secret: string; expires: number;
  previousSecret?: string; rotateUntil?: number };
type Event = { eventId: string; name: 'record.updated'; timestamp: string; data: { record_id: string; summary: string }; cursor: null };
type Job = { subscriptionId: string; event: Event; attempts: number; nextAt: number };
export type EventState = { subscriptions: Record<string, Subscription>; jobs: Job[] };
export const freshState = (): EventState => ({ subscriptions: {}, jobs: [] });
function authorize(owner: string, id?: string) {
  // Only this explicit development persona owns the fixture records.
  if (owner !== 'reference-user') throw new Error('Forbidden');
  if (id) readRecord(id);
}
function identity(owner: string, id: string, url: string) {
  return 'sub_' + createHash('sha256').update(JSON.stringify([owner, 'record.updated', { record_id: id }, url])).digest('hex');
}
function validateSecret(secret: string) {
  if (!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)) throw new Error('Invalid signing secret');
  const bytes = Buffer.from(secret.slice(6), 'base64');
  if (bytes.length < 24 || bytes.length > 64) throw new Error('Invalid signing secret length');
}
function signed(secret: string, id: string, body: string, now: number) {
  const date = new Date(now);
  return { 'webhook-id': id, 'webhook-timestamp': String(Math.floor(now / 1000)), 'webhook-signature': new Webhook(secret).sign(id, date, body) };
}
export class Events {
  private verified = new Map<string, number>();
  constructor(private store: FileStore<EventState>, private send: CallbackSender = sendCallback,
    private now: () => number = Date.now) {}
  list(owner: string) {
    authorize(owner);
    return { events: [{ name: 'record.updated', description: 'A reference record changed. Filter by its exact record ID.', delivery: ['webhook'],
      inputSchema: { type: 'object', properties: { record_id: { type: 'string', enum: ['alpha', 'beta'] } }, required: ['record_id'], additionalProperties: false },
      payloadSchema: { type: 'object', properties: { record_id: { type: 'string' }, summary: { type: 'string' } }, required: ['record_id', 'summary'], additionalProperties: false } }] };
  }
  async subscribe(owner: string, raw: unknown) {
    const input = SubscribeSchema.parse(raw); authorize(owner, input.arguments.record_id); validateSecret(input.delivery.secret);
    const url = new URL(input.delivery.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Invalid callback URL');
    const id = identity(owner, input.arguments.record_id, url.href);
    const challenge = randomBytes(32).toString('base64url');
    const body = JSON.stringify({ type: 'verification', challenge });
    const verificationKey = createHash('sha256').update(JSON.stringify([owner, url.href, input.delivery.secret])).digest('hex');
    for (const [key, expires] of this.verified) if (expires <= this.now()) this.verified.delete(key);
    if ((this.verified.get(verificationKey) ?? 0) <= this.now()) {
      let response;
      try {
        response = await this.send(url.href, body, { ...signed(input.delivery.secret, 'verification_' + randomBytes(12).toString('hex'), body, this.now()), 'X-MCP-Subscription-Id': id });
      } catch (error) {
        const timeout = error instanceof Error && /timed out|timeout/i.test(error.message);
        throw new ProtocolError(-32015, 'CallbackEndpointError', { reason: timeout ? 'timeout' : 'connection_failed' });
      }
      let echo: unknown;
      try { echo = response.status >= 200 && response.status < 300 ? JSON.parse(response.body).challenge : undefined; } catch { /* invalid echo */ }
      if (typeof echo !== 'string' || Buffer.byteLength(echo) !== Buffer.byteLength(challenge) || !timingSafeEqual(Buffer.from(echo), Buffer.from(challenge))) {
        throw new ProtocolError(-32015, 'Callback challenge failed', { reason: 'challenge_failed' });
      }
      if (this.verified.size >= 1000) this.verified.delete(this.verified.keys().next().value!);
      this.verified.set(verificationKey, this.now() + 300_000);
    }
    // This fixture always grants a finite lifetime, even when infinity is requested.
    const expires = this.now() + Math.min(input.ttlMs ?? 3_600_000, 3_600_000);
    this.store.update(state => {
      const prior = state.subscriptions[id];
      state.subscriptions[id] = { id, owner, recordId: input.arguments.record_id, url: url.href, secret: input.delivery.secret, expires,
        ...(prior && prior.secret !== input.delivery.secret ? { previousSecret: prior.secret, rotateUntil: this.now() + 60_000 } :
          prior?.rotateUntil && prior.rotateUntil > this.now() ? { previousSecret: prior.previousSecret, rotateUntil: prior.rotateUntil } : {}) };
    });
    return { id, refreshBefore: new Date(expires).toISOString(), cursor: null, truncated: false };
  }
  unsubscribe(owner: string, raw: unknown) {
    const input = UnsubscribeSchema.parse(raw); authorize(owner, input.arguments.record_id);
    const id = identity(owner, input.arguments.record_id, new URL(input.delivery.url).href);
    this.store.update(state => { delete state.subscriptions[id]; state.jobs = state.jobs.filter(job => job.subscriptionId !== id); });
    return {};
  }
  emit(owner: string, id: string, summary: string) {
    authorize(owner, id);
    if (!summary || summary.length > 4000) throw new Error('Summary must contain 1–4000 characters');
    const event: Event = { eventId: 'evt_' + randomBytes(16).toString('hex'), name: 'record.updated', timestamp: new Date(this.now()).toISOString(), data: { record_id: id, summary }, cursor: null };
    if (Buffer.byteLength(JSON.stringify(event)) > 256 * 1024) throw new Error('Event too large');
    this.store.update(state => { for (const sub of Object.values(state.subscriptions)) {
      if (sub.owner === owner && sub.recordId === id && sub.expires > this.now()) state.jobs.push({ subscriptionId: sub.id, event, attempts: 0, nextAt: this.now() });
    } });
    return event.eventId;
  }
  async deliver() {
    // One process owns this store. A production worker needs transactional leases.
    const due = this.store.read().jobs.filter(job => job.nextAt <= this.now());
    const outcomes: { eventId: string; outcome: string }[] = [];
    for (const job of due) {
      const sub = this.store.read().subscriptions[job.subscriptionId];
      let status = 0;
      let outcome = 'expired';
      if (sub && sub.expires > this.now()) {
        try {
          authorize(sub.owner, sub.recordId);
          const body = JSON.stringify(job.event);
          const headers = signed(sub.secret, job.event.eventId, body, this.now());
          if (sub.previousSecret && sub.rotateUntil && sub.rotateUntil > this.now()) headers['webhook-signature'] += ' ' + signed(sub.previousSecret, job.event.eventId, body, this.now())['webhook-signature'];
          status = (await this.send(sub.url, body, { ...headers, 'X-MCP-Subscription-Id': sub.id })).status;
          outcome = status >= 200 && status < 300 ? 'accepted' : 'failed';
        } catch { outcome = 'failed'; }
      }
      this.store.update(state => {
        const index = state.jobs.findIndex(item => item.subscriptionId === job.subscriptionId && item.event.eventId === job.event.eventId);
        if (index < 0) return;
        const transient = status === 0 || status === 408 || status === 429 || status >= 500;
        if (outcome === 'failed' && transient && job.attempts < 4 && state.subscriptions[job.subscriptionId]?.expires > this.now()) {
          state.jobs[index] = { ...job, attempts: job.attempts + 1, nextAt: this.now() + 1000 * 2 ** job.attempts };
          outcome = 'retry';
        } else state.jobs.splice(index, 1);
      });
      outcomes.push({ eventId: job.event.eventId, outcome });
    }
    return outcomes;
  }
}
