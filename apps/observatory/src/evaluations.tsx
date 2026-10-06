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
  type OutcomeFeedbackInput,
} from "@astack/agent-observability/evaluations";
import {
  evaluationDetailSchema,
  evaluationSummarySchema,
  type EvaluationDetail,
  type EvaluationSummary,
} from "@astack/agent-observability/evaluation-view";

import {
  AssessmentHistory,
  feedbackLabels,
  runLink,
  textPreview,
  VerificationEvidence,
  verdictLabel,
  WorkTimeline,
} from "./evaluation-evidence";
import { OutcomeFeedbackForm } from "./outcome-feedback";

export const evaluationLink = (id: string, projectId: string) =>
  "#evaluation/" +
  encodeURIComponent(id) +
  "?" +
  new URLSearchParams({ project: projectId });
const label = verdictLabel;

export function EvaluationTable({ rows }: { rows: EvaluationSummary[] }) {
  return rows.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Evaluation</th>
            <th>Captured turns</th>
            <th>Checks</th>
            <th>Your review</th>
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
              <td>
                {row.verification === "pass"
                  ? "Passed"
                  : row.verification === "fail"
                    ? "Problems found"
                    : "Incomplete"}
              </td>
              <td>
                {row.feedback
                  ? feedbackLabels[row.feedback]
                  : row.outcome
                    ? "Detailed assessment: " + label(row.outcome)
                    : "Review pending"}
              </td>
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
  saveFeedback,
}: {
  detail: EvaluationDetail;
  save?: (assessment: AssessmentInput, requestId: string) => Promise<void>;
  saveFeedback?: (
    feedback: OutcomeFeedbackInput,
    requestId: string,
  ) => Promise<void>;
}) {
  const { evaluation, feedback } = detail;
  const verification = evaluateProof(evaluation);
  const resultStep = [...detail.runs]
    .sort((a, b) => b.run.startedAt - a.run.startedAt)
    .map(({ run }) => detail.timeline.find((step) => step.runId === run.id))
    .find((step) => step?.response);
  const checkStatus =
    verification.verdict === "pass"
      ? "Checks passed"
      : verification.verdict === "fail"
        ? "Checks found a problem"
        : "Checks incomplete";
  return (
    <div className="evaluation-page">
      <p className="eyebrow">Evaluation</p>
      <h1 className="run-heading">{evaluation.title}</h1>
      <section className="evaluation-intent">
        <h2>Original intent</h2>
        <p className="whitespace-pre-wrap">{evaluation.intent.request}</p>
        {detail.source ? (
          <a
            href={runLink(
              detail.source.event.runId,
              evaluation.projectId,
              detail.source.event.id,
            )}
          >
            Original request in trace
          </a>
        ) : (
          <p className="secondary">
            Declared request; no captured prompt reference supplied.
          </p>
        )}
        {evaluation.intent.clarifications.length > 0 && (
          <details className="metadata-details">
            <summary>
              Agreed scope · {evaluation.intent.clarifications.length}{" "}
              {evaluation.intent.clarifications.length === 1
                ? "clarification"
                : "clarifications"}
            </summary>
            <ul>
              {evaluation.intent.clarifications.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
      <section className="evaluation-result" aria-label="Result summary">
        <h2>Result</h2>
        {resultStep?.response ? (
          <>
            <p>{textPreview(resultStep.response.text, 320)}</p>
            <a
              href={runLink(
                resultStep.runId,
                evaluation.projectId,
                resultStep.response.eventId,
              )}
            >
              Read the agent’s response
            </a>
          </>
        ) : (
          <p>
            No response excerpt available. The work and verification evidence
            are linked below.
          </p>
        )}
        <div className="tag-list">
          <span
            className={
              verification.verdict === "fail"
                ? "text-destructive"
                : verification.verdict === "pass"
                  ? "text-success"
                  : "text-muted-foreground"
            }
          >
            <Badge>{checkStatus}</Badge>
          </span>
          <Badge>
            {feedback[0]
              ? "Your review: " + feedbackLabels[feedback[0].choice]
              : "Your review pending"}
          </Badge>
          <Badge>{evaluation.runIds.length} captured turns</Badge>
        </div>
        <p className="secondary">
          The agent’s response and reported checks are evidence for your review.
        </p>
      </section>
      <WorkTimeline detail={detail} />
      <VerificationEvidence evaluation={evaluation} />
      {saveFeedback && (
        <OutcomeFeedbackForm key={evaluation.id} save={saveFeedback} />
      )}
      {feedback.length > 0 && (
        <details className="evaluation-disclosure">
          <summary>
            Review history · {feedback.length}
            {detail.moreFeedback ? "+" : ""}
          </summary>
          {feedback.map((item) => (
            <section className="evaluation-review-record" key={item.id}>
              <strong>Your review: {feedbackLabels[item.choice]}</strong>
              <p className="secondary">
                {new Date(item.reviewedAt).toLocaleString()}
              </p>
              {item.comment && (
                <p className="whitespace-pre-wrap">{item.comment}</p>
              )}
            </section>
          ))}
          {detail.moreFeedback && (
            <p className="secondary">Showing the latest 20 reviews.</p>
          )}
        </details>
      )}
      <details className="evaluation-disclosure">
        <summary>Detailed intent and skill review</summary>
        <p className="subtitle">
          Use this when you want to assess the approach and outputs against
          specific criteria. Outcome feedback above does not assign these
          grades.
        </p>
        <h2>Skill application & output criteria</h2>
        {evaluation.skillCriteria.length ? (
          evaluation.skillCriteria.map((item) => (
            <p key={item.id}>
              <strong>{item.skill}</strong> · {item.expected}
            </p>
          ))
        ) : (
          <p className="subtitle">No skill criteria declared.</p>
        )}
        <AssessmentHistory detail={detail} />
        {save && (
          <AssessmentForm
            key={evaluation.id}
            evaluation={evaluation}
            save={save}
          />
        )}
        <p className="secondary">
          Criteria {evaluation.criteriaVersion} ·{" "}
          {verification.evaluatorVersion}
        </p>
      </details>
    </div>
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
        Review what was asked, how the work unfolded and whether the result
        delivered.
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
  const reviewOutcome = useMutation(api.evaluations.reviewOutcome);
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
      saveFeedback={async (feedback, requestId) => {
        await reviewOutcome({
          evaluationId: id,
          requestId,
          feedback: JSON.stringify(feedback),
        });
      }}
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
