import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { z } from "zod";
import { eventSchema } from "@astack/agent-observability";
import {
  deliveryEvidenceSchema,
  deliveryCheckSchema,
  deliveryMediaSchema,
  githubPullRequestReferenceSchema,
  pullRequestObservationSchema,
  type DeliverySnapshot,
} from "@astack/agent-observability/delivery-evidence";
import type { LocalStore } from "./store";
import { approvedRun } from "./projects";
import { refreshRun } from "./context";
import { repositoryIdentity } from "@astack/agent-observability/projects";

const execute = promisify(execFile);
async function github(args: string[]) {
  try {
    const { stdout } = await execute(Bun.which("gh") ?? "gh", args, {
      encoding: "buffer",
      timeout: 20_000,
      killSignal: "SIGKILL",
      maxBuffer: 2 * 1024 * 1024,
      env: { ...process.env, GH_PROMPT_DISABLED: "1" },
    });
    return stdout;
  } catch {
    // CLI errors may contain private repository content or credentials.
    throw new Error("GitHub evidence unavailable; check gh access and retry");
  }
}
const remoteCheck = z.discriminatedUnion("__typename", [
  z.object({
    __typename: z.literal("CheckRun"),
    name: z.string(),
    status: z.enum([
      "QUEUED",
      "IN_PROGRESS",
      "COMPLETED",
      "WAITING",
      "REQUESTED",
      "PENDING",
    ]),
    conclusion: z.string().nullable(),
    detailsUrl: z.string(),
  }),
  z.object({
    __typename: z.literal("StatusContext"),
    context: z.string(),
    state: z.enum(["SUCCESS", "FAILURE", "ERROR", "PENDING", "EXPECTED"]),
    targetUrl: z.string().nullable(),
  }),
]);
const remotePr = z.object({
  number: z.number().int().positive(),
  title: z.string().max(1000),
  url: z.string(),
  state: z.enum(["OPEN", "CLOSED", "MERGED"]),
  isDraft: z.boolean(),
  headRefOid: z.string().regex(/^[a-f0-9]{40}$/),
  body: z.string().max(128 * 1024),
  statusCheckRollup: z.array(remoteCheck).max(50),
});
export async function readPullRequest(url: string, request = github) {
  const reference = githubPullRequestReferenceSchema.parse(url);
  const pr = remotePr.parse(
    JSON.parse(
      (
        await request([
          "pr",
          "view",
          reference.url,
          "--json",
          "number,title,url,state,isDraft,headRefOid,body,statusCheckRollup",
        ])
      ).toString("utf8"),
    ),
  );
  const canonical = githubPullRequestReferenceSchema.parse(pr.url);
  if (
    canonical.repository.toLowerCase() !== reference.repository.toLowerCase() ||
    pr.number !== reference.number
  )
    throw new Error("GitHub returned a different pull request");
  const observation = pullRequestObservationSchema.parse({
    observedAt: Date.now(),
    headRevision: pr.headRefOid,
    state: pr.state.toLowerCase(),
    draft: pr.isDraft,
    checks: pr.statusCheckRollup.map((check) =>
      deliveryCheckSchema.parse(
        check.__typename === "CheckRun"
          ? {
              name: check.name,
              status:
                check.status === "COMPLETED"
                  ? "completed"
                  : check.status === "IN_PROGRESS"
                    ? "in_progress"
                    : "queued",
              conclusion: check.conclusion?.toLowerCase() || null,
              url: check.detailsUrl || null,
            }
          : {
              name: check.context,
              status: ["PENDING", "EXPECTED"].includes(check.state)
                ? "queued"
                : "completed",
              conclusion:
                check.state === "SUCCESS"
                  ? "success"
                  : ["FAILURE", "ERROR"].includes(check.state)
                    ? "failure"
                    : null,
              url: check.targetUrl || null,
            },
      ),
    ),
  });
  return { reference: canonical, pr, observation };
}
function mediaLinks(body: string) {
  const links = [
    ...[
      ...body.matchAll(/!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"[^"]*")?\s*\)/g),
    ].map((match) => ({
      label: match[1] || "PR screenshot",
      url: match[2] ?? "",
    })),
    ...[...body.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map(
      (match) => ({ label: "PR screenshot", url: match[1] ?? "" }),
    ),
  ];
  return [...new Map(links.map((link) => [link.url, link])).values()].slice(
    0,
    4,
  );
}
export async function capturePullRequest(
  url: string,
  request = github,
): Promise<DeliverySnapshot> {
  const { reference, pr, observation } = await readPullRequest(url, request);
  const repository = z
    .object({ nameWithOwner: z.string(), isPrivate: z.boolean() })
    .parse(
      JSON.parse(
        (
          await request([
            "repo",
            "view",
            reference.repository,
            "--json",
            "nameWithOwner,isPrivate",
          ])
        ).toString("utf8"),
      ),
    );
  if (
    repository.nameWithOwner.toLowerCase() !==
    reference.repository.toLowerCase()
  )
    throw new Error("GitHub repository identity mismatch");
  const media: DeliverySnapshot["media"] = [];
  for (const link of mediaLinks(pr.body)) {
    const parsed = z.url().safeParse(link.url);
    if (!parsed.success) continue;
    const target = new URL(parsed.data);
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      ![
        "github.com",
        "raw.githubusercontent.com",
        "user-images.githubusercontent.com",
      ].includes(target.hostname)
    )
      continue;
    const segments = target.pathname.slice(1).split("/");
    const repositoryName = segments.slice(0, 2).join("/");
    const refIndex =
      target.hostname === "raw.githubusercontent.com"
        ? 2
        : segments[2] === "blob" || segments[2] === "raw"
          ? 3
          : -1;
    const mediaRevision = refIndex >= 0 ? (segments[refIndex] ?? "") : "";
    const path = refIndex >= 0 ? segments.slice(refIndex + 1).join("/") : "";
    const fallback = (reason: string) =>
      media.push(
        deliveryMediaSchema.parse({
          kind: "link",
          label: link.label.slice(0, 1000),
          url: target.href,
          reason,
        }),
      );
    if (repository.isPrivate) {
      fallback("Private image — open with GitHub access");
      continue;
    }
    if (
      repositoryName.toLowerCase() !== reference.repository.toLowerCase() ||
      !/^[a-f0-9]{40}$/.test(mediaRevision) ||
      !path ||
      path.split("/").some((part) => [".", "..", ""].includes(part))
    ) {
      fallback("Image link is not a revision-pinned repository asset");
      continue;
    }
    try {
      const response = await request([
        "api",
        `repos/${reference.repository}/contents/${path}?ref=${mediaRevision}`,
      ]);
      const file = z
        .object({
          type: z.literal("file"),
          path: z.string(),
          size: z
            .number()
            .int()
            .nonnegative()
            .max(1024 * 1024),
          encoding: z.literal("base64"),
          content: z.string().max(2 * 1024 * 1024),
        })
        .parse(JSON.parse(response.toString("utf8")));
      const encoded = file.content.replace(/\s/g, "");
      if (
        file.path !== decodeURIComponent(path) ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
      )
        throw new Error("GitHub image identity or encoding mismatch");
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.length !== file.size)
        throw new Error("GitHub image size mismatch");
      const image =
        bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])) ||
        (bytes.subarray(0, 4).toString() === "RIFF" &&
          bytes.subarray(8, 12).toString() === "WEBP");
      if (!image) {
        fallback("Asset is not a supported PNG, JPEG or WebP image");
        continue;
      }
      media.push(
        deliveryMediaSchema.parse({
          kind: "image",
          label: link.label.slice(0, 1000),
          url: `https://raw.githubusercontent.com/${reference.repository}/${mediaRevision}/${path}`,
          path,
          revision: mediaRevision,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        }),
      );
    } catch {
      fallback("Image could not be fetched when evidence was captured");
    }
  }
  return deliveryEvidenceSchema.parse({
    snapshot: {
      schemaVersion: 1,
      capturedAt: observation.observedAt,
      ...reference,
      title: pr.title,
      summary:
        pr.body
          .split(/\n\s*\n/)[0]
          ?.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .replace(/[*#`]/g, "")
          .trim()
          .slice(0, 2000) ?? "",
      visibility: repository.isPrivate ? "private" : "public",
      headRevision: observation.headRevision,
      state: observation.state,
      draft: observation.draft,
      checks: observation.checks,
      media,
    },
    current: null,
  }).snapshot;
}
function readable(store: LocalStore, runId: string, repository: string) {
  const run = approvedRun(store, runId);
  if (!run?.contentCapture)
    throw new Error("PR evidence requires this run's enabled readable capture");
  if (
    !run.repo ||
    repositoryIdentity(run.repo) !==
      repositoryIdentity(`https://github.com/${repository}`)
  )
    throw new Error("PR must belong to the captured run's repository");
  return run;
}
export async function recordPrDelivery(
  store: LocalStore,
  runId: string,
  url: string,
  capture = capturePullRequest,
) {
  const reference = githubPullRequestReferenceSchema.parse(url);
  readable(store, runId, reference.repository);
  const snapshot = await capture(url);
  const run = readable(store, runId, reference.repository);
  const id = `${runId}:delivery:${snapshot.number}:${snapshot.headRevision}`;
  const previous = store.getRecord("event:" + id);
  const frozen =
    previous?.kind === "event" && previous.value.delivery
      ? previous.value.delivery.snapshot
      : snapshot;
  const event = eventSchema.parse({
    id,
    runId,
    sequence:
      previous?.kind === "event"
        ? previous.value.sequence
        : Number(store.getMeta("revision")) + 1,
    kind: "delivery_recorded",
    timestamp: frozen.capturedAt,
    observedAt: frozen.capturedAt,
    timing: "agent",
    title: "PR delivery evidence: " + frozen.title,
    delivery: {
      snapshot: frozen,
      current: {
        observedAt: snapshot.capturedAt,
        headRevision: snapshot.headRevision,
        state: snapshot.state,
        draft: snapshot.draft,
        checks: snapshot.checks,
      },
    },
    data: {},
  });
  store.put({ kind: "event", value: event });
  refreshRun(store, run);
  return {
    runId,
    eventId: id,
    url: frozen.url,
    revision: frozen.headRevision,
    images: frozen.media.filter((item) => item.kind === "image").length,
  };
}
export async function refreshPrDelivery(
  store: LocalStore,
  eventId: string,
  read = readPullRequest,
) {
  const record = store.getRecord("event:" + eventId);
  if (record?.kind !== "event" || !record.value.delivery)
    throw new Error("Delivery evidence unavailable");
  readable(
    store,
    record.value.runId,
    record.value.delivery.snapshot.repository,
  );
  const { observation } = await read(record.value.delivery.snapshot.url);
  readable(
    store,
    record.value.runId,
    record.value.delivery.snapshot.repository,
  );
  store.put({
    kind: "event",
    value: {
      ...record.value,
      delivery: {
        snapshot: record.value.delivery.snapshot,
        current: observation,
      },
    },
  });
  return {
    eventId,
    state: observation.state,
    headRevision: observation.headRevision,
  };
}
