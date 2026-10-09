import { createHash } from "node:crypto";
import {
  eventSchema,
  type AgentEvent,
  type AgentRun,
} from "@astack/agent-observability";
import type { DelegationResult } from "@astack/agent-observability/delegation";

export function observationAnchorKey(
  result: Pick<DelegationResult, "host" | "delegationId">,
) {
  return `t3-result-anchor:${createHash("sha256")
    .update(
      JSON.stringify([
        result.host.environmentId,
        result.host.threadId,
        result.delegationId,
      ]),
    )
    .digest("hex")}`;
}

// Only parsed, correctly scoped host observations may supplement an owner trace.
// Ordinary T3 messages and generic subagent_result events are never exceptions.
export function isHostObservation(event: AgentEvent, run: AgentRun): boolean {
  const parsed = eventSchema.safeParse(event);
  if (!parsed.success) return false;
  const result = parsed.data.delegationResult;
  if (
    !result ||
    event.runId !== run.id ||
    !event.id.startsWith(`${run.id}:t3-observation:`)
  )
    return false;
  if (
    !run.sessionReferences.some(
      (ref) =>
        ref.kind === "t3" &&
        ref.environmentId === result.host.environmentId &&
        ref.threadId === result.host.threadId,
    )
  )
    return false;
  if (
    result.host.runId !== null &&
    run.conversation?.hostRun?.id !== result.host.runId
  )
    return false;
  return run.delegations.some(
    (task) =>
      task.source === "t3" &&
      task.id === result.delegationId &&
      JSON.stringify(task.child) === JSON.stringify(result.child),
  );
}
