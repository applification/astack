import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { z } from "zod";

const responseSchema = z.object({
  id: z.number().optional(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});
export class CodexReader {
  private child: ChildProcessWithoutNullStreams;
  private nextId = 0;
  private pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(binary: string, home: string) {
    this.child = spawn(binary, ["app-server", "--stdio"], {
      env: { ...process.env, CODEX_HOME: home },
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child.stderr.resume(); // Never forward Codex diagnostics: they may contain sensitive content.
    const lines = createInterface({ input: this.child.stdout });
    lines.on("line", (line) => {
      try {
        const response = responseSchema.parse(JSON.parse(line));
        if (response.id === undefined) return;
        const item = this.pending.get(response.id);
        if (!item) return;
        this.pending.delete(response.id);
        clearTimeout(item.timer);
        if (response.error)
          item.reject(new Error(`codex_rpc_${response.error.code}`));
        else item.resolve(response.result);
      } catch {
        /* Unknown notifications are intentionally ignored. */
      }
    });
    const fail = () => {
      for (const item of this.pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error("codex_reader_closed"));
      }
      this.pending.clear();
    };
    this.child.on("error", fail);
    this.child.on("exit", fail);
  }
  request(
    method: "initialize" | "thread/list" | "thread/read" | "thread/turns/list",
    params: unknown,
  ): Promise<unknown> {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("codex_reader_timeout"));
      }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(
        JSON.stringify({ id, method, params }) + "\n",
        (error) => {
          if (error) {
            this.pending.delete(id);
            clearTimeout(timer);
            reject(new Error("codex_reader_write"));
          }
        },
      );
    });
  }
  async initialize() {
    await this.request("initialize", {
      clientInfo: { name: "astack-agentlog", version: "0.1.0" },
      capabilities: { experimentalApi: true },
    });
    this.child.stdin.write(JSON.stringify({ method: "initialized" }) + "\n");
  }
  async close() {
    this.child.stdin.end();
    this.child.kill("SIGTERM");
  }
}
