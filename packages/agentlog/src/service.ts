import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { loadConfig } from "./config";

export async function installService(directory: string, executable: string) {
  if (process.platform !== "darwin")
    throw new Error("Use the documented systemd service on Linux");
  await loadConfig(directory);
  const escape = (value: string) =>
    value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  const label = "net.applification.astack-agentlog";
  const domain = `gui/${process.getuid?.()}`;
  const file = join(homedir(), `Library/LaunchAgents/${label}.plist`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    file,
    `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>${escape(executable)}</string><string>--state</string><string>${escape(directory)}</string><string>collect</string></array><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>30</integer><key>StandardErrorPath</key><string>${escape(join(directory, "service.err.log"))}</string><key>StandardOutPath</key><string>${escape(join(directory, "service.out.log"))}</string></dict></plist>`,
    { mode: 0o600 },
  );
  try {
    execFileSync("launchctl", ["bootout", `${domain}/${label}`], {
      stdio: "ignore",
    });
  } catch {
    /* A first installation has no service. */
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      execFileSync("launchctl", ["bootstrap", domain, file], {
        stdio: "ignore",
      });
      return;
    } catch {
      if (attempt === 4) throw new Error("Service registration failed");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
