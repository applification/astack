"use node";
import { v } from "convex/values";
import { importPKCS8, SignJWT } from "jose";
import { internalAction } from "./_generated/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const machine = internalAction({
  args: { credential: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (_ctx, args) => {
    const hash = createHash("sha256").update(args.credential).digest("hex");
    let raw: unknown;
    try {
      raw = JSON.parse(process.env.AGENTLOG_MACHINES ?? "[]");
    } catch {
      return null;
    }
    const credentials = z
      .array(
        z.object({
          machineId: z.string().uuid(),
          tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .max(100)
      .safeParse(raw);
    if (!credentials.success) return null;
    return (
      credentials.data.find((value) =>
        timingSafeEqual(
          Buffer.from(value.tokenHash, "hex"),
          Buffer.from(hash, "hex"),
        ),
      )?.machineId ?? null
    );
  },
});
export const viewer = internalAction({
  args: { credential: v.string() },
  returns: v.boolean(),
  handler: async (_ctx, args) => {
    const expected = process.env.OBSERVATORY_VIEWER_TOKEN_HASH;
    if (!expected || !/^[a-f0-9]{64}$/.test(expected)) return false;
    const actual = createHash("sha256").update(args.credential).digest();
    return timingSafeEqual(Buffer.from(expected, "hex"), actual);
  },
});

export const issue = internalAction({
  args: {},
  returns: v.string(),
  handler: async () => {
    const subject = z.string().uuid().parse(process.env.OBSERVATORY_OWNER_ID);
    const pem = process.env.OBSERVATORY_SIGNING_KEY;
    if (!pem) throw new Error("Authentication unavailable");
    const key = await importPKCS8(pem, "RS256");
    return new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "observatory-v1", typ: "JWT" })
      .setSubject(subject)
      .setIssuer(process.env.OBSERVATORY_AUTH_ISSUER ?? "")
      .setAudience("astack-observatory")
      .setIssuedAt()
      .setExpirationTime("15m")
      .sign(key);
  },
});
