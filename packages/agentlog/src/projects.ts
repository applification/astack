import {
  projectPolicySchema,
  resolveProject,
  type Project,
} from "@astack/agent-observability/projects";
import type { CollectorConfig } from "./config";
import type { LocalStore } from "./store";

export function cachedProjects(store: LocalStore): Project[] {
  const raw = store.getMeta("projectPolicy");
  if (!raw) return [];
  try {
    return projectPolicySchema.parse(JSON.parse(raw));
  } catch {
    return [];
  }
}
export async function syncProjects(
  store: LocalStore,
  config: CollectorConfig,
  token: string,
) {
  try {
    const response = await fetch(
      new URL("/agentlog/projects", config.endpoint),
      {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      },
    );
    if (!response.ok) {
      if (response.status === 401) {
        store.setMeta("projectPolicy", "[]");
        store.applyProjectPolicy([]);
      }
      throw new Error("project_policy_unavailable");
    }
    const projects = projectPolicySchema.parse(await response.json());
    const policy = JSON.stringify(projects);
    if (store.getMeta("projectPolicy") !== policy) {
      store.setMeta("projectPolicy", policy);
      store.applyProjectPolicy(projects);
      store.resetCaptureCheckpoints();
    }
    store.setMeta(
      "projectHealth",
      JSON.stringify({
        status: "ok",
        syncedAt: Date.now(),
        projects: projects.filter((p) => p.enabled).length,
      }),
    );
    return projects;
  } catch {
    const projects = cachedProjects(store);
    store.setMeta(
      "projectHealth",
      JSON.stringify({
        status: projects.length ? "cached_offline" : "unavailable",
        projects: projects.filter((p) => p.enabled).length,
      }),
    );
    return projects;
  }
}
export function approvedRun(store: LocalStore, runId: string) {
  const record = store.getRecord(`run:${runId}`);
  if (record?.kind !== "run") return null;
  const project = resolveProject(cachedProjects(store), record.value);
  return project && record.value.projectId === project.projectId
    ? record.value
    : null;
}
