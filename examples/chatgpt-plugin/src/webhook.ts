import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import ipaddr from 'ipaddr.js';
export type CallbackResponse = { status: number; body: string };
export type CallbackSender = (url: string, body: string, headers: Record<string, string>) => Promise<CallbackResponse>;
export function isPublicAddress(address: string) {
  if (!ipaddr.isValid(address)) return false;
  return ipaddr.process(address).range() === 'unicast';
}
export const sendCallback: CallbackSender = async (address, body, headers) => {
  const url = new URL(address);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Callback must be an HTTPS URL without credentials or fragment');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const signal = AbortSignal.timeout(10_000);
  const addresses = await Promise.race([
    lookup(host, { all: true }),
    new Promise<never>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Callback timed out')), { once: true })),
  ]);
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error('Callback resolves to a non-public address');
  const destination = addresses[0];
  return new Promise((resolve, reject) => {
    const req = request(url, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body).toString() },
      // Connect only to this validated address. TLS still verifies the original hostname.
      lookup: (_hostname, _options, callback) => callback(null, destination.address, destination.family),
      signal, timeout: 10_000 }, response => {
      let text = ''; let bytes = 0;
      response.on('data', chunk => { bytes += chunk.length; if (bytes > 16_384) req.destroy(new Error('Callback response too large')); else text += chunk.toString(); });
      response.on('end', () => resolve({ status: response.statusCode ?? 500, body: text }));
      response.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Callback timed out')));
    req.on('error', reject);
    // Redirect responses are returned as failures; this client never follows them.
    req.end(body);
  });
};
