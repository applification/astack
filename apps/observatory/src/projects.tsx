import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useForm } from "@tanstack/react-form";
import { ConvexError } from "convex/values";
import { api } from "@astack/observatory-backend/api";
import {
  projectSchema,
  type Project,
} from "@astack/agent-observability/projects";
import { Button, Input } from "@astack/ui";

type Machine = { machineId: string; name: string };
export function ProjectSelector({
  projects,
  selected,
  choose,
}: {
  projects: readonly Project[] | undefined;
  selected?: string;
  choose: (id: string) => void;
}) {
  return (
    <label className="project-selector">
      Project
      <select
        aria-label="Selected project"
        value={selected ?? ""}
        disabled={projects === undefined}
        onChange={(e) => choose(e.target.value)}
      >
        <option value="">All enrolled projects</option>
        {selected && !projects?.some((p) => p.projectId === selected) && (
          <option value={selected}>Project unavailable</option>
        )}
        {projects?.map((p) => (
          <option key={p.projectId} value={p.projectId}>
            {p.name}
            {p.enabled ? "" : " · capture paused"}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ProjectForm({
  project,
  machines,
  save,
  cancel,
}: {
  project?: Project;
  machines: readonly Machine[];
  save: (p: Project) => Promise<void>;
  cancel?: () => void;
}) {
  const [projectId] = useState(() => project?.projectId ?? crypto.randomUUID());
  const [error, setError] = useState("");
  const form = useForm({
    defaultValues: {
      name: project?.name ?? "",
      repositories: project?.repositories.join("\n") ?? "",
      folders: project?.folders ?? [],
    },
    onSubmit: async ({ value }) => {
      setError("");
      const parsed = projectSchema.safeParse({
        projectId,
        name: value.name,
        enabled: project?.enabled ?? true,
        repositories: value.repositories
          .split("\n")
          .map((v) => v.trim())
          .filter(Boolean),
        folders: value.folders,
      });
      if (!parsed.success) {
        setError(
          parsed.error.issues[0]?.message ?? "Check the project details.",
        );
        return;
      }
      try {
        await save(parsed.data);
      } catch (error) {
        setError(
          error instanceof ConvexError && typeof error.data === "string"
            ? error.data
            : "Project could not be saved. Check the connection and try again.",
        );
      }
    },
  });
  return (
    <form
      className="project-form"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <h2>{project ? `Edit ${project.name}` : "Add a project"}</h2>
      <form.Field name="name">
        {(field) => (
          <label>
            Project name
            <Input
              aria-label="Project name"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </label>
        )}
      </form.Field>
      <form.Field name="repositories">
        {(field) => (
          <label>
            Repository URLs · one per line
            <textarea
              aria-label="Repository URLs"
              rows={3}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="https://github.com/your-team/your-project"
            />
          </label>
        )}
      </form.Field>
      <p className="subtitle">
        Repository identity includes its clones and Git worktrees on any
        registered computer. For a project without a remote repository, add its
        folder below.
      </p>
      <form.Field name="folders" mode="array">
        {(field) => (
          <div>
            {field.state.value.map((_, i) => (
              <div className="filters" key={i}>
                <form.Field name={`folders[${i}].machineId`}>
                  {(f) => (
                    <label>
                      Computer
                      <select
                        aria-label={`Computer ${i + 1}`}
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                      >
                        <option value="">Choose a computer</option>
                        {f.state.value &&
                          !machines.some(
                            (m) => m.machineId === f.state.value,
                          ) && (
                            <option value={f.state.value}>
                              {f.state.value}
                            </option>
                          )}
                        {machines.map((m) => (
                          <option key={m.machineId} value={m.machineId}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </form.Field>
                <form.Field name={`folders[${i}].path`}>
                  {(f) => (
                    <label>
                      Project folder
                      <Input
                        aria-label={`Project folder ${i + 1}`}
                        value={f.state.value}
                        onChange={(e) => f.handleChange(e.target.value)}
                        placeholder="/Users/you/code/project"
                      />
                    </label>
                  )}
                </form.Field>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => field.removeValue(i)}
                >
                  Remove folder {i + 1}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                field.pushValue({
                  machineId: machines[0]?.machineId ?? "",
                  path: "",
                })
              }
            >
              Add project folder
            </Button>
          </div>
        )}
      </form.Field>
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
      <div className="toolbar">
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(pending) => (
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save project"}
            </Button>
          )}
        </form.Subscribe>
        {cancel && (
          <Button type="button" variant="ghost" onClick={cancel}>
            Cancel edit
          </Button>
        )}
      </div>
    </form>
  );
}
export function ProjectsView({
  projects,
  machines,
  save,
}: {
  projects: readonly Project[] | undefined;
  machines: readonly Machine[];
  save: (p: Project) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(0);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selected = projects?.find((p) => p.projectId === editing);
  async function toggle(project: Project) {
    setPending(project.projectId);
    setError("");
    try {
      await save({ ...project, enabled: !project.enabled });
    } catch {
      setError("Capture setting could not be saved. Try again.");
    } finally {
      setPending(null);
    }
  }
  return (
    <>
      <p className="eyebrow">Capture scope</p>
      <h1>Projects</h1>
      <p className="subtitle">
        Capture every run in enrolled projects. Unmatched conversations are
        skipped.
      </p>
      <div className="notice">
        Pausing capture preserves history and reports. Computers apply changes
        when they next connect; uploads are checked immediately. Existing
        unmatched history stays stored outside project reports.
      </div>
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
      {projects === undefined ? (
        <p role="status">Loading projects…</p>
      ) : projects.length === 0 ? (
        <p className="empty">
          No projects enrolled. Add your first project to start capture.
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Capture</th>
                <th>Repositories / folders</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.projectId}>
                  <td>
                    <a
                      href={`#runs?${new URLSearchParams({ project: p.projectId })}`}
                    >
                      {p.name}
                    </a>
                  </td>
                  <td>{p.enabled ? "Enabled" : "Paused"}</td>
                  <td>
                    {p.repositories.map((repo) => (
                      <span className="secondary" key={repo}>
                        {repo}
                      </span>
                    ))}
                    {p.folders.map((f) => (
                      <span
                        className="secondary"
                        key={`${f.machineId}:${f.path}`}
                      >
                        {machines.find((m) => m.machineId === f.machineId)
                          ?.name ?? "Computer"}{" "}
                        · {f.path}
                      </span>
                    ))}
                  </td>
                  <td>
                    <div className="tag-list">
                      <Button
                        variant="outline"
                        disabled={pending !== null}
                        onClick={() => void toggle(p)}
                      >
                        {p.enabled ? `Pause ${p.name}` : `Resume ${p.name}`}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setEditing(p.projectId)}
                      >
                        Edit {p.name}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {projects === undefined ? null : editing && !selected ? (
        <p role="status">
          Project unavailable.{" "}
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Add a project
          </Button>
        </p>
      ) : (
        <ProjectForm
          key={editing ?? `new:${draft}`}
          project={selected}
          machines={machines}
          cancel={editing ? () => setEditing(null) : undefined}
          save={async (p) => {
            await save(p);
            setEditing(null);
            setDraft((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
export function Projects() {
  const projects = useQuery(api.projects.list, {});
  const machines = useQuery(api.projects.machines, {});
  const save = useMutation(api.projects.save);
  return (
    <ProjectsView
      projects={projects}
      machines={machines ?? []}
      save={async (project) => {
        await save({ project });
      }}
    />
  );
}
