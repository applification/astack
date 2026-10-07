import { useState } from "react";
import { Badge } from "@astack/ui";
import { PackageCheck, GitPullRequest } from "lucide-react";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import { evaluateProof } from "@astack/agent-observability/evaluations";
import {
  checkSummary,
  type DeliverySnapshot,
} from "@astack/agent-observability/delivery-evidence";
import { CopyValue } from "./run-metadata";
import {
  feedbackLabels,
  runLink,
  textPreview,
  VerificationEvidence,
} from "./evaluation-evidence";

function Revision({ value }: { value: string }) {
  return (
    <span className="delivery-revision" title={value}>
      <code>{value.slice(0, 8)}</code>
      <CopyValue value={value} label="delivery revision" showValueOnFailure />
    </span>
  );
}
function Checks({ checks }: { checks: DeliverySnapshot["checks"] }) {
  const totals = checkSummary(checks);
  const parts = [
    totals.passed && `${totals.passed} passed`,
    totals.failed && `${totals.failed} failed`,
    totals.pending && `${totals.pending} pending`,
    totals.skipped && `${totals.skipped} skipped / neutral`,
  ].filter(Boolean);
  return (
    <span
      className={
        totals.failed
          ? "text-destructive"
          : totals.pending || !checks.length
            ? "text-muted-foreground"
            : ""
      }
    >
      {parts.length ? parts.join(" · ") : "No CI checks reported"}
    </span>
  );
}
function Media({ media }: { media: DeliverySnapshot["media"][number] }) {
  const [unavailable, setUnavailable] = useState(false);
  if (media.kind === "link" || unavailable)
    return (
      <p className="delivery-media-link">
        <a href={media.url} target="_blank" rel="noreferrer">
          {media.label} ↗
        </a>
        <span className="secondary">
          {media.kind === "link"
            ? media.reason
            : "Preview unavailable — open the captured image link"}
        </span>
      </p>
    );
  return (
    <figure className="delivery-image">
      <a
        href={media.url}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open full image: ${media.label}`}
      >
        <img
          src={media.url}
          alt={media.label}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setUnavailable(true)}
        />
      </a>
      <figcaption>
        <a href={media.url} target="_blank" rel="noreferrer">
          Open full image ↗
        </a>
        <span>
          Image at <Revision value={media.revision} />
        </span>
      </figcaption>
    </figure>
  );
}

export function DeliveryResult({ detail }: { detail: EvaluationDetail }) {
  const { evaluation, delivery } = detail;
  const verification = evaluateProof(evaluation);
  const response = [...detail.runs]
    .sort((a, b) => b.run.startedAt - a.run.startedAt)
    .map(({ run }) => detail.timeline.find((step) => step.runId === run.id))
    .find((step) => step?.response);
  const snapshot = delivery?.evidence.snapshot;
  const current = delivery?.evidence.current;
  const checkStatus =
    verification.verdict === "pass"
      ? "Checks passed"
      : verification.verdict === "fail"
        ? "Checks found a problem"
        : "Checks incomplete";
  return (
    <section className="evaluation-result" aria-label="Result summary">
      <h2>Result</h2>
      <div className="delivery-result" data-result-card="">
        <div className="evaluation-prompt-heading">
          <PackageCheck size={16} aria-hidden="true" />
          <span>Delivered result</span>
        </div>
        <p className="delivery-summary">
          {snapshot?.summary
            ? textPreview(snapshot.summary, 360)
            : response?.response
              ? textPreview(response.response.text, 320)
              : "No response excerpt available. The work and verification evidence are linked below."}
        </p>
        {snapshot && (
          <>
            <div className="delivery-pr">
              <GitPullRequest size={18} aria-hidden="true" />
              <div>
                <a href={snapshot.url} target="_blank" rel="noreferrer">
                  #{snapshot.number} · {snapshot.title}
                </a>
                <p className="secondary">
                  {snapshot.repository} · Captured at{" "}
                  <Revision value={snapshot.headRevision} />
                </p>
              </div>
            </div>
            {snapshot.media[0] && (
              <Media key={snapshot.media[0].url} media={snapshot.media[0]} />
            )}
            {snapshot.media.slice(1).map((media) => (
              <p className="delivery-media-link" key={media.url}>
                <a href={media.url} target="_blank" rel="noreferrer">
                  {media.label} ↗
                </a>
                {media.kind === "link" && (
                  <span className="secondary">{media.reason}</span>
                )}
              </p>
            ))}
            <div
              className="delivery-verification"
              role="region"
              aria-label="Captured PR checks"
            >
              <strong>CI at capture</strong>
              <Checks checks={snapshot.checks} />
              <span className="secondary">
                {new Date(snapshot.capturedAt).toLocaleString()}
              </span>
            </div>
            <details className="metadata-details">
              <summary>Captured CI details</summary>
              <ul>
                {snapshot.checks.map((check, index) => (
                  <li key={index}>
                    {check.url ? (
                      <a href={check.url} target="_blank" rel="noreferrer">
                        {check.name}
                      </a>
                    ) : (
                      check.name
                    )}{" "}
                    ·{" "}
                    {check.status === "completed"
                      ? (check.conclusion ?? "Conclusion unavailable")
                      : check.status.replace("_", " ")}
                  </li>
                ))}
              </ul>
              {snapshot.media
                .filter((media) => media.kind === "image")
                .map((media) => (
                  <p key={media.url} className="secondary">
                    {media.label} · SHA-256{" "}
                    <span title={media.sha256}>
                      {media.sha256.slice(0, 12)}
                    </span>
                  </p>
                ))}
            </details>
            {current && (
              <div
                className="delivery-current"
                role="region"
                aria-label="Latest PR observation"
              >
                <span>
                  <strong>PR now</strong>{" "}
                  <Badge>{current.draft ? "Draft" : current.state}</Badge> ·{" "}
                  <Checks checks={current.checks} />
                </span>
                <p className="secondary">
                  Last observed {new Date(current.observedAt).toLocaleString()}
                  {current.headRevision !== snapshot.headRevision && (
                    <>
                      {" "}
                      · PR has changed since this evidence was captured. Current
                      head <Revision value={current.headRevision} />
                    </>
                  )}
                </p>
              </div>
            )}
          </>
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
            {detail.feedback[0]
              ? "Your review: " + feedbackLabels[detail.feedback[0].choice]
              : "Your review pending"}
          </Badge>
          <Badge>{evaluation.runIds.length} captured turns</Badge>
        </div>
        <VerificationEvidence evaluation={evaluation} />
        <footer className="delivery-links">
          {response?.response && (
            <a
              href={runLink(
                response.runId,
                evaluation.projectId,
                response.response.eventId,
              )}
            >
              Read the agent’s response
            </a>
          )}
          {delivery && (
            <a
              href={runLink(
                delivery.runId,
                evaluation.projectId,
                delivery.eventId,
              )}
            >
              Delivery evidence in trace
            </a>
          )}
        </footer>
        <p className="secondary">
          The agent’s response and reported checks are evidence for your review.
        </p>
      </div>
    </section>
  );
}
