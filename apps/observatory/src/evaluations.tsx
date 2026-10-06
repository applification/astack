import { useRef, useState } from "react";
import { useForm } from "@tanstack/react-form";
import { useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@astack/observatory-backend/api";
import { Badge, Button, Input } from "@astack/ui";
import {
  assessmentInputSchema,
  evaluateProof,
  validateAssessment,
  verdictSchema,
  type AssessmentInput,
  type Evaluation,
} from "@astack/agent-observability/evaluations";
import {
  evaluationDetailSchema,
  evaluationSummarySchema,
  type EvaluationDetail,
  type EvaluationSummary,
} from "@astack/agent-observability/evaluation-view";

export const evaluationLink = (id: string, projectId: string) =>
  "#evaluation/" +
  encodeURIComponent(id) +
  "?" +
  new URLSearchParams({ project: projectId });
const runLink = (runId: string, projectId: string, eventId?: string) =>
  "#run/" +
  encodeURIComponent(runId) +
  "?" +
  new URLSearchParams({
    project: projectId,
    ...(eventId ? { event: eventId } : {}),
  });
const label = (value: string | null) =>
  value === null
    ? "Awaiting owner review"
    : value === "pass"
      ? "Pass"
      : value === "fail"
        ? "Fail"
        : "Inconclusive";

export function EvaluationTable({ rows }: { rows: EvaluationSummary[] }) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Evaluation</th>
            <th>Captured turns</th>
            <th>Reported verification</th>
            <th>Assessed outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <a href={evaluationLink(row.id, row.projectId)}>{row.title}</a>
                <span className="secondary">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </td>
              <td>{row.turns}</td>
              <td>{label(row.verification)}</td>
              <td>{label(row.outcome)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="empty">No evaluations in this project scope yet.</p>
  );
}
type DraftJudgment = {
  verdict: "pass" | "fail" | "inconclusive";
  reason: string;
  caseId: string;
  runId: string;
  eventId: string;
};
function JudgmentEditor({
  name,
  value,
  change,
  evaluation,
  allowPass = true,
}: {
  name: string;
  value: DraftJudgment;
  change: (value: DraftJudgment) => void;
  evaluation: Evaluation;
  allowPass?: boolean;
}) {
  return (
    <fieldset className="project-form min-w-0">
      <legend>{name}</legend>
      <label>
        {name} verdict
        <select
          value={value.verdict}
          onChange={(event) =>
            change({
              ...value,
              verdict: verdictSchema.parse(event.target.value),
            })
          }
        >
          <option value="inconclusive">Inconclusive</option>
          <option value="pass" disabled={!allowPass}>
            Pass
          </option>
          <option value="fail">Fail</option>
        </select>
      </label>
      <label>
        Reason for {name}
        <textarea
          required
          rows={2}
          maxLength={4096}
          value={value.reason}
          onChange={(event) => change({ ...value, reason: event.target.value })}
        />
      </label>
      <label>
        Acceptance evidence for {name}
        <select
          value={value.caseId}
          onChange={(event) => change({ ...value, caseId: event.target.value })}
        >
          {evaluation.cases.map((item) => (
            <option key={item.id} value={item.id}>
              {item.id} · {item.expected}
            </option>
          ))}
        </select>
      </label>
      <details>
        <summary>Cite a captured trace event instead</summary>
        <label>
          Captured turn for {name}
          <select
            value={value.runId}
            onChange={(event) =>
              change({ ...value, runId: event.target.value })
            }
          >
            {evaluation.runIds.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          Trace event ID for {name}
          <Input
            value={value.eventId}
            onChange={(event) =>
              change({ ...value, eventId: event.target.value })
            }
          />
        </label>
      </details>
    </fieldset>
  );
}
export function AssessmentForm({
  evaluation,
  save,
}: {
  evaluation: Evaluation;
  save: (assessment: AssessmentInput, requestId: string) => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const request = useRef<{ content: string; id: string } | null>(null);
  const draft: DraftJudgment = {
    verdict: "inconclusive",
    reason: "",
    caseId: evaluation.cases[0]?.id ?? "",
    runId: evaluation.runIds[0] ?? "",
    eventId: "",
  };
  const judgment = (value: DraftJudgment) => ({
    verdict: value.verdict,
    reason: value.reason,
    evidence: value.eventId.trim()
      ? [{ kind: "trace", runId: value.runId, eventId: value.eventId.trim() }]
      : [{ kind: "case", caseId: value.caseId }],
  });
  const form = useForm({
    defaultValues: {
      intent: draft,
      skills: evaluation.skillCriteria.map((item) => ({
        ...draft,
        criterionId: item.id,
      })),
      outcome: draft,
    },
    onSubmit: async ({ value }) => {
      setError("");
      setSaved(false);
      try {
        const input = assessmentInputSchema.parse({
          criteriaVersion: evaluation.criteriaVersion,
          intent: judgment(value.intent),
          skills: value.skills.map((item) => ({
            ...judgment(item),
            criterionId: item.criterionId,
          })),
          outcome: judgment(value.outcome),
        });
        validateAssessment(evaluation, input);
        const content = JSON.stringify(input);
        if (request.current?.content !== content)
          request.current = { content, id: crypto.randomUUID() };
        await save(input, request.current.id);
        setSaved(true);
      } catch {
        setError(
          "Assessment could not be saved. Supply a reason and valid evidence for every criterion, check verification and retry.",
        );
      }
    },
  });
  return (
    <form
      className="project-form"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2>Add an owner assessment</h2>
      <p className="subtitle">
        Judge intent and actual skill behavior or outputs. A skill read alone
        does not establish application. Each judgment needs a reason and
        evidence.
      </p>
      <form.Field name="intent">
        {(field) => (
          <JudgmentEditor
            name="Intent"
            evaluation={evaluation}
            value={field.state.value}
            change={field.handleChange}
          />
        )}
      </form.Field>
      <form.Field name="skills">
        {(field) => (
          <>
            {field.state.value.map((item, index) => (
              <JudgmentEditor
                key={item.criterionId}
                name={
                  evaluation.skillCriteria[index]?.skill ?? item.criterionId
                }
                evaluation={evaluation}
                value={item}
                change={(next) =>
                  field.handleChange(
                    field.state.value.map((current) =>
                      current.criterionId === item.criterionId
                        ? { ...next, criterionId: item.criterionId }
                        : current,
                    ),
                  )
                }
              />
            ))}
          </>
        )}
      </form.Field>
      <form.Field name="outcome">
        {(field) => (
          <JudgmentEditor
            name="Outcome"
            evaluation={evaluation}
            value={field.state.value}
            change={field.handleChange}
            allowPass={evaluateProof(evaluation).verdict === "pass"}
          />
        )}
      </form.Field>
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
      {saved && <p role="status">Assessment saved.</p>}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <Button type="submit" disabled={pending}>
            {pending ? "Saving assessment…" : "Save assessment"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
export function EvaluationView({
  detail,
  save,
}: {
  detail: EvaluationDetail;
  save?: (assessment: AssessmentInput, requestId: string) => Promise<void>;
}) {
  const { evaluation, assessments } = detail;
  const verification = evaluateProof(evaluation);
  const latest = assessments[0];
  return (
    <>
      <p className="eyebrow">Intent, skills & outcome</p>
      <h1>{evaluation.title}</h1>
      <div className="tag-list">
        <Badge>Reported verification: {label(verification.verdict)}</Badge>
        <Badge>
          Assessed outcome: {label(latest?.outcome.verdict ?? null)}
        </Badge>
        <Badge>{evaluation.runIds.length} captured turns</Badge>
      </div>
      <p className="subtitle">
        Criteria {evaluation.criteriaVersion} · {verification.evaluatorVersion}.
        Verification observations are supplied reports; owner assessments are
        separate.
      </p>
      <h2>Original intent</h2>
      <p>{evaluation.intent.request}</p>
      <p className="subtitle">
        {detail.source
          ? "Linked to the captured original request."
          : "Declared request; no captured prompt reference supplied."}
      </p>
      {detail.source && (
        <a
          href={runLink(
            detail.source.event.runId,
            evaluation.projectId,
            detail.source.event.id,
          )}
        >
          Original request in trace
        </a>
      )}
      {evaluation.intent.clarifications.length > 0 && (
        <ul>
          {evaluation.intent.clarifications.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
      <h2>Acceptance results</h2>
      {evaluation.cases.map((item) => {
        const result = verification.cases.find((row) => row.caseId === item.id);
        const report = evaluation.proof?.cases.find(
          (row) => row.caseId === item.id,
        );
        return (
          <section key={item.id} className="notice" id={"case-" + item.id}>
            <h3>
              {item.id} · {item.expected}
            </h3>
            <Badge>{label(result?.verdict ?? "inconclusive")}</Badge>
            {result?.flaky && <Badge>Flaky</Badge>}
            <p>{result?.reason}</p>
            {report?.attempts.map((attempt, index) => (
              <details key={index}>
                <summary>
                  Attempt {index + 1} · {attempt.status}
                </summary>
                <p>{attempt.observed}</p>
                {attempt.independentObservation && (
                  <p>
                    Independent observation: {attempt.independentObservation}
                  </p>
                )}
                {attempt.artifacts.map((artifact) => (
                  <div key={artifact.path}>
                    <strong>{artifact.label}</strong>
                    <pre>{artifact.path + "\nSHA-256: " + artifact.sha256}</pre>
                  </div>
                ))}
              </details>
            ))}
          </section>
        );
      })}
      {evaluation.proof && (
        <details className="notice">
          <summary>Verification context & artifact references</summary>
          <dl className="break-all">
            <dt>Revision</dt>
            <dd>
              {evaluation.proof.revision} ·{" "}
              {evaluation.proof.dirty ? "Dirty checkout" : "Clean checkout"}
            </dd>
            <dt>Source digest</dt>
            <dd>
              <code>{evaluation.proof.sourceDigest}</code>
            </dd>
            <dt>Target</dt>
            <dd>{evaluation.proof.target}</dd>
            <dt>Actor / fixture</dt>
            <dd>
              {evaluation.proof.actor} · {evaluation.proof.fixture}
            </dd>
            <dt>Command</dt>
            <dd>
              <code>{evaluation.proof.command}</code>
            </dd>
          </dl>
          <p className="subtitle">
            Artifact paths and digests are supplied references. Artifact bytes
            are retained by the verification route and are not uploaded here.
          </p>
        </details>
      )}
      <h2>Skill application & output criteria</h2>
      {evaluation.skillCriteria.length ? (
        evaluation.skillCriteria.map((item) => (
          <p key={item.id}>
            <strong>{item.skill}</strong> · {item.expected}
          </p>
        ))
      ) : (
        <p className="subtitle">
          No skill criteria declared for this evaluation.
        </p>
      )}
      <h2>Captured work</h2>
      {detail.runs.map(({ run, revision }) => (
        <details key={run.id} className="notice">
          <summary>
            {run.title} · {run.agent} · {run.agentVersion ?? "Version unknown"}
          </summary>
          <a href={runLink(run.id, evaluation.projectId)}>Open captured turn</a>
          <p className="subtitle">
            Snapshot at ingestion revision {revision} · Model{" "}
            {run.model ?? "unknown"} · Capture-time commit{" "}
            {run.commit ?? "unknown"}
          </p>
          <div className="tag-list">
            {run.skills.map((skill, index) => (
              <Badge key={index}>
                {skill.name} · {skill.hash ?? "Unknown hash"} ·{" "}
                {skill.provenance}
              </Badge>
            ))}
          </div>
          {run.coverage.map((gap, index) => (
            <p key={index} className="subtitle">
              {gap}
            </p>
          ))}
        </details>
      ))}
      <h2>Assessment history</h2>
      {!assessments.length && (
        <p className="empty">
          No owner assessment yet. Agent completion and reported verification do
          not assign an engineering outcome.
        </p>
      )}
      {assessments.map((assessment) => (
        <section className="notice" key={assessment.id}>
          <h3>
            Owner · {new Date(assessment.assessedAt).toLocaleString()} ·{" "}
            {assessment.evaluatorVersion}
          </h3>
          {[
            { name: "Intent", ...assessment.intent },
            ...assessment.skills.map((item) => ({
              name:
                evaluation.skillCriteria.find((c) => c.id === item.criterionId)
                  ?.skill ?? item.criterionId,
              ...item,
            })),
            { name: "Outcome", ...assessment.outcome },
          ].map((judgment, index) => (
            <div key={index}>
              <strong>
                {judgment.name}: {label(judgment.verdict)}
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
                        document
                          .getElementById("case-" + evidence.caseId)
                          ?.scrollIntoView();
                      }}
                    >
                      {evidence.caseId} acceptance evidence
                    </a>
                  ) : (
                    <a
                      key={i}
                      href={runLink(
                        evidence.runId,
                        evaluation.projectId,
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
                </div>
              ))}
            </details>
          )}
        </section>
      ))}
      {detail.moreAssessments && (
        <p className="subtitle">Showing the latest 20 assessments.</p>
      )}
      {save && (
        <AssessmentForm
          key={evaluation.id}
          evaluation={evaluation}
          save={save}
        />
      )}
    </>
  );
}
export function Evaluations({ projectId }: { projectId?: string }) {
  const query = usePaginatedQuery(
    api.evaluations.list,
    projectId ? { projectId } : {},
    { initialNumItems: 20 },
  );
  return (
    <>
      <p className="eyebrow">Harness feedback</p>
      <h1>Evaluations</h1>
      <p className="subtitle">
        Intent and verification snapshots across captured turns, with separate
        owner assessments.
      </p>
      {query.status === "LoadingFirstPage" ? (
        <p role="status">Loading evaluations…</p>
      ) : (
        <EvaluationTable
          rows={query.results.map((value) =>
            evaluationSummarySchema.parse(JSON.parse(value)),
          )}
        />
      )}
      {query.status !== "Exhausted" && (
        <Button
          variant="outline"
          disabled={query.status !== "CanLoadMore"}
          onClick={() => query.loadMore(20)}
        >
          {query.status === "LoadingMore"
            ? "Loading…"
            : "Load more evaluations"}
        </Button>
      )}
    </>
  );
}
export function EvaluationPage({
  id,
  projectId,
}: {
  id: string;
  projectId?: string;
}) {
  const raw = useQuery(api.evaluations.detail, {
    evaluationId: id,
    ...(projectId ? { projectId } : {}),
  });
  const assess = useMutation(api.evaluations.assess);
  if (raw === undefined) return <p role="status">Loading evaluation…</p>;
  if (raw === null)
    return (
      <>
        <h1>Evaluation unavailable</h1>
        <p>This evaluation is absent or outside the selected project.</p>
      </>
    );
  return (
    <EvaluationView
      detail={evaluationDetailSchema.parse(JSON.parse(raw))}
      save={async (assessment, requestId) => {
        await assess({
          evaluationId: id,
          requestId,
          assessment: JSON.stringify(assessment),
        });
      }}
    />
  );
}
