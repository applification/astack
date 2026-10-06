import { execFileSync } from "node:child_process";
import { z } from "zod";
const resultSchema = z.object({
  continueCursor: z.string(),
  isDone: z.boolean(),
  count: z.number(),
});
let cursor: string | null = null;
let count = 0;
do {
  const output = execFileSync(
    "bunx",
    [
      "convex",
      "run",
      "ingestion:rebuildFacets",
      JSON.stringify({ paginationOpts: { numItems: 3, cursor } }),
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const result = resultSchema.parse(JSON.parse(output));
  count += result.count;
  cursor = result.isDone ? null : result.continueCursor;
} while (cursor);
process.stdout.write(`Rebuilt indexed projections for ${count} runs.\n`);
