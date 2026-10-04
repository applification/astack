import type { Auth, UserIdentity } from "convex/server";
import { ConvexError } from "convex/values";

export function isLoopbackUrl(value: string | undefined): boolean {
  if (value === undefined) return false;
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}

export function localProofEnabled(): boolean {
  if (process.env.ASTACK_PROOF_MODE !== "local") return false;
  if (!isLoopbackUrl(process.env.CONVEX_SITE_URL)) {
    throw new Error("Local proof authentication requires a loopback Convex deployment.");
  }
  return true;
}

export async function requireUser(auth: Auth): Promise<UserIdentity> {
  const identity = await auth.getUserIdentity();
  if (
    identity === null ||
    identity.subject.length === 0 ||
    (!localProofEnabled() && !identity.subject.startsWith("user_"))
  ) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Sign in to manage your work items.",
    });
  }
  return identity;
}

export function denyUnavailableItem(): never {
  throw new ConvexError({
    code: "FORBIDDEN",
    message: "This work item is unavailable.",
  });
}
