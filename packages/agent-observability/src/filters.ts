import { z } from "zod";
import { filterSchema, runSchema, type AgentRun } from "./domain";

export const filterOptionSchema = z.object({
  dimension: filterSchema.shape.dimension.exclude([
    "project",
    "capability",
    "problem",
  ]),
  value: z.string().min(1).max(4096),
  label: z.string().min(1).max(8192),
});
export const filterOptionsSchema = z.array(filterOptionSchema);
export type FilterOption = z.infer<typeof filterOptionSchema>;
export type RunFilter = z.infer<typeof filterSchema>;

const statusLabels = {
  running: "No completion observed",
  completed: "Turn completed",
  failed: "Failed",
  interrupted: "Interrupted",
  unknown: "Unknown",
} satisfies Record<AgentRun["status"], string>;
const outcomeLabels = {
  unknown: "Unknown",
  success: "Success",
  failure: "Failure",
} satisfies Record<AgentRun["outcome"], string>;

export const fixedFilterOptions: readonly FilterOption[] = [
  ...runSchema.shape.status.options.map<FilterOption>((value) => ({
    dimension: "status",
    value,
    label: statusLabels[value],
  })),
  ...runSchema.shape.outcome.unwrap().options.map<FilterOption>((value) => ({
    dimension: "outcome",
    value,
    label: outcomeLabels[value],
  })),
];

export function runFilterOptions(run: AgentRun): FilterOption[] {
  const options: FilterOption[] = [];
  const add = (
    dimension: FilterOption["dimension"],
    value: string | undefined,
    label = value,
  ) => {
    if (value && label) options.push({ dimension, value, label });
  };
  add("repo", run.repo ?? run.cwd);
  add("agent", run.agent);
  add("version", run.agentVersion);
  add("machine", run.machineId, `${run.machineName} · ${run.machineId}`);
  add("branch", run.branch);
  add("status", run.status, statusLabels[run.status]);
  add("outcome", run.outcome, outcomeLabels[run.outcome]);
  add(
    "work",
    run.work?.id,
    run.work?.label ? `${run.work.label} · ${run.work.id}` : run.work?.id,
  );
  for (const skill of run.skills) add("skill", skill.name);
  for (const tool of run.tools) add("tool", tool);
  return options;
}

export function mergeFilterOptions(
  options: readonly FilterOption[],
): FilterOption[] {
  const unique = new Map<string, FilterOption>();
  for (const option of options) {
    const key = JSON.stringify([option.dimension, option.value]);
    if (!unique.has(key)) unique.set(key, option);
  }
  return [...unique.values()].sort(
    (a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value),
  );
}
