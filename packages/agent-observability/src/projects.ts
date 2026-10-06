import { z } from "zod";

// Stable repository identity across SSH/HTTPS clones; never retain credentials.
export function repositoryIdentity(value: string): string | null {
  const input = value.trim();
  try {
    const scp =
      input.includes("://") || /^[^/]+:\d+\//.test(input)
        ? null
        : input.match(/^(?:[^/@\s]+@)?([^/:\s]+):([^\s]+)$/);
    const url = new URL(
      scp
        ? `ssh://${scp[1]}/${scp[2]}`
        : input.includes("://")
          ? input
          : `https://${input}`,
    );
    if (!["https:", "http:", "ssh:", "git:"].includes(url.protocol))
      return null;
    const host = url.hostname.toLowerCase() + (url.port ? `:${url.port}` : "");
    let path = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    if (!host || !path || /[\s?#]|(?:^|\/)\.\.(?:\/|$)/.test(path)) return null;
    if (url.hostname === "github.com") path = path.toLowerCase();
    return `${host}/${path}`;
  } catch {
    return null;
  }
}
export function folderIdentity(value: string): string | null {
  let path = value.trim().replaceAll("\\", "/").replace(/\/+$/g, "");
  if (
    !path ||
    !(path.startsWith("/") || /^[a-z]:\//i.test(path)) ||
    /(?:^|\/)\.\.?($|\/)/.test(path)
  )
    return null;
  if (/^[a-z]:\//i.test(path)) path = path.toLowerCase();
  return path.replace(/\/{2,}/g, "/");
}
export const projectSchema = z
  .object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(1).max(128),
    enabled: z.boolean(),
    repositories: z
      .array(
        z
          .string()
          .max(4096)
          .refine(
            (v) => repositoryIdentity(v) !== null,
            "Enter a repository URL",
          )
          .transform((v) => repositoryIdentity(v) ?? ""),
      )
      .max(20),
    folders: z
      .array(
        z
          .object({
            machineId: z.string().uuid(),
            path: z
              .string()
              .max(4096)
              .refine(
                (v) => folderIdentity(v) !== null,
                "Enter an absolute project folder",
              )
              .transform((v) => folderIdentity(v) ?? ""),
          })
          .strict(),
      )
      .max(50),
  })
  .strict()
  .refine(
    (p) => p.repositories.length + p.folders.length > 0,
    "Add a repository or a project folder",
  )
  .refine(
    (p) => new TextEncoder().encode(JSON.stringify(p)).byteLength <= 16 * 1024,
    "Project configuration exceeds the 16 KiB limit",
  );
export const projectPolicySchema = z.array(projectSchema).max(100);
export type Project = z.infer<typeof projectSchema>;
export type ProjectContext = { machineId: string; cwd: string; repo?: string };

export function resolveProject(
  projects: readonly Project[],
  context: ProjectContext,
): Project | null {
  const repo = context.repo ? repositoryIdentity(context.repo) : null;
  const cwd = folderIdentity(context.cwd);
  const matches = projects.filter(
    (p) =>
      (repo !== null && p.repositories.includes(repo)) ||
      (cwd !== null &&
        p.folders.some(
          (f) =>
            f.machineId === context.machineId &&
            (cwd === f.path || cwd.startsWith(`${f.path}/`)),
        )),
  );
  // Include paused projects in candidate detection: conflicting evidence must fail closed.
  return matches.length === 1 && matches[0]?.enabled ? matches[0] : null;
}
