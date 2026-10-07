import { Copy, Folder, GitFork, Info } from "lucide-react";
import { HelpCard } from "@astack/ui";
import { useCopyToast } from "./copy-toast";
import { ScheduledBadge, ScheduleSnapshot } from "./scheduled-tasks";
import { automationName } from "@astack/agent-observability/automations";
import type { AgentRun } from "@astack/agent-observability";
import {
  providerName,
  repositoryPresentation,
} from "@astack/agent-observability/presentation";

export function ProviderLabel({ agent }: { agent: string }) {
  const provider = agent.toLowerCase();
  return (
    <span className="provider-label">
      {(provider === "codex" || provider === "claude") && (
        <img
          className={`provider-logo provider-logo-${provider}`}
          src={`/providers/${provider}.svg`}
          alt=""
          width={20}
          height={20}
        />
      )}
      {providerName(agent)}
    </span>
  );
}

export function RepositoryLink({ value }: { value: string }) {
  const repository = repositoryPresentation(value);
  return repository.kind === "remote" ? (
    <a
      className="repository-link"
      href={repository.href}
      target="_blank"
      rel="noreferrer"
      title={value}
      aria-label={`Repository ${repository.identity}`}
    >
      {repository.github ? (
        <img
          className="repository-logo"
          src="/providers/github.svg"
          width={16}
          height={16}
          alt=""
        />
      ) : (
        <GitFork size={16} aria-hidden="true" />
      )}
      <span>{repository.label}</span>
    </a>
  ) : (
    <span className="repository-link" title={value}>
      <Folder size={16} aria-hidden="true" />
      <span>{repository.label}</span>
    </span>
  );
}

export function CopyValue({
  value,
  label,
  showValueOnFailure = false,
}: {
  value: string;
  label: string;
  showValueOnFailure?: boolean;
}) {
  const notify = useCopyToast();
  return (
    <span className="copy-value">
      <button
        type="button"
        className="icon-button"
        aria-label={`Copy ${label}`}
        title={`Copy ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            notify({ kind: "copied" });
          } catch {
            notify({
              kind: "failed",
              fullValue: showValueOnFailure ? value : null,
            });
          }
        }}
      >
        <Copy size={14} aria-hidden="true" />
      </button>
    </span>
  );
}

function Identifier({ label, value }: { label: string; value: string }) {
  const short =
    value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
  return (
    <div className="identifier">
      <span>{label}</span>
      <code title={value}>{short}</code>
      <CopyValue value={value} label={`${label.toLowerCase()} ID`} />
    </div>
  );
}

export function RunMetadata({
  run,
  duration,
}: {
  run: AgentRun;
  duration: string;
}) {
  return (
    <dl className="metadata">
      {run.automation && (
        <div>
          <dt>Scheduled task</dt>
          <dd>
            <strong>{automationName(run.automation)}</strong>
            <span className="secondary">
              <ScheduledBadge run={run} />
            </span>
            <ScheduleSnapshot automation={run.automation} />
          </dd>
        </div>
      )}
      <div>
        <dt>Repository / working directory</dt>
        <dd>
          <RepositoryLink value={run.repo ?? run.cwd} />
          <details className="metadata-details">
            <summary>Full location</summary>
            <code>{run.repo ?? run.cwd}</code>
            <CopyValue
              value={run.repo ?? run.cwd}
              label="repository or directory"
            />
          </details>
        </dd>
      </div>
      <div>
        <dt>Branch / commit</dt>
        <dd>
          {run.branch ?? "Unknown"}
          <span className="secondary">
            {run.commit?.slice(0, 12) ?? "Unknown commit"}
          </span>
        </dd>
      </div>
      <div>
        <dt>Session / attempt</dt>
        <dd>
          <Identifier label="Session" value={run.sessionId} />
          <Identifier label="Attempt" value={run.attemptId} />
          <details className="metadata-details">
            <summary>Full identifiers</summary>
            <span className="secondary">Session</span>
            <code>{run.sessionId}</code>
            <span className="secondary">Attempt</span>
            <code>{run.attemptId}</code>
          </details>
        </dd>
      </div>
      <div>
        <dt>Model from thread metadata</dt>
        <dd>{run.model ?? "Unknown"}</dd>
      </div>
      <div>
        <dt>Duration / events</dt>
        <dd>
          {duration} · {run.eventCount} events
        </dd>
      </div>
      <div>
        <dt>Work outcome</dt>
        <dd>{run.outcome}</dd>
      </div>
    </dl>
  );
}

export function ProblemRate({
  runs,
  problematic,
}: {
  runs: number;
  problematic: number;
}) {
  const rate = runs ? Math.round((100 * problematic) / runs) : null;
  return (
    <HelpCard
      label={`${rate === null ? "Unknown" : `${rate}%`} problem rate: ${problematic} of ${runs} runs`}
      trigger={
        <>
          {rate === null ? "—" : `${rate}%`}
          <Info size={13} aria-hidden="true" />
        </>
      }
    >
      <strong>
        {problematic} of {runs} runs had a problem
      </strong>
      <p>
        Problem rate = runs with at least one warning or error finding ÷ runs
        where this skill, workflow or instruction was observed.
      </p>
      <p>
        Counts use the selected project scope and the same version/hash and
        provenance group. Each run is counted once; informational findings are
        excluded.
      </p>
      <p className="subtitle">
        This describes co-occurrence. It does not establish that the skill
        caused a problem or that the engineering task failed.
      </p>
    </HelpCard>
  );
}
