import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  evaluationRun,
  fixtureMachine,
  fixtureProject,
} from "@astack/agent-observability/evaluation-fixtures";
import { deliveryFixture } from "@astack/agent-observability/delivery-fixtures";
import {
  capturePullRequest,
  recordPrDelivery,
  refreshPrDelivery,
} from "./pr-evidence";
import { LocalStore } from "./store";
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
test("GitHub capture authenticates bounded requests and degrades private/mutable/missing media to links", async () => {
  const fixture = deliveryFixture().snapshot;
  let privateRepo = false;
  let body = `![Saved edit](${fixture.media[0]?.url})\n![Mutable](https://github.com/applification/astack/blob/main/image.png)\n![Untrusted](https://example.com/private.png)`;
  const commands: string[][] = [];
  const request = async (args: string[]) => {
    commands.push(args);
    if (args[0] === "pr")
      return Buffer.from(
        JSON.stringify({
          number: 26,
          title: fixture.title,
          url: fixture.url,
          state: "OPEN",
          isDraft: false,
          headRefOid: fixture.headRevision,
          body,
          statusCheckRollup: [
            {
              __typename: "StatusContext",
              context: "Build",
              state: "PENDING",
              targetUrl: null,
            },
          ],
        }),
      );
    if (args[0] === "repo")
      return Buffer.from(
        JSON.stringify({
          nameWithOwner: fixture.repository,
          isPrivate: privateRepo,
        }),
      );
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    return Buffer.from(
      JSON.stringify({
        type: "file",
        path: fixture.media[0]?.kind === "image" ? fixture.media[0].path : "",
        size: bytes.length,
        encoding: "base64",
        content: bytes.toString("base64"),
      }),
    );
  };
  const result = await capturePullRequest(
    "https://github.com/Applification/Astack/pull/26",
    request,
  );
  expect(result.media.map((media) => media.kind)).toEqual(["image", "link"]);
  expect(result.checks[0]).toMatchObject({
    status: "queued",
    conclusion: null,
  });
  expect(commands.at(-1)?.[1]).toContain(
    "?ref=" +
      (fixture.media[0]?.kind === "image" ? fixture.media[0].revision : ""),
  );
  privateRepo = true;
  commands.length = 0;
  expect(
    (await capturePullRequest(fixture.url, request)).media.map(
      (media) => media.kind,
    ),
  ).toEqual(["link", "link"]);
  expect(commands.some((args) => args[0] === "api")).toBe(false);
  privateRepo = false;
  const unavailable = await capturePullRequest(fixture.url, async (args) => {
    if (args[0] === "api") throw new Error("fixture unavailable");
    return request(args);
  });
  expect(unavailable.media[0]).toMatchObject({
    kind: "link",
    reason: "Image could not be fetched when evidence was captured",
  });
  body = "No media supplied";
  expect((await capturePullRequest(fixture.url, request)).media).toEqual([]);
});
test("delivery capture/refresh survives SQLite replay, freezes evidence and requires readable same-repository capture", async () => {
  const dir = await mkdtemp(join(tmpdir(), "agentlog-pr-"));
  dirs.push(dir);
  let store = new LocalStore(dir);
  store.setMeta(
    "projectPolicy",
    JSON.stringify([
      {
        projectId: fixtureProject,
        name: "Fixture",
        enabled: true,
        repositories: [],
        folders: [{ machineId: fixtureMachine, path: "/fixture" }],
      },
    ]),
  );
  const run = {
    ...evaluationRun(),
    repo: "https://github.com/applification/astack",
  };
  store.put({ kind: "run", value: run });
  const evidence = deliveryFixture();
  const result = await recordPrDelivery(
    store,
    run.id,
    evidence.snapshot.url,
    async () => evidence.snapshot,
  );
  store.close();
  store = new LocalStore(dir);
  try {
    await refreshPrDelivery(store, result.eventId, async () => ({
      reference: {
        repository: evidence.snapshot.repository,
        number: 26,
        url: evidence.snapshot.url,
      },
      pr: {
        number: 26,
        title: evidence.snapshot.title,
        url: evidence.snapshot.url,
        state: "OPEN",
        isDraft: false,
        headRefOid: evidence.current?.headRevision ?? "c".repeat(40),
        body: "",
        statusCheckRollup: [],
      },
      observation:
        evidence.current ??
        (() => {
          throw new Error("Missing fixture");
        })(),
    }));
    const saved = store.getRecord("event:" + result.eventId);
    expect(saved?.kind === "event" && saved.value.delivery).toEqual(evidence);
    if (saved?.kind !== "event" || !saved.value.delivery)
      throw new Error("Missing record");
    expect(() =>
      store.put({
        kind: "event",
        value: {
          ...saved.value,
          delivery: {
            ...evidence,
            snapshot: { ...evidence.snapshot, title: "Rewritten" },
          },
        },
      }),
    ).toThrow("immutable");
    await expect(
      recordPrDelivery(
        store,
        run.id,
        "https://github.com/another/project/pull/26",
        async () => evidence.snapshot,
      ),
    ).rejects.toThrow("repository");
    store.put({ kind: "run", value: { ...run, contentCapture: false } });
    await expect(
      recordPrDelivery(
        store,
        run.id,
        evidence.snapshot.url,
        async () => evidence.snapshot,
      ),
    ).rejects.toThrow("readable");
  } finally {
    store.close();
  }
});
