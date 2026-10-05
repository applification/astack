import type { AgentEvent, AgentRun, Finding } from "./domain";

export function detectProblems(
  run: Pick<
    AgentRun,
    | "status"
    | "startedAt"
    | "completedAt"
    | "lastObservedAt"
    | "lastActivityAt"
    | "startTimeKnown"
  >,
  events: readonly AgentEvent[],
  now = Date.now(),
): Finding[] {
  const findings: Finding[] = [];
  if (run.status === "failed")
    findings.push({
      rule: "failed_turn",
      severity: "error",
      title: "Agent turn failed",
      evidence: events
        .filter((e) => e.kind === "error")
        .slice(0, 20)
        .map((e) => e.id),
    });
  const failedBySignature = new Map<string, AgentEvent[]>();
  for (const event of events) {
    if (
      !event.failed ||
      !event.signature ||
      !["shell_result", "test_result", "mcp_result", "error"].includes(
        event.kind,
      )
    )
      continue;
    const key = `${event.kind}:${event.signature}`;
    const existing = failedBySignature.get(key) ?? [];
    existing.push(event);
    failedBySignature.set(key, existing);
  }
  for (const failures of failedBySignature.values()) {
    if (failures.length < 3) continue;
    const first = failures[0];
    if (!first) continue;
    const rule =
      first.kind === "test_result"
        ? "failing_tests"
        : first.kind === "mcp_result"
          ? "mcp_failures"
          : first.kind === "error"
            ? "recurring_error"
            : "repeated_failure";
    findings.push({
      rule,
      severity: "warning",
      title: `${failures.length} failures with the same signature: ${first.title}`,
      evidence: failures.slice(0, 20).map((e) => e.id),
    });
  }
  const interventions = events.filter((e) => e.kind === "intervention");
  if (interventions.length)
    findings.push({
      rule: "intervention",
      severity: "info",
      title: `${interventions.length} explicit interventions`,
      evidence: interventions.slice(0, 20).map((e) => e.id),
    });
  if (
    run.startTimeKnown &&
    (run.completedAt ?? run.lastObservedAt) - run.startedAt > 30 * 60_000
  )
    findings.push({
      rule: "long_run",
      severity: "info",
      title: "Run exceeded 30 minutes",
      evidence: [],
    });
  if (
    run.status === "running" &&
    run.completedAt === null &&
    now - (run.lastActivityAt ?? run.lastObservedAt) > 6 * 3600_000
  )
    findings.push({
      rule: "inactive",
      severity: "warning",
      title:
        "No completion observed; no persisted session activity for six hours",
      evidence: [],
    });
  return findings.slice(0, 100);
}

export function skillCorrelations(runs: readonly AgentRun[]) {
  const groups = new Map<
    string,
    {
      name: string;
      kind: string;
      hash: string | null;
      provenance: string;
      runs: number;
      problematic: number;
    }
  >();
  for (const run of runs) {
    const seen = new Set<string>();
    for (const skill of run.skills) {
      const key = `${skill.kind}:${skill.name}:${skill.hash}:${skill.provenance}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const row = groups.get(key) ?? {
        name: skill.name,
        kind: skill.kind,
        hash: skill.hash,
        provenance: skill.provenance,
        runs: 0,
        problematic: 0,
      };
      row.runs++;
      if (run.findings.some((f) => f.severity !== "info")) row.problematic++;
      groups.set(key, row);
    }
  }
  return [...groups.values()].sort(
    (a, b) => b.problematic - a.problematic || b.runs - a.runs,
  );
}
