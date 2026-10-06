import { useEffect, useState, type ReactNode } from "react";
import {
  useConvexConnectionState,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@astack/observatory-backend/api";
import {
  runSchema,
  eventSchema,
  type AgentRun,
  capabilityGroupSchema,
  capabilityKey,
  filterSchema,
} from "@astack/agent-observability";
import { Button, Badge, Input } from "@astack/ui";
import { Activity, ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Trace } from "./trace";
import { Brand, ThemeControl } from "./theme";
import { ProjectSelector, Projects } from "./projects";
import type { Project } from "@astack/agent-observability/projects";

type Filter = { dimension: string; value: string };
const duration = (run: AgentRun) => {
  if (!run.startTimeKnown) return "Unknown";
  const elapsed = (run.completedAt ?? run.lastObservedAt) - run.startedAt;
  return elapsed < 60_000
    ? `${Math.max(0, Math.round(elapsed / 1000))}s`
    : `${Math.round(elapsed / 60_000)}m`;
};
const date = (time: number) =>
  new Date(time).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const runLink = (id: string, projectId?: string) =>
  `#run/${encodeURIComponent(id)}${projectId ? `?${new URLSearchParams({ project: projectId })}` : ""}`;
const listLink = (
  dimension: string,
  value: string,
  projectId = new URLSearchParams(location.hash.split("?")[1]).get("project") ??
    "",
) =>
  `#runs?${new URLSearchParams({ ...(projectId ? { project: projectId } : {}), [dimension]: value })}`;
function useRoute() {
  const [hash, setHash] = useState(location.hash || "#runs");
  useEffect(() => {
    const change = () => setHash(location.hash || "#runs");
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  return hash;
}
function LoadMore({
  status,
  loadMore,
}: {
  status: string;
  loadMore: (count: number) => void;
}) {
  return status === "Exhausted" ? null : (
    <div className="toolbar">
      <Button
        variant="outline"
        disabled={status !== "CanLoadMore"}
        onClick={() => loadMore(50)}
      >
        {status === "LoadingMore" ? "Loading…" : "Load more"}
      </Button>
      <span className="subtitle">
        Results and totals reflect loaded pages unless stated otherwise.
      </span>
    </div>
  );
}
function Status({ run }: { run: AgentRun }) {
  return (
    <span
      className={
        run.status === "failed"
          ? "negative"
          : run.status === "completed"
            ? "positive"
            : "neutral"
      }
    >
      {run.status === "completed"
        ? "Turn completed"
        : run.status === "running"
          ? "No completion observed"
          : run.status}
    </span>
  );
}
export function RunTable({
  runs,
  projects = [],
}: {
  runs: readonly AgentRun[];
  projects?: readonly Project[];
}) {
  return (
    <>
      <p className="table-hint">Scroll horizontally to see all columns.</p>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Agent runs table"
      >
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Run / repository</th>
              <th>Agent / machine</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>
                  {projects.find((p) => p.projectId === run.projectId)?.name ??
                    "Unassigned"}
                </td>
                <td>
                  <a
                    className="row-title"
                    href={runLink(run.id, run.projectId)}
                  >
                    {run.title}
                  </a>
                  <span className="secondary">{run.repo ?? run.cwd}</span>
                  <span className="secondary">
                    {!run.startTimeKnown && "Session date · "}
                    {date(run.startedAt)}
                    {run.branch ? ` · ${run.branch}` : ""}
                  </span>
                  {run.work && (
                    <a
                      className="secondary"
                      href={listLink("work", run.work.id, run.projectId)}
                    >
                      Work {run.work.id}
                    </a>
                  )}
                </td>
                <td>
                  {run.agent}
                  <span className="secondary">
                    {run.agentVersion ?? "Version unknown"} · {run.machineName}
                  </span>
                </td>
                <td>{duration(run)}</td>
                <td>
                  <Status run={run} />
                  <span className="secondary">Work outcome: {run.outcome}</span>
                </td>
                <td>
                  {run.findings.filter((f) => f.severity !== "info").length ? (
                    <span className="negative">
                      {run.findings.filter((f) => f.severity !== "info").length}{" "}
                      problems
                    </span>
                  ) : (
                    <span className="neutral">No problem detected</span>
                  )}
                  <div className="tag-list">
                    {run.skills
                      .filter((s) => s.kind === "skill")
                      .slice(0, 3)
                      .map((skill, i) => (
                        <Badge key={`${skill.name}:${i}`}>{skill.name}</Badge>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const filterDimensions = [
  ["repo", "Repository"],
  ["work", "Work reference"],
  ["agent", "Agent"],
  ["version", "Agent version"],
  ["machine", "Machine ID"],
  ["branch", "Branch"],
  ["status", "Status"],
  ["outcome", "Work outcome"],
  ["skill", "Skill / workflow"],
  ["tool", "Tool / MCP"],
] as const;
function Runs({
  route,
  problems = false,
  workView = false,
  projectId,
  projects,
}: {
  route: string;
  problems?: boolean;
  workView?: boolean;
  projectId?: string;
  projects: readonly Project[];
}) {
  const initial = new URLSearchParams(route.split("?")[1] ?? "");
  const [filters, setFilters] = useState<Filter[]>(() =>
    [...initial]
      .map(([dimension, value]) => ({ dimension, value }))
      .filter(
        (f) =>
          f.dimension !== "project" &&
          filterSchema.shape.dimension.safeParse(f.dimension).success,
      ),
  );
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  const query = usePaginatedQuery(
    api.observatory.runs,
    {
      ...(projectId ? { projectId } : {}),
      filters: [
        ...(problems ? [{ dimension: "problem", value: "yes" }] : []),
        ...filters,
      ],
      ...(after ? { after: new Date(`${after}T00:00:00`).getTime() } : {}),
      ...(before ? { before: new Date(`${before}T23:59:59`).getTime() } : {}),
    },
    { initialNumItems: 50 },
  );
  const runs = query.results.map((value) => runSchema.parse(JSON.parse(value)));
  const problematic = runs.filter((run) =>
    run.findings.some((f) => f.severity !== "info"),
  ).length;
  const skills = new Set(
    runs.flatMap((run) =>
      run.skills.filter((s) => s.kind === "skill").map((s) => s.name),
    ),
  );
  const machines = new Set(runs.map((run) => run.machineId));
  const title = workView
    ? "Work & agent activity"
    : problems
      ? "Problems & patterns"
      : "Agent runs";
  const workGroups = new Map<string, AgentRun[]>();
  for (const run of runs)
    if (run.work) {
      const workKey = JSON.stringify([run.projectId, run.work.id]);
      const group = workGroups.get(workKey) ?? [];
      group.push(run);
      workGroups.set(workKey, group);
    }
  return (
    <>
      <p className="eyebrow">Private agent feedback</p>
      <h1>{title}</h1>
      <p className="subtitle">
        {workView
          ? "Follow external work references through every captured attempt."
          : problems
            ? "Deterministic signals with trace evidence."
            : "Follow the evidence. Improve the harness."}
      </p>
      <div className="metrics">
        <div>
          <strong>{runs.length}</strong>
          <span>runs loaded</span>
        </div>
        <div>
          <strong>{problematic}</strong>
          <span>need attention</span>
        </div>
        <div>
          <strong>{skills.size}</strong>
          <span>skills observed</span>
        </div>
        <div>
          <strong>{machines.size}</strong>
          <span>machines in this view</span>
        </div>
      </div>
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        {filterDimensions.map(([dimension, label]) => (
          <label key={dimension}>
            {label}
            <Input
              aria-label={label}
              value={
                filters.find((f) => f.dimension === dimension)?.value ?? ""
              }
              placeholder="Any"
              onChange={(e) =>
                setFilters((previous) => [
                  ...previous.filter((f) => f.dimension !== dimension),
                  ...(e.target.value
                    ? [{ dimension, value: e.target.value }]
                    : []),
                ])
              }
            />
          </label>
        ))}
        <label>
          From date
          <Input
            aria-label="From date"
            type="date"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
          />
        </label>
        <label>
          Through date
          <Input
            aria-label="Through date"
            type="date"
            value={before}
            onChange={(e) => setBefore(e.target.value)}
          />
        </label>
      </form>
      {!!filters.length && (
        <Button
          variant="ghost"
          onClick={() => {
            setFilters([]);
            setAfter("");
            setBefore("");
          }}
        >
          Clear filters
        </Button>
      )}
      {query.status === "LoadingFirstPage" ? (
        <p role="status" className="empty">
          Loading runs…
        </p>
      ) : workView ? (
        <>
          {!workGroups.size && (
            <div className="notice">
              <strong>No linked work in these pages.</strong>
              <p>
                There is no COS work store yet. Enrolled projects capture
                standalone runs; launch context can supply external work
                references.
              </p>
            </div>
          )}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>External work reference</th>
                  <th>Runs loaded</th>
                  <th>Duration</th>
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {[...workGroups].map(([id, group]) => (
                  <tr key={id}>
                    <td>
                      <a
                        href={listLink(
                          "work",
                          group[0]?.work?.id ?? id,
                          group[0]?.projectId,
                        )}
                      >
                        {group[0]?.work?.label ?? group[0]?.work?.id ?? id}
                        <span className="secondary">
                          {
                            projects.find(
                              (p) => p.projectId === group[0]?.projectId,
                            )?.name
                          }
                        </span>
                      </a>
                      {group[0]?.work?.url && (
                        <a
                          className="secondary"
                          href={group[0].work.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open originating work
                        </a>
                      )}
                    </td>
                    <td>{group.length}</td>
                    <td>
                      {Math.round(
                        group.reduce(
                          (total, run) =>
                            total +
                            (run.startTimeKnown
                              ? (run.completedAt ?? run.lastObservedAt) -
                                run.startedAt
                              : 0),
                          0,
                        ) / 60_000,
                      )}
                      m observed
                    </td>
                    <td>
                      {
                        group.filter((r) =>
                          r.findings.some((f) => f.severity !== "info"),
                        ).length
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Captured activity</h2>
          <RunTable runs={runs} projects={projects} />
        </>
      ) : runs.length ? (
        <RunTable runs={runs} projects={projects} />
      ) : (
        <div className="empty">
          <h2>No matching runs in this page</h2>
          <p>
            {query.status === "CanLoadMore"
              ? "Load more indexed candidates to continue searching."
              : "The collector captures persisted Codex turns from configured homes. Check capture health or clear the filters."}
          </p>
        </div>
      )}
      <LoadMore status={query.status} loadMore={query.loadMore} />
    </>
  );
}

function RunDetail({ id, projectId }: { id: string; projectId?: string }) {
  const scope = projectId ? { projectId } : {};
  const backLink = `#runs${projectId ? `?${new URLSearchParams({ project: projectId })}` : ""}`;
  const raw = useQuery(api.observatory.run, { runId: id, ...scope });
  const trace = usePaginatedQuery(
    api.observatory.trace,
    { runId: id, ...scope },
    { initialNumItems: 100 },
  );
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  useEffect(() => {
    if (!evidenceId) return;
    const item = document.getElementById(evidenceId);
    if (item instanceof HTMLDetailsElement) {
      item.open = true;
      item.scrollIntoView({ block: "center" });
      setEvidenceId(null);
    } else if (trace.status === "CanLoadMore") trace.loadMore(100);
    else if (trace.status === "Exhausted") setEvidenceId(null);
  }, [evidenceId, trace.results, trace.status, trace.loadMore]);
  if (raw === undefined) return <p role="status">Loading run…</p>;
  if (raw === null)
    return (
      <div className="empty">
        <h1>Run unavailable</h1>
        <p>This run has not been ingested or is no longer available.</p>
        <a href={backLink}>Back to runs</a>
      </div>
    );
  const run = runSchema.parse(JSON.parse(raw));
  const events = trace.results.map((value) =>
    eventSchema.parse(JSON.parse(value)),
  );
  return (
    <>
      <a href={backLink}>
        <ArrowLeft size={14} aria-hidden="true" /> Back to runs
      </a>
      <h1>{run.title}</h1>
      <p className="subtitle">
        {run.agent} {run.agentVersion} · {run.machineName} ·{" "}
        {!run.startTimeKnown && "Session date · "}
        {date(run.startedAt)} · <Status run={run} />
      </p>
      {run.work && (
        <p className="notice">
          Work{" "}
          <a href={listLink("work", run.work.id, run.projectId)}>
            {run.work.label ?? run.work.id}
          </a>
          {run.work.url && (
            <>
              {" "}
              ·{" "}
              <a href={run.work.url} target="_blank" rel="noreferrer">
                Open source work
              </a>
            </>
          )}
        </p>
      )}
      {run.findings.map((finding, i) => (
        <div
          className={finding.severity === "info" ? "notice" : "notice warning"}
          key={`${finding.rule}:${i}`}
        >
          <strong>{finding.title}</strong>
          {finding.evidence.length > 0 && (
            <div className="tag-list">
              {finding.evidence.slice(0, 3).map((eventId) => (
                <a
                  href={`#${encodeURIComponent(eventId)}`}
                  key={eventId}
                  onClick={(e) => {
                    e.preventDefault();
                    setEvidenceId(eventId);
                  }}
                >
                  Trace evidence
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
      <dl className="metadata">
        <div>
          <dt>Repository / working directory</dt>
          <dd>{run.repo ?? run.cwd}</dd>
        </div>
        <div>
          <dt>Branch / commit</dt>
          <dd>
            {run.branch ?? "Unknown"} · {run.commit?.slice(0, 12) ?? "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Session / attempt</dt>
          <dd>
            {run.sessionId}
            <br />
            {run.attemptId}
          </dd>
        </div>
        <div>
          <dt>Model from thread metadata</dt>
          <dd>{run.model ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Duration / events</dt>
          <dd>
            {duration(run)} · {run.eventCount} events
          </dd>
        </div>
        <div>
          <dt>Work outcome</dt>
          <dd>{run.outcome}</dd>
        </div>
      </dl>
      <h2>Skills, instructions & workflows</h2>
      <div className="tag-list">
        {run.skills.length ? (
          run.skills.map((skill, i) => (
            <a
              key={`${skill.name}:${i}`}
              href={listLink("capability", capabilityKey(skill), run.projectId)}
            >
              <Badge>
                {skill.name} · {skill.hash?.slice(0, 8) ?? "unknown hash"} ·{" "}
                {skill.provenance.replaceAll("_", " ")}
              </Badge>
            </a>
          ))
        ) : (
          <span className="subtitle">No direct use evidence captured.</span>
        )}
      </div>
      <details className="notice">
        <summary>Capture coverage & privacy</summary>
        <p>
          {run.contentCapture
            ? "Content capture enabled with collector redaction."
            : "Metadata only. Prompts, output, code and MCP arguments/results are withheld."}
        </p>
        <ul>
          {run.coverage.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
      <Trace
        events={events}
        upload={{
          capturedCount: run.eventCount,
          pageState:
            trace.status === "Exhausted"
              ? "exhausted"
              : trace.status === "CanLoadMore"
                ? "more"
                : "loading",
        }}
      />
      <LoadMore status={trace.status} loadMore={trace.loadMore} />
    </>
  );
}

function Capabilities({ projectId }: { projectId?: string }) {
  const query = usePaginatedQuery(
    api.observatory.capabilities,
    projectId ? { projectId } : {},
    { initialNumItems: 50 },
  );
  const rows = query.results.map((value) =>
    capabilityGroupSchema.parse(JSON.parse(value)),
  );
  return (
    <>
      <p className="eyebrow">Harness feedback</p>
      <h1>Skills & workflows</h1>
      <p className="subtitle">
        Version groups within the selected project scope. Correlations describe
        observations; they do not establish causation.
      </p>
      <div className="notice">
        Observation-time hashes describe files when the collector read them.
        Use-time hashes come from trusted hooks. Compare groups with the same
        provenance.
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Skill / workflow / instruction</th>
              <th>Hash / provenance</th>
              <th>Runs</th>
              <th>Problematic</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter((row) => row.runs > 0)
              .map((row, i) => (
                <tr key={`${row.name}:${i}`}>
                  <td>
                    <a href={listLink("capability", row.key)}>{row.name}</a>
                    <span className="secondary">{row.kind}</span>
                  </td>
                  <td>
                    {row.hash?.slice(0, 12) ?? "Unknown"}
                    <span className="secondary">
                      {row.provenance.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td>{row.runs}</td>
                  <td className={row.problematic ? "negative" : "positive"}>
                    {row.problematic}
                  </td>
                  <td>{Math.round((100 * row.problematic) / row.runs)}%</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="empty">No skill or workflow use evidence ingested yet.</p>
      )}
      <LoadMore status={query.status} loadMore={query.loadMore} />
    </>
  );
}
function Health() {
  const machines = useQuery(api.observatory.machines, {});
  return (
    <>
      <p className="eyebrow">Collection & privacy</p>
      <h1>Capture health</h1>
      <div className="notice">
        <strong>Automatic persisted capture</strong>
        <p>
          Codex desktop, CLI and T3 Code sessions in configured Codex homes are
          matched against enrolled projects before full turns are collected,
          without resuming them. Each turn is a run. Ephemeral and cloud-only
          sessions require an additional supported source.
        </p>
      </div>
      <h2>Machines with ingested records</h2>
      <table>
        <thead>
          <tr>
            <th>Stable machine identity</th>
            <th>Last ingestion</th>
          </tr>
        </thead>
        <tbody>
          {machines?.map((machine) => (
            <tr key={machine.machineId}>
              <td>{machine.machineId}</td>
              <td>{new Date(machine.lastSeenAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Check a machine collector</h2>
      <pre>agentlog status</pre>
      <p className="subtitle">
        Local status reports queued records, source health and forwarding
        availability. An old ingestion time does not by itself prove a collector
        is down.
      </p>
      <h2>Content policy</h2>
      <p>
        Readable content is enabled by default, with credentials redacted before
        buffering or forwarding. Show content controls display; machine settings
        can separately use metadata-only capture.
      </p>
      <h2>More precise event times</h2>
      <p>
        Optional asynchronous hooks add contemporaneous observations and launch
        context. Review and trust installed definitions with Codex /hooks.
        Automatic persisted capture does not require hooks.
      </p>
    </>
  );
}

export function App() {
  const route = useRoute();
  const connection = useConvexConnectionState();
  const projects = useQuery(api.projects.list, {});
  const projectId =
    new URLSearchParams(route.split("?")[1]).get("project") || undefined;
  let page: React.ReactNode;
  let section = route.slice(1).split("?")[0];
  if (route.startsWith("#run/")) {
    section = "runs";
    let id = "";
    try {
      id = decodeURIComponent(route.slice(5).split("?")[0] ?? "");
    } catch {}
    page = (
      <RunDetail key={`${id}:${projectId}`} id={id} projectId={projectId} />
    );
  } else if (section === "skills")
    page = <Capabilities key={projectId ?? "all"} projectId={projectId} />;
  else if (section === "projects") page = <Projects />;
  else if (section === "health") page = <Health />;
  else
    page = (
      <Runs
        key={route}
        route={route}
        projectId={projectId}
        projects={projects ?? []}
        problems={section === "problems"}
        workView={section === "work"}
      />
    );
  return (
    <ObservatoryLayout
      section={section}
      projectId={projectId}
      projectControl={
        <ProjectSelector
          projects={projects}
          selected={projectId}
          choose={(id) => {
            const params = new URLSearchParams(route.split("?")[1]);
            if (id) params.set("project", id);
            else params.delete("project");
            location.hash = `${route.startsWith("#run/") ? "#runs" : route.split("?")[0]}${params.size ? `?${params}` : ""}`;
          }}
        />
      }
      connectionLabel={connection.isWebSocketConnected ? "Live" : "Connecting…"}
    >
      {page}
    </ObservatoryLayout>
  );
}
export function ObservatoryLayout({
  section = "runs",
  connectionLabel = "Fixture data",
  projectId,
  projectControl,
  children,
}: {
  section?: string;
  connectionLabel?: string;
  projectId?: string;
  projectControl?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <div className="brand-lockup">
            <Brand projectId={projectId} />
            <span className="product-label">Observatory</span>
          </div>
          <nav className="navigation" aria-label="Observatory">
            {[
              ["runs", "Runs"],
              ["work", "Work"],
              ["skills", "Skills & workflows"],
              ["problems", "Problems"],
              ["health", "Capture health"],
              ["projects", "Projects"],
            ].map(([key, label]) => (
              <a
                href={`#${key}${projectId ? `?${new URLSearchParams({ project: projectId })}` : ""}`}
                key={key}
                aria-current={section === key ? "page" : undefined}
              >
                {label}
              </a>
            ))}
            <a
              href="https://otis.tail12a0a0.ts.net:8453/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
            >
              Convex dashboard <ExternalLink size={14} aria-hidden="true" />
            </a>
          </nav>
          <ThemeControl />
        </div>
      </header>
      <main className="workspace" id="main">
        <div className="scope-bar">
          {projectControl}
          <div className="status-strip">
            <ShieldCheck size={15} aria-hidden="true" />
            Private over Tailscale · <Activity size={15} aria-hidden="true" />
            {connectionLabel}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
