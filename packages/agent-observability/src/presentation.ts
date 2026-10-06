import { repositoryIdentity } from "./projects";

export function providerName(agent: string) {
  switch (agent.toLowerCase()) {
    case "codex":
      return "Codex";
    case "claude":
      return "Claude";
    default:
      return agent;
  }
}

export function repositoryPresentation(value: string) {
  const input = value.trim();
  const mayBeRemote =
    /^(?:https?|ssh|git):\/\//i.test(input) ||
    /^(?:[^/@\s]+@)?[^/:\s]+\.[^/:\s]+[:/]/.test(input);
  const identity = mayBeRemote ? repositoryIdentity(input) : null;
  if (identity) {
    const url = new URL(`https://${identity}`);
    return {
      kind: "remote" as const,
      label: `${url.pathname.split("/").at(-1)}.git`,
      identity,
      href: url.href,
      github: url.hostname === "github.com",
    };
  }
  return {
    kind: "local" as const,
    label:
      value.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? value,
  };
}
