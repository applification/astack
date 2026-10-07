import { Badge } from "@astack/ui";
import {
  evaluateProof,
  acceptanceLabel,
  type Evaluation,
} from "@astack/agent-observability/evaluations";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";

export const runLink = (runId: string, projectId: string, eventId?: string) =>
  "#run/" +
  encodeURIComponent(runId) +
  "?" +
  new URLSearchParams({
    project: projectId,
    ...(eventId ? { event: eventId } : {}),
  });
export const verdictLabel = (value: string | null) =>
  value === null
    ? "Awaiting owner review"
    : value === "pass"
      ? "Pass"
      : value === "fail"
        ? "Fail"
        : "Inconclusive";
export const feedbackLabels = {
  yes: "Yes",
  partly: "Partly",
  no: "No",
  unsure: "Not sure yet",
};
export function textPreview(text: string, length = 220) {
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*#`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > length ? plain.slice(0, length).trimEnd() + "…" : plain;
}
export function VerificationEvidence({
  evaluation,
}: {
  evaluation: Evaluation;
}) {
  const verification = evaluateProof(evaluation);
  const passed = verification.cases.filter(
    (item) => item.verdict === "pass",
  ).length;
  return (
    <details className="evaluation-checks">
      <summary>
        {passed === evaluation.cases.length
          ? `${passed} ${passed === 1 ? "check" : "checks"} passed`
          : `${passed} of ${evaluation.cases.length} checks passed`}{" "}
        · what was checked?
      </summary>
      <p className="secondary">Reported verification observations.</p>
      {evaluation.cases.map((item) => {
        const result = verification.cases.find((row) => row.caseId === item.id);
        const report = evaluation.proof?.cases.find(
          (row) => row.caseId === item.id,
        );
        const latest = report?.attempts.at(-1);
        return (
          <details
            className="evaluation-check"
            key={item.id}
            id={"case-" + item.id}
          >
            <summary>
              <span>{textPreview(acceptanceLabel(item), 110)}</span>
              <span
                className={
                  result?.verdict === "fail"
                    ? "text-destructive"
                    : result?.verdict === "pass"
                      ? "text-success"
                      : "text-muted-foreground"
                }
              >
                <Badge>{verdictLabel(result?.verdict ?? "inconclusive")}</Badge>
              </span>
              {result?.flaky && <Badge>Flaky</Badge>}
            </summary>
            <dl className="evaluation-observation">
              <dt>Expected</dt>
              <dd>{acceptanceLabel(item)}</dd>
              <dt>Observed</dt>
              <dd
                className={result?.verdict === "fail" ? "negative" : undefined}
              >
                {latest?.observed ?? "No observation supplied for this check."}
              </dd>
              {latest?.independentObservation && (
                <>
                  <dt>Fresh observation</dt>
                  <dd>{latest.independentObservation}</dd>
                </>
              )}
            </dl>
            {result?.verdict !== "pass" &&
              result?.reason !== latest?.observed && (
                <p
                  className={
                    result?.verdict === "fail" ? "text-destructive" : "subtitle"
                  }
                >
                  {result?.reason}
                </p>
              )}
            <details className="metadata-details">
              <summary>Attempts & supporting evidence</summary>
              <p>Check {item.id}</p>
              {report?.attempts.map((attempt, index) => (
                <section key={index}>
                  <h4>
                    Attempt {index + 1} · {attempt.status}
                  </h4>
                  <p>{attempt.observed}</p>
                  {attempt.independentObservation && (
                    <p>
                      Independent observation: {attempt.independentObservation}
                    </p>
                  )}
                  {attempt.artifacts.map((artifact) => (
                    <div key={artifact.path}>
                      <strong>{artifact.label}</strong>
                      <pre>
                        {artifact.path + "\nSHA-256: " + artifact.sha256}
                      </pre>
                    </div>
                  ))}
                </section>
              ))}
            </details>
          </details>
        );
      })}
      {evaluation.proof && (
        <details className="metadata-details">
          <summary>Verification context & artifact references</summary>
          <dl className="metadata">
            <div>
              <dt>Revision</dt>
              <dd>
                {evaluation.proof.revision} ·{" "}
                {evaluation.proof.dirty ? "Dirty checkout" : "Clean checkout"}
              </dd>
            </div>
            <div>
              <dt>Source digest</dt>
              <dd>
                <code>{evaluation.proof.sourceDigest}</code>
              </dd>
            </div>
            <div>
              <dt>Target</dt>
              <dd>{evaluation.proof.target}</dd>
            </div>
            <div>
              <dt>Actor / fixture</dt>
              <dd>
                {evaluation.proof.actor} · {evaluation.proof.fixture}
              </dd>
            </div>
            <div>
              <dt>Command</dt>
              <dd>
                <code>{evaluation.proof.command}</code>
              </dd>
            </div>
          </dl>
          <p className="secondary">
            Artifact paths and digests are supplied references. The verification
            route retains their bytes.
          </p>
        </details>
      )}
    </details>
  );
}
export function WorkTimeline({ detail }: { detail: EvaluationDetail }) {
  const runs = [...detail.runs].sort(
    (a, b) => a.run.startedAt - b.run.startedAt,
  );
  return (
    <section aria-label="Work timeline">
      <h2>How the work unfolded</h2>
      <ol className="evaluation-flow">
        {runs.map(({ run, revision }, index) => {
          const step = detail.timeline.find((item) => item.runId === run.id);
          return (
            <li key={run.id}>
              <p className="secondary">
                {index + 1} ·{" "}
                {run.startTimeKnown
                  ? new Date(run.startedAt).toLocaleString()
                  : "Start time unavailable"}
              </p>
              <h3>{step?.title ?? `Captured turn ${index + 1}`}</h3>
              <p>
                {step?.request
                  ? textPreview(step.request.text)
                  : "No request excerpt available for this turn."}
              </p>
              {step?.response && (
                <p className="subtitle">{textPreview(step.response.text)}</p>
              )}
              <details>
                <summary>View this step</summary>
                <div className="evaluation-step-evidence">
                  {step?.request && (
                    <>
                      <h4>Captured request</h4>
                      <p className="whitespace-pre-wrap">{step.request.text}</p>
                      <a
                        href={runLink(
                          run.id,
                          detail.evaluation.projectId,
                          step.request.eventId,
                        )}
                      >
                        Request in trace
                      </a>
                    </>
                  )}
                  <h4>Latest captured response</h4>
                  {step?.response ? (
                    <>
                      <p className="whitespace-pre-wrap">
                        {step.response.text}
                      </p>
                      <a
                        href={runLink(
                          run.id,
                          detail.evaluation.projectId,
                          step.response.eventId,
                        )}
                      >
                        Response in trace
                      </a>
                    </>
                  ) : (
                    <p className="subtitle">
                      No response excerpt available. Open the trace to inspect
                      the recorded activity.
                    </p>
                  )}
                  {run.skills.length > 0 && (
                    <>
                      <h4>Recorded skill activity</h4>
                      <div className="tag-list">
                        {run.skills.map((skill, i) => (
                          <Badge key={i}>
                            {skill.name} ·{" "}
                            {skill.evidence === "read"
                              ? "Read"
                              : skill.evidence === "explicit_input"
                                ? "Input"
                                : "Declared"}
                          </Badge>
                        ))}
                      </div>
                      <p className="secondary">
                        A recorded read shows the skill was consulted. Its
                        application is judged from the work and outputs.
                      </p>
                    </>
                  )}
                  <p>
                    <a href={runLink(run.id, detail.evaluation.projectId)}>
                      Open full trace
                    </a>
                  </p>
                  <details className="metadata-details">
                    <summary>Capture details</summary>
                    <p>
                      {run.title} · {run.agent} ·{" "}
                      {run.agentVersion ?? "Version unknown"}
                    </p>
                    <p>
                      Snapshot revision {revision} · Turn {run.status} · Model{" "}
                      {run.model ?? "unknown"}
                    </p>
                    <p>
                      Capture-time commit <code>{run.commit ?? "unknown"}</code>
                    </p>
                    {(step?.request || step?.response) && (
                      <p>
                        Excerpts from current capture revisions{" "}
                        {step.request?.revision ?? "—"} /{" "}
                        {step.response?.revision ?? "—"}; the full records are
                        linked above.
                      </p>
                    )}
                    {run.skills.map((skill, i) => (
                      <p key={i}>
                        {skill.name} · {skill.hash ?? "Unknown hash"} ·{" "}
                        {skill.provenance}
                      </p>
                    ))}
                    {run.coverage.map((gap, i) => (
                      <p key={i}>{gap}</p>
                    ))}
                  </details>
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
function openCase(caseId: string) {
  const target = document.getElementById("case-" + caseId);
  for (let parent = target; parent; parent = parent.parentElement)
    if (parent instanceof HTMLDetailsElement) parent.open = true;
  target?.scrollIntoView({ block: "center" });
}
export function AssessmentHistory({ detail }: { detail: EvaluationDetail }) {
  return (
    <>
      <h2>Assessment history</h2>
      {!detail.assessments.length && (
        <p className="subtitle">No detailed assessment yet.</p>
      )}
      {detail.assessments.map((assessment) => (
        <section className="notice" key={assessment.id}>
          <h3>Owner · {new Date(assessment.assessedAt).toLocaleString()}</h3>
          {[
            { name: "Intent", ...assessment.intent },
            ...assessment.skills.map((item) => ({
              name:
                detail.evaluation.skillCriteria.find(
                  (c) => c.id === item.criterionId,
                )?.skill ?? item.criterionId,
              ...item,
            })),
            ...(assessment.flow
              ? [
                  { name: "Route choice", ...assessment.flow.route },
                  { name: "Flow execution", ...assessment.flow.execution },
                ]
              : []),
            { name: "Outcome", ...assessment.outcome },
          ].map((judgment, index) => (
            <div key={index}>
              <strong>
                {judgment.name}: {verdictLabel(judgment.verdict)}
              </strong>
              <p>{judgment.reason}</p>
              <div className="tag-list">
                {judgment.evidence.map((evidence, i) =>
                  evidence.kind === "case" ? (
                    <a
                      key={i}
                      href={"#case-" + evidence.caseId}
                      onClick={(event) => {
                        event.preventDefault();
                        openCase(evidence.caseId);
                      }}
                    >
                      {evidence.caseId} check evidence
                    </a>
                  ) : (
                    <a
                      key={i}
                      href={runLink(
                        evidence.runId,
                        detail.evaluation.projectId,
                        evidence.eventId,
                      )}
                    >
                      Trace evidence
                    </a>
                  ),
                )}
              </div>
            </div>
          ))}
          {assessment.traces.length > 0 && (
            <details>
              <summary>
                Evidence snapshots retained with this assessment
              </summary>
              {assessment.traces.map(({ event, revision }) => (
                <div key={event.id}>
                  <h4>
                    {event.title} · revision {revision}
                  </h4>
                  <pre>{JSON.stringify(event.data, null, 2)}</pre>
                  {event.workflow && (
                    <pre>{JSON.stringify(event.workflow, null, 2)}</pre>
                  )}
                </div>
              ))}
            </details>
          )}
        </section>
      ))}
      {detail.moreAssessments && (
        <p className="secondary">Showing the latest 20 assessments.</p>
      )}
    </>
  );
}
