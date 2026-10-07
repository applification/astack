import { z } from "zod";

const revision = z.string().regex(/^[a-f0-9]{40}$/);
const text = z.string().trim().min(1).max(1000);
const time = z.number().finite().nonnegative();
const webUrl = z
  .url()
  .max(4096)
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  }, "Expected a credential-free HTTPS URL");
export const githubPullRequestReferenceSchema = webUrl.transform(
  (value, ctx) => {
    const url = new URL(value);
    const match = /^\/([\w.-]+)\/([\w.-]+)\/pull\/([1-9]\d*)\/?$/.exec(
      url.pathname,
    );
    if (
      url.hostname !== "github.com" ||
      url.search ||
      url.hash ||
      !match ||
      !Number.isSafeInteger(Number(match[3]))
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Expected a GitHub pull request URL",
      });
      return z.NEVER;
    }
    const repository = `${match[1]}/${match[2]}`;
    const number = Number(match[3]);
    return {
      repository,
      number,
      url: `https://github.com/${repository}/pull/${number}`,
    };
  },
);
export const deliveryCheckSchema = z
  .object({
    name: text,
    status: z.enum(["queued", "in_progress", "completed"]),
    conclusion: z
      .enum([
        "success",
        "failure",
        "neutral",
        "cancelled",
        "timed_out",
        "action_required",
        "stale",
        "skipped",
        "startup_failure",
      ])
      .nullable(),
    url: webUrl.nullable(),
  })
  .strict();
export const deliveryMediaSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("image"),
      label: text,
      url: webUrl,
      path: text,
      revision,
      sha256: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .strict(),
  z
    .object({ kind: z.literal("link"), label: text, url: webUrl, reason: text })
    .strict(),
]);
export const pullRequestObservationSchema = z
  .object({
    observedAt: time,
    headRevision: revision,
    state: z.enum(["open", "closed", "merged"]),
    draft: z.boolean(),
    checks: z.array(deliveryCheckSchema).max(50),
  })
  .strict();
export const deliverySnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    capturedAt: time,
    repository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    number: z.number().int().positive(),
    url: webUrl,
    title: text,
    summary: z.string().max(2000),
    visibility: z.enum(["public", "private"]),
    headRevision: revision,
    state: z.enum(["open", "closed", "merged"]),
    draft: z.boolean(),
    checks: z.array(deliveryCheckSchema).max(50),
    media: z.array(deliveryMediaSchema).max(4),
  })
  .strict()
  .superRefine((value, ctx) => {
    const reference = githubPullRequestReferenceSchema.safeParse(value.url);
    if (
      !reference.success ||
      reference.data.repository !== value.repository ||
      reference.data.number !== value.number
    )
      ctx.addIssue({
        code: "custom",
        message: "PR identity does not match its URL",
      });
    for (const media of value.media) {
      if (media.kind !== "image") continue;
      const expected = `https://raw.githubusercontent.com/${value.repository}/${media.revision}/${media.path}`;
      if (
        value.visibility !== "public" ||
        media.url !== expected ||
        media.path.split("/").some((part) => part === ".." || part === ".")
      )
        ctx.addIssue({
          code: "custom",
          message:
            "Inline images require a public, revision-pinned repository asset",
        });
    }
  });
export const deliveryEvidenceSchema = z
  .object({
    snapshot: deliverySnapshotSchema,
    current: pullRequestObservationSchema.nullable(),
  })
  .strict();
export type DeliveryEvidence = z.infer<typeof deliveryEvidenceSchema>;
export type DeliverySnapshot = z.infer<typeof deliverySnapshotSchema>;

export function checkSummary(checks: z.infer<typeof deliveryCheckSchema>[]) {
  return {
    passed: checks.filter(
      (check) => check.status === "completed" && check.conclusion === "success",
    ).length,
    failed: checks.filter(
      (check) =>
        check.status === "completed" &&
        [
          "failure",
          "cancelled",
          "timed_out",
          "action_required",
          "stale",
          "startup_failure",
        ].includes(check.conclusion ?? ""),
    ).length,
    pending: checks.filter(
      (check) => check.status !== "completed" || check.conclusion === null,
    ).length,
    skipped: checks.filter(
      (check) =>
        check.conclusion === "skipped" || check.conclusion === "neutral",
    ).length,
  };
}
