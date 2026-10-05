import { expect, test } from "bun:test";
import { redact, redactText } from "./redaction";
test("redacts nested credentials, environment assignments, known secrets, URLs and bearer tokens", () => {
  const safe = redact(
    {
      env: { PATH: "private" },
      apiKey: "anything",
      payload:
        'PASSWORD="p@ss word" HOME=/private/path Bearer abcdefghijklmnop https://user:pass@example.com/path?token=hidden',
      note: "known-secret appears again known-secret",
    },
    ["known-secret"],
  );
  const serialized = JSON.stringify(safe);
  for (const secret of [
    "p@ss word",
    "/private/path",
    "abcdefghijklmnop",
    "user:pass",
    "hidden",
    "known-secret",
    "anything",
  ])
    expect(serialized).not.toContain(secret);
});
test("redacts private keys and credential flags without dropping useful failure metadata", () => {
  expect(redactText('curl --api-key "abcdefghi"')).not.toContain("abcdefghi");
  expect(
    redactText(
      "-----BEGIN PRIVATE KEY-----\nSECRET MATERIAL\n-----END PRIVATE KEY-----",
    ),
  ).toBe("[REDACTED]");
  expect(redact({ exitCode: 1, status: "failed", durationMs: 42 })).toEqual({
    exitCode: 1,
    status: "failed",
    durationMs: 42,
  });
});
