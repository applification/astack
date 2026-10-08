import { useMemo } from "react";
import { useQueries } from "convex/react";
import { api } from "@astack/observatory-backend/api";
import { runSchema, type AgentRun } from "@astack/agent-observability";
import { runNamesSchema } from "@astack/agent-observability/naming";

export function useRunNames(runs: readonly AgentRun[]) {
  // Each bounded subscription tracks the corresponding loaded page.
  const serializedIds = JSON.stringify(runs.map((run) => run.id));
  // useQueries requires a stable request object across its internal rerenders.
  const queries = useMemo(() => {
    const ids = runSchema.shape.id.array().parse(JSON.parse(serializedIds));
    return Object.fromEntries(
      Array.from({ length: Math.ceil(ids.length / 50) }, (_, index) => [
        String(index),
        {
          query: api.naming.labels,
          args: {
            runIds: ids.slice(index * 50, (index + 1) * 50),
          },
        },
      ]),
    );
  }, [serializedIds]);
  const results = useQueries(queries);
  return Object.values(results).flatMap((value) => {
    const parsed = runNamesSchema.array().safeParse(value);
    return parsed.success ? parsed.data : [];
  });
}
