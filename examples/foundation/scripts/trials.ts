import { spawn, spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { command, foundationRoot, redact } from "./runtime";

type Usage = {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  [key: string]: unknown;
};
export class TrialEvents {
  actionIds = new Set<string>();
  usage: Usage[] = [];
  started = false;
  completed = false;
  failed = false;
  accept(event: unknown): void {
    if (!event || typeof event !== "object") return;
    const value = event as {
      type?: string;
      item?: { id?: string; type?: string };
      usage?: Usage;
    };
    if (value.type === "thread.started") this.started = true;
    if (value.type === "turn.completed") {
      this.completed = true;
      if (value.usage) this.usage.push(value.usage);
    }
    if (value.type === "turn.failed" || value.type === "error")
      this.failed = true;
    if (
      value.type === "item.started" &&
      value.item?.id &&
      !["agent_message", "reasoning"].includes(value.item.type ?? "")
    )
      this.actionIds.add(value.item.id);
  }
}
type AgentRun = {
  outcome: "completed" | "failed" | "inconclusive";
  exitCode: number | null;
  durationMs: number;
  actionCount: number;
  usage: Usage[];
  cost: null;
  costReason: string;
  termination: string;
  final: unknown;
};
const schema = {
  type: "object",
  properties: {
    outcome: { type: "string", enum: ["complete", "partial", "blocked"] },
    summary: { type: "string" },
    checks: { type: "array", items: { type: "string" } },
    gaps: { type: "array", items: { type: "string" } },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          file: { type: "string" },
          line: { type: "integer" },
          priority: { type: "integer" },
          explanation: { type: "string" },
        },
        required: ["title", "file", "line", "priority", "explanation"],
        additionalProperties: false,
      },
    },
  },
  required: ["outcome", "summary", "checks", "gaps", "findings"],
  additionalProperties: false,
};

/** Walk the current process tree while the parent still exists, then stop only its descendants. */
function stopTree(pid: number): void {
  const output = spawnSync("ps", ["-axo", "pid=,ppid="], {
    encoding: "utf8",
  }).stdout;
  const entries = output
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/).map(Number));
  const descendants = new Set<number>([pid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [child, parent] of entries)
      if (
        child &&
        parent &&
        descendants.has(parent) &&
        !descendants.has(child)
      ) {
        descendants.add(child);
        changed = true;
      }
  }
  for (const child of [...descendants].reverse()) {
    try {
      process.kill(child, "SIGTERM");
    } catch {}
  }
}
export async function runAgent(options: {
  cwd: string;
  directory: string;
  prompt: string;
  config: string[];
  reviewer?: boolean;
  timeoutMs?: number;
  actionLimit?: number;
  model?: string | undefined;
  reasoning?: string | undefined;
}): Promise<AgentRun> {
  await mkdir(options.directory, { recursive: true });
  const schemaPath = join(options.directory, "schema.json");
  await writeFile(schemaPath, JSON.stringify(schema));
  await writeFile(join(options.directory, "prompt.txt"), options.prompt);
  const finalPath = join(options.directory, "final.json");
  const args = [
    "exec",
    "--ephemeral",
    "--ignore-user-config",
    "--json",
    "-C",
    options.cwd,
    "-c",
    'approval_policy="never"',
    "-c",
    "agents.enabled=false",
    "-s",
    options.reviewer ? "read-only" : "workspace-write",
    "-c",
    "sandbox_workspace_write.network_access=true",
    "--output-schema",
    schemaPath,
    "-o",
    finalPath,
    ...options.config,
  ];
  if (options.model) args.push("-m", options.model);
  if (options.reasoning)
    args.push(
      "-c",
      `model_reasoning_effort=${JSON.stringify(options.reasoning)}`,
    );
  args.push("-");
  const child = spawn("codex", args, {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    detached: true,
  });
  const startedAt = Date.now(),
    events = new TrialEvents();
  let lines = "",
    stdout = "",
    stderr = "",
    termination = "normal";
  const timer = setTimeout(
    () => {
      termination = "wall-clock limit";
      if (child.pid) stopTree(child.pid);
    },
    options.timeoutMs ?? 20 * 60_000,
  );
  child.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdout += text;
    lines += text;
    let newline: number;
    while ((newline = lines.indexOf("\n")) >= 0) {
      const line = lines.slice(0, newline);
      lines = lines.slice(newline + 1);
      try {
        events.accept(JSON.parse(line));
      } catch {}
      if (
        events.actionIds.size >= (options.actionLimit ?? 80) &&
        termination === "normal"
      ) {
        termination = "action limit";
        if (child.pid) stopTree(child.pid);
      }
    }
  });
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
  child.stdin.end(options.prompt);
  let exitCode: number | null;
  try {
    exitCode = await new Promise<number | null>((done, fail) => {
      child.once("error", fail);
      child.once("close", done);
    });
  } finally {
    clearTimeout(timer);
  }
  await writeFile(join(options.directory, "events.jsonl"), redact(stdout));
  await writeFile(join(options.directory, "stderr.log"), redact(stderr));
  let final: unknown = null;
  try {
    const finalText = redact(await readFile(finalPath, "utf8"));
    await writeFile(finalPath, finalText);
    final = JSON.parse(finalText) as unknown;
  } catch {}
  return {
    outcome:
      termination !== "normal" || !events.completed || !final
        ? "inconclusive"
        : exitCode === 0 && !events.failed
          ? "completed"
          : "failed",
    exitCode,
    durationMs: Date.now() - startedAt,
    actionCount: events.actionIds.size,
    usage: events.usage,
    cost: null,
    costReason:
      "Codex JSONL did not return a monetary cost; no price-based estimate is substituted.",
    termination,
    final,
  };
}
const digest = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");
async function fileDigests(
  directory: string,
  prefix = "",
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      Object.assign(
        hashes,
        await fileDigests(join(directory, entry.name), relative),
      );
    else if (entry.isFile())
      hashes[relative] = digest(await readFile(join(directory, entry.name)));
  }
  return hashes;
}
async function installedCandidate(
  marketplace: string,
  expected: Record<string, string>,
): Promise<{ path: string; digest: string }> {
  const base = join(
    process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    "plugins/cache",
    marketplace,
    "applification",
  );
  for (const entry of await readdir(base, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(base, entry.name);
    const actual = await fileDigests(path);
    if (Object.entries(expected).every(([file, hash]) => actual[file] === hash))
      return { path, digest: digest(JSON.stringify(expected)) };
  }
  throw new Error(
    "Installed candidate files do not match the committed candidate snapshot",
  );
}

/** Run only on explicit invocation after candidate commit and rubric exist. No merge or external PR is created. */
export async function runTrials(options: {
  candidate: string;
  rubric: string;
  output: string;
  rounds?: number;
  model?: string | undefined;
  reasoning?: string | undefined;
}) {
  const repo = resolve(foundationRoot, "../.."),
    output = resolve(options.output);
  const candidate = (
    await command(["git", "rev-parse", `${options.candidate}^{commit}`], repo)
  ).trim();
  const rubricText = await readFile(options.rubric, "utf8");
  if (!rubricText.trim()) throw new Error("Trial rubric is empty");
  const temporary = await mkdtemp(join(tmpdir(), "astack-trials-"));
  const snapshot = join(temporary, "candidate");
  await mkdir(snapshot, { recursive: true });
  await mkdir(output, { recursive: true });
  const archive = join(temporary, "candidate.tar");
  await command(
    ["git", "archive", "--format=tar", "-o", archive, candidate],
    repo,
  );
  await command(["tar", "-xf", archive, "-C", snapshot], repo);
  const marketplace = `astack-trial-${candidate.slice(0, 8)}-${Date.now()}`;
  await writeFile(
    join(snapshot, ".agents/plugins/marketplace.json"),
    JSON.stringify({
      name: marketplace,
      plugins: [
        {
          name: "applification",
          source: { source: "local", path: "./plugins/applification" },
          policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        },
      ],
    }),
  );
  const config = [
    "-c",
    `marketplaces.${marketplace}.source_type="local"`,
    "-c",
    `marketplaces.${marketplace}.source=${JSON.stringify(snapshot)}`,
    "-c",
    `plugins."applification@${marketplace}".enabled=true`,
  ];
  const expected = await fileDigests(join(snapshot, "plugins/applification"));
  const results: Record<string, unknown>[] = [];
  let installed = false;
  try {
    const install = await command(
      [
        "codex",
        "plugin",
        "add",
        `applification@${marketplace}`,
        "--json",
        ...config,
      ],
      snapshot,
      process.env,
    );
    installed = true;
    const verifiedInstall = await installedCandidate(marketplace, expected);
    await writeFile(
      join(output, "candidate.json"),
      JSON.stringify(
        {
          candidate,
          rubricDigest: digest(rubricText),
          marketplace,
          installedDigest: verifiedInstall.digest,
          sourceFiles: expected,
          install: JSON.parse(install) as unknown,
          isolation:
            "Fresh ephemeral processes and disposable Git projects; user config ignored, CLI authentication reused. Personal skills/system instructions may still be available.",
        },
        null,
        2,
      ),
    );
    for (let round = 1; round <= (options.rounds ?? 2); round++) {
      for (const kind of ["feature", "bug"] as const) {
        const name = `round-${round}-${kind}`,
          project = join(temporary, name),
          retained = join(output, name);
        await command(
          ["bun", join(snapshot, "scripts/create-foundation.ts"), project],
          snapshot,
          process.env,
        );
        await command(["bun", "install", "--frozen-lockfile"], project);
        await command(["git", "init"], project);
        await command(["git", "add", "."], project);
        await command(
          [
            "git",
            "-c",
            "user.name=astack trial",
            "-c",
            "user.email=trial@invalid.example",
            "commit",
            "-m",
            "Disposable trial baseline",
          ],
          project,
        );
        if (kind === "bug") {
          const path = join(project, "packages/backend/convex/workItems.ts"),
            source = await readFile(path, "utf8");
          const marker = "status: args.status";
          if (!source.includes(marker))
            throw new Error(
              "Seed marker changed; update the maintained defect fixture before running trials",
            );
          await writeFile(
            path,
            source.replace(
              marker,
              "status: args.status === 'done' ? 'open' : 'done'",
            ),
          );
          await command(["git", "add", "."], project);
          await command(
            [
              "git",
              "-c",
              "user.name=astack trial",
              "-c",
              "user.email=trial@invalid.example",
              "commit",
              "-m",
              "Seed status regression",
            ],
            project,
          );
        }
        const baseline = (
          await command(["git", "rev-parse", "HEAD"], project)
        ).trim();
        const task =
          kind === "feature"
            ? "Add title editing for an existing work item through the web and MCP. Preserve ownership checks, validate non-empty titles, and prove that edits made through either surface survive a fresh read through the other."
            : "Marking a work item done leaves it open, and reopening can leave it done. Reproduce the defect through the running product, fix it, retain a regression, and prove status changes agree across web and MCP.";
        const prompt = `$applification:astack ${task}\n\nThis is an authorized disposable trial. Complete local changes and proof, but do not publish a PR, push, merge or contact anyone. Use this project\'s existing scripts, skill and feature map. Do not inspect the trial harness or evaluator rubric. Report observed checks and material gaps honestly. The caller enforces a 20-minute deadline and 80-action cap. Return structured final output; findings may be empty.`;
        const agent = await runAgent({
          cwd: project,
          directory: join(retained, "task"),
          prompt,
          config,
          model: options.model,
          reasoning: options.reasoning,
        });
        await command(["git", "add", "-N", "."], project);
        const reviewer = await runAgent({
          cwd: project,
          directory: join(retained, "review"),
          config,
          model: options.model,
          reasoning: options.reasoning,
          reviewer: true,
          prompt: `Review this disposable project's diff against baseline ${baseline}. Intended task: ${task} Inspect correctness, ownership/auth boundaries, proof claims and missing regressions. Do not edit, publish, or contact anyone. Report only actionable findings with verified file and line. Return structured final output; outcome is complete when the review is complete.`,
        });
        let acceptance: unknown;
        try {
          await command(
            [
              "bun",
              "run",
              "verify",
              "--",
              "--evidence",
              join(retained, "acceptance"),
            ],
            project,
            undefined,
            8 * 60_000,
          );
          acceptance = JSON.parse(
            await readFile(join(retained, "acceptance/report.json"), "utf8"),
          );
        } catch (error) {
          try {
            acceptance = JSON.parse(
              await readFile(join(retained, "acceptance/report.json"), "utf8"),
            );
          } catch {
            acceptance = {
              outcome: "inconclusive",
              error: redact(String(error)),
            };
          }
        }
        const diff = await command(["git", "diff", baseline, "--"], project);
        await mkdir(retained, { recursive: true });
        await writeFile(join(retained, "change.diff"), redact(diff));
        const result = {
          round,
          kind,
          candidate,
          baseline,
          agent,
          reviewer,
          acceptance,
        };
        results.push(result);
        await writeFile(
          join(output, "report.json"),
          JSON.stringify(
            {
              format: "astack-foundation-trials/v1",
              candidate,
              rubricDigest: digest(rubricText),
              limits: {
                taskMs: 20 * 60_000,
                reviewerMs: 20 * 60_000,
                actions: 80,
              },
              results,
              interpretation:
                "Completed tasks and green commands do not alone establish rubric success. Read retained product observations and fresh review findings.",
            },
            null,
            2,
          ),
        );
        await rm(project, { recursive: true, force: true });
      }
    }
  } finally {
    if (installed)
      await command(
        [
          "codex",
          "plugin",
          "remove",
          `applification@${marketplace}`,
          ...config,
        ],
        snapshot,
        process.env,
      ).catch(() => undefined);
    await rm(temporary, { recursive: true, force: true });
  }
  return results;
}
if (import.meta.main) {
  const value = (flag: string) => {
    const index = process.argv.indexOf(flag);
    return index < 0 ? undefined : process.argv[index + 1];
  };
  const candidate = value("--candidate"),
    rubric = value("--rubric"),
    output = value("--output");
  if (!candidate || !rubric || !output)
    throw new Error(
      "Usage: bun scripts/trials.ts --candidate COMMIT --rubric FILE --output DIRECTORY [--rounds 2] [--model MODEL] [--reasoning EFFORT]",
    );
  await runTrials({
    candidate,
    rubric,
    output,
    rounds: Number(value("--rounds") ?? 2),
    model: value("--model"),
    reasoning: value("--reasoning"),
  });
}
