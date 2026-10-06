import { lstat, readFile } from "node:fs/promises";
import { z } from "zod";
import type { T3Source } from "../config";

export const T3_PROTOCOL_HEADERS = { "x-t3-orchestration-protocol": "2" };
export const t3DescriptorSchema = z.object({
  environmentId: z.string().uuid(),
  orchestrationProtocolVersion: z.literal(2),
  serverVersion: z.string(),
});
const exitSchema = z.object({
  _tag: z.literal("Exit"),
  requestId: z.union([z.string(), z.number()]),
  exit: z.discriminatedUnion("_tag", [
    z.object({ _tag: z.literal("Success"), value: z.unknown() }),
    z.object({ _tag: z.literal("Failure") }),
  ]),
});
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;

export async function readT3Credential(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.size > 16 * 1024 || (info.mode & 0o077) !== 0)
    throw new Error("t3_credential_file_invalid");
  const token = (
    await readFile(path, {
      encoding: "utf8",
      signal: AbortSignal.timeout(1000),
    })
  ).trim();
  if (!token) throw new Error("t3_credential_file_invalid");
  return token;
}

export async function readT3Response(response: Response): Promise<unknown> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`t3_http_${response.status}`);
  }
  if (!response.body) throw new Error("t3_empty_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error("t3_response_budget");
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new Error("t3_invalid_json");
    }
  } finally {
    await reader.cancel();
  }
}

/** Only passive reads are available; never starts or resumes a provider. */
export class T3Reader {
  private controller = new AbortController();
  private credential = "";
  private sockets = new Set<WebSocket>();
  serverVersion: string | undefined;
  constructor(private readonly source: T3Source) {}
  get secrets() {
    return this.credential ? [this.credential] : [];
  }
  async initialize() {
    const descriptor = t3DescriptorSchema.parse(
      await this.http("/.well-known/t3/environment", false),
    );
    if (descriptor.environmentId !== this.source.environmentId)
      throw new Error("t3_environment_mismatch");
    this.serverVersion = descriptor.serverVersion;
    this.credential = await readT3Credential(this.source.tokenFile);
  }
  private async http(path: string, authenticated = true, method = "GET") {
    return readT3Response(
      await fetch(new URL(path, this.source.url), {
        method,
        redirect: "error",
        headers: {
          ...T3_PROTOCOL_HEADERS,
          ...(authenticated
            ? { authorization: `Bearer ${this.credential}` }
            : {}),
        },
        signal: AbortSignal.any([
          this.controller.signal,
          AbortSignal.timeout(20_000),
        ]),
      }),
    );
  }
  shell() {
    return this.http("/api/orchestration/shell");
  }
  thread(threadId: string) {
    return this.http(
      `/api/orchestration/threads/${encodeURIComponent(threadId)}`,
    );
  }
  archived() {
    return this.rpc("orchestration.getArchivedShellSnapshot", {});
  }
  item(threadId: string, itemId: string) {
    return this.rpc("orchestration.getTurnItem", { threadId, itemId });
  }
  private async rpc(
    method:
      "orchestration.getArchivedShellSnapshot" | "orchestration.getTurnItem",
    payload: unknown,
  ): Promise<unknown> {
    const { ticket } = z
      .object({ ticket: z.string() })
      .parse(await this.http("/api/auth/websocket-ticket", true, "POST"));
    const url = new URL("/ws", this.source.url);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("wsTicket", ticket);
    url.searchParams.set("orchestrationProtocol", "2");
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      this.sockets.add(socket);
      let settled = false;
      const finish = (error: Error | null, value?: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.controller.signal.removeEventListener("abort", aborted);
        this.sockets.delete(socket);
        socket.close();
        if (error) reject(error);
        else resolve(value);
      };
      const timer = setTimeout(
        () => finish(new Error("t3_rpc_timeout")),
        20_000,
      );
      const aborted = () => finish(new Error("t3_reader_closed"));
      this.controller.signal.addEventListener("abort", aborted, { once: true });
      socket.addEventListener("open", () => {
        if (this.controller.signal.aborted) {
          aborted();
          return;
        }
        socket.send(
          JSON.stringify({
            _tag: "Request",
            id: "1",
            tag: method,
            payload,
            headers: [],
          }),
        );
      });
      socket.addEventListener("error", () =>
        finish(new Error("t3_rpc_unavailable")),
      );
      socket.addEventListener("close", () =>
        finish(new Error("t3_rpc_closed")),
      );
      socket.addEventListener("message", (message) => {
        if (typeof message.data !== "string") {
          finish(new Error("t3_rpc_protocol_error"));
          return;
        }
        if (Buffer.byteLength(message.data) > MAX_RESPONSE_BYTES) {
          finish(new Error("t3_response_budget"));
          return;
        }
        try {
          const decoded: unknown = JSON.parse(message.data);
          for (const raw of Array.isArray(decoded) ? decoded : [decoded]) {
            const result = exitSchema.safeParse(raw);
            if (!result.success || String(result.data.requestId) !== "1")
              continue;
            const exit = result.data.exit;
            finish(
              exit._tag === "Failure" ? new Error("t3_rpc_rejected") : null,
              exit._tag === "Success" ? exit.value : undefined,
            );
          }
        } catch {
          finish(new Error("t3_rpc_protocol_error"));
        }
      });
    });
  }
  async close() {
    this.controller.abort();
    for (const socket of this.sockets) socket.close();
    this.sockets.clear();
    this.credential = "";
  }
}
