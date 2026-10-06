import type { QueryCtx } from "./_generated/server";
export async function requireOwner(ctx: Pick<QueryCtx, "auth">) {
  const identity = await ctx.auth.getUserIdentity();
  const owner = process.env.OBSERVATORY_OWNER_ID;
  if (!identity || !owner || identity.subject !== owner)
    throw new Error("Unauthorized");
  return identity;
}
