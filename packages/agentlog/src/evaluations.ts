import {
  evaluationManifestSchema,
  evaluationSchema,
  evaluateProof,
} from "@astack/agent-observability/evaluations";
import type { LocalStore } from "./store";
import { approvedRun } from "./projects";

export function importEvaluation(
  store: LocalStore,
  machineId: string,
  input: unknown,
) {
  const manifest = evaluationManifestSchema.parse(input);
  const evaluation = evaluationSchema.parse({
    ...manifest,
    id: machineId + ":evaluation:" + manifest.id,
    machineId,
  });
  for (const id of evaluation.runIds) {
    const run = approvedRun(store, id);
    if (
      !run ||
      run.machineId !== machineId ||
      run.projectId !== evaluation.projectId
    )
      throw new Error(
        "Evaluation run outside this machine's enabled project capture",
      );
  }
  const queued = store.put({ kind: "evaluation", value: evaluation });
  return {
    id: evaluation.id,
    queued,
    verification: evaluateProof(evaluation).verdict,
  };
}
