import { LocalStore, forward } from "./store";
import type { CollectorConfig } from "./config";

function pause(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, milliseconds);
    signal.addEventListener("abort", done, { once: true });
  });
}

/** One upload at a time; capture can proceed while the network is waiting. */
export async function drainQueue(
  store: LocalStore,
  config: Pick<CollectorConfig, "machineId" | "endpoint">,
  token: string,
  options: { signal: AbortSignal; once?: boolean },
) {
  let batches = 0;
  let failures = 0;
  let lastHealthAt = 0;
  while (!options.signal.aborted) {
    if (!store.pending()) {
      if (Date.now() - lastHealthAt >= 30_000) {
        lastHealthAt = Date.now();
        store.setMeta(
          "forwardHealth",
          JSON.stringify({ status: "ok", at: lastHealthAt }),
        );
      }
      if (options.once) return;
      await pause(1000, options.signal);
      continue;
    }
    try {
      // Reserve every fourth batch for oldest records, even under continuous activity.
      await forward(store, config, token, fetch, {
        priority: batches % 4 === 3 ? "oldest" : "recent",
        signal: options.signal,
      });
      batches++;
      failures = 0;
      lastHealthAt = Date.now();
      store.setMeta(
        "forwardHealth",
        JSON.stringify({ status: "ok", at: lastHealthAt }),
      );
      // --once remains bounded for operator scripts; the background worker continues.
      if (options.once && batches >= 20) return;
      if (!options.once) await pause(25, options.signal);
    } catch (error) {
      if (options.signal.aborted) return;
      const delay =
        Math.min(300_000, 1000 * 2 ** Math.min(++failures, 8)) +
        Math.random() * 1000;
      const diagnostic =
        error instanceof Error &&
        /^(ingestion_http_\d+|invalid_ingestion_ack)$/.test(error.message)
          ? error.message
          : "network_unavailable";
      store.setMeta(
        "forwardHealth",
        JSON.stringify({
          status: "offline",
          at: Date.now(),
          retryAt: Date.now() + delay,
          diagnostic,
        }),
      );
      if (options.once) return;
      await pause(delay, options.signal);
    }
  }
}
