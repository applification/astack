import type {
  NetworkEdge,
  NetworkItem,
} from "@astack/agent-observability/work-network";

export type NetworkSelection =
  { kind: "node"; id: string } | { kind: "edge"; id: string };

export const networkItemLabels: Record<NetworkItem["kind"], string> = {
  conversation: "Conversation",
  turn: "Captured turn",
  contribution: "Delegated task",
  record: "Agent declaration",
  result: "Result observation",
  skill: "Skill reference",
  activity: "Captured activity",
  evidence: "Supporting evidence",
};

export const relationshipDescriptions: Record<NetworkEdge["kind"], string> = {
  delegation:
    "The parent capture records a distinct delegated task. Task completion, result receipt and parent use remain separate facts.",
  capture:
    "The host task points to this separate child conversation. Its turns and evidence belong to the child.",
  contains:
    "This turn belongs to the recorded conversation identity. The connection does not prescribe an execution order.",
  records:
    "The source conversation or turn contains this captured event or declaration. Nearby calls and results do not establish further dependencies.",
  observed_read:
    "Capture observed a reference to this skill. A read alone does not establish how the skill was applied.",
  declared_skill:
    "The agent named this skill in its declaration. This records the declaration, not a proven skill invocation.",
  references:
    "The declaration explicitly points to this trace event as supporting evidence. Missing previews remain unavailable.",
  result_reference:
    "The task matches the identified child result referenced by the parent. The source identities establish this link.",
  observation:
    "This host result observation belongs to the identified task. Presence alone does not establish delivery or parent use.",
  delivered:
    "The host explicitly classified this result as delivered to its parent. Parent-declared use remains a separate fact.",
  acknowledged:
    "The host recorded an explicit terminal-result read. This is independent of automatic delivery and parent use.",
  declared_use:
    "The parent explicitly declared using the identified child result, with captured supporting evidence.",
  unresolved_use:
    "The parent declared using a child result, but the referenced supporting capture is unavailable.",
};
