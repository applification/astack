import { chmod, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { z } from "zod";
import {
  configSchema,
  loadConfig,
  t3SourceSchema,
  type T3Source,
} from "./config";
import {
  T3Reader,
  readT3Credential,
  readT3Response,
  t3DescriptorSchema,
} from "./adapters/t3-rpc";
import { LocalStore } from "./store";

/** Enroll a passive reader using an owner-issued pairing grant or existing token. */
export async function configureT3(
  directory: string,
  options: {
    url: string;
    label: string;
    credential: { kind: "pairing" | "access"; path: string };
  },
): Promise<T3Source> {
  // Validate the destination before presenting any credential.
  const url = new URL(options.url).href;
  t3SourceSchema.shape.url.parse(url);
  const descriptor = t3DescriptorSchema.parse(
    await readT3Response(
      await fetch(new URL("/.well-known/t3/environment", url), {
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      }),
    ),
  );
  const config = await loadConfig(directory);
  let tokenFile = resolve(options.credential.path);
  if (options.credential.kind === "pairing") {
    const pairing = await readT3Credential(tokenFile);
    const response = await readT3Response(
      await fetch(new URL("/oauth/token", url), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
          subject_token: pairing,
          subject_token_type:
            "urn:t3:params:oauth:token-type:environment-bootstrap",
          requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
          scope: "orchestration:read",
          client_label: "Astack Observatory",
        }),
      }),
    );
    const result = z
      .object({
        access_token: z.string().min(1),
        token_type: z.literal("Bearer"),
        scope: z.literal("orchestration:read"),
      })
      .parse(response);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    tokenFile = join(directory, `t3-${descriptor.environmentId}.token`);
    await writeFile(tokenFile, result.access_token + "\n", { mode: 0o600 });
    await chmod(tokenFile, 0o600);
  }
  const source = t3SourceSchema.parse({
    url,
    label: options.label,
    tokenFile,
    environmentId: descriptor.environmentId,
  });
  const reader = new T3Reader(source);
  try {
    await reader.initialize();
    await reader.shell();
    await reader.archived();
  } finally {
    await reader.close();
  }
  const next = configSchema.parse({
    ...config,
    t3Sources: [
      ...config.t3Sources.filter(
        (s) => s.environmentId !== source.environmentId,
      ),
      source,
    ],
  });
  await writeFile(
    join(directory, "config.json"),
    JSON.stringify(next, null, 2) + "\n",
    { mode: 0o600 },
  );
  await chmod(join(directory, "config.json"), 0o600);
  const store = new LocalStore(directory);
  try {
    store.resetT3CaptureCheckpoints(source.environmentId);
  } finally {
    store.close();
  }
  return source;
}
