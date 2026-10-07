import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@astack/observatory-backend/api";
import { Button } from "@astack/ui";
import { evaluationLink } from "./evaluations";

export function GenerateEvaluationButton({
  available,
  generate,
}: {
  available: boolean;
  generate: () => Promise<void>;
}) {
  const inFlight = useRef(false);
  const [state, setState] = useState<
    | { kind: "ready" }
    | { kind: "pending" }
    | { kind: "failed"; message: string }
  >({ kind: "ready" });
  const submit = async () => {
    if (inFlight.current || !available) return;
    inFlight.current = true;
    setState({ kind: "pending" });
    try {
      await generate();
      setState({ kind: "ready" });
    } catch (error) {
      setState({
        kind: "failed",
        message:
          error instanceof ConvexError && typeof error.data === "string"
            ? error.data
            : "Could not generate an evaluation. Please try again.",
      });
    } finally {
      inFlight.current = false;
    }
  };
  return (
    <div className="space-y-2">
      <Button
        disabled={!available || state.kind === "pending"}
        onClick={() => void submit()}
      >
        {state.kind === "pending"
          ? "Generating evaluation…"
          : "Generate evaluation"}
      </Button>
      {!available && (
        <p className="subtitle">
          Readable capture is required to generate an evaluation.
        </p>
      )}
      {state.kind === "failed" && (
        <p role="alert" className="negative">
          {state.message}
        </p>
      )}
    </div>
  );
}

export function GenerateEvaluation({
  runId,
  projectId,
  available,
}: {
  runId: string;
  projectId: string;
  available: boolean;
}) {
  const generate = useMutation(api.evaluations.generate);
  return (
    <GenerateEvaluationButton
      available={available}
      generate={async () => {
        const saved = await generate({ runId, projectId });
        location.hash = evaluationLink(saved.evaluationId, saved.projectId);
      }}
    />
  );
}
