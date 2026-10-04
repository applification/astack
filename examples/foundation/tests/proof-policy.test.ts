import { describe, expect, test } from "bun:test";
import { localEnvironment, redact } from "../scripts/runtime";
import { selfContainedResource, items } from "../scripts/readiness";
import { TrialEvents } from "../scripts/trials";

describe("proof boundary policy", () => {
  test("local subprocesses do not inherit deployment or authentication secrets", () => {
    const env = localEnvironment({
      PATH: "/bin",
      HOME: "/tmp/user",
      CONVEX_DEPLOY_KEY: "private",
      CONVEX_DEPLOYMENT: "prod:shared",
      WORKOS_API_KEY: "private",
      ASTACK_PROOF_TOKEN: "private",
      OPENAI_API_KEY: "private",
    });
    expect(env).toEqual({ PATH: "/bin", HOME: "/tmp/user" });
  });
  test("retained logs redact signed tokens and bearer headers", () => {
    expect(
      redact(
        "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvd25lci1hIn0.abcdefghijklmnop Bearer token",
      ),
    ).toBe("[REDACTED JWT] Bearer [REDACTED]");
  });
  test("external script or stylesheet resources cannot pass packaging proof", () => {
    expect(() => {
      selfContainedResource('<html><script src="/app.js"></script></html>');
    }).toThrow();
    expect(() => {
      selfContainedResource(
        '<html><link rel="stylesheet" href="/app.css"></html>',
      );
    }).toThrow();
    expect(() => {
      selfContainedResource(
        "<html><style>body{color:black}</style><script>console.log(1)</script></html>",
      );
    }).not.toThrow();
  });
  test("a malformed DTO cannot become persisted-state evidence", () => {
    expect(() =>
      items([{ id: "a", title: "one", status: "unknown" }]),
    ).toThrow();
  });
  test("trial event accounting keeps usage and excludes conversation text from action caps", () => {
    const events = new TrialEvents();
    for (const event of [
      { type: "thread.started" },
      { type: "item.started", item: { id: "text", type: "agent_message" } },
      { type: "item.started", item: { id: "call", type: "command_execution" } },
      { type: "item.started", item: { id: "call", type: "command_execution" } },
      { type: "turn.completed", usage: { input_tokens: 20, output_tokens: 5 } },
    ])
      events.accept(event);
    expect(events.actionIds.size).toBe(1);
    expect(events.completed).toBe(true);
    expect(events.usage).toEqual([{ input_tokens: 20, output_tokens: 5 }]);
  });
});
