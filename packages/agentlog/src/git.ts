import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  folderIdentity,
  repositoryIdentity,
} from "@astack/agent-observability/projects";

const execute = promisify(execFile);

// Git follows linked worktrees' .git/commondir pointers for us. Read only
// repository configuration, with inherited overrides/global config disabled.
export async function localRepository(cwd: string): Promise<string | null> {
  if (!folderIdentity(cwd)) return null;
  try {
    const { stdout } = await execute(
      Bun.which("git") ?? "git",
      ["-C", cwd, "config", "--no-includes", "--get", "remote.origin.url"],
      {
        encoding: "utf8",
        timeout: 1000,
        killSignal: "SIGKILL",
        maxBuffer: 8 * 1024,
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => !key.startsWith("GIT_"),
            ),
          ),
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
          GIT_TERMINAL_PROMPT: "0",
        },
      },
    );
    // Credentials never leave this boundary; no command output is logged.
    return repositoryIdentity(stdout.trim());
  } catch {
    return null;
  }
}
