import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export async function installBackendStartup(runtime: string) {
  if (process.platform !== "darwin") return;
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const docker = Bun.which("docker");
  if (!docker) throw new Error("Docker CLI unavailable");
  const script = join(runtime, "start-backend.sh");
  await writeFile(
    script,
    `#!/bin/zsh\n/usr/bin/open -g /Applications/OrbStack.app\nfor attempt in {1..45}; do\n  if ${quote(docker)} info >/dev/null 2>&1; then\n    ${quote(docker)} compose --project-directory ${quote(runtime)} up -d\n    exit $?\n  fi\n  /bin/sleep 2\ndone\nexit 1\n`,
    { mode: 0o700 },
  );
  const label = "net.applification.astack-observatory";
  const directory = join(homedir(), "Library/LaunchAgents");
  await mkdir(directory, { recursive: true });
  const plist = join(directory, `${label}.plist`);
  await writeFile(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>/bin/zsh</string><string>${escape(script)}</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>${escape(join(runtime, "startup.out.log"))}</string><key>StandardErrorPath</key><string>${escape(join(runtime, "startup.err.log"))}</string></dict></plist>`,
    { mode: 0o600 },
  );
  const domain = `gui/${process.getuid?.()}`;
  try {
    execFileSync("launchctl", ["bootout", `${domain}/${label}`], {
      stdio: "ignore",
    });
  } catch {}
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      execFileSync("launchctl", ["bootstrap", domain, plist], {
        stdio: "ignore",
      });
      return;
    } catch {
      if (attempt === 4) throw new Error("Backend startup registration failed");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
