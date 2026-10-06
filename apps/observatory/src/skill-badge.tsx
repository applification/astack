import {
  BookOpen,
  Bug,
  CloudUpload,
  CodeXml,
  Database,
  FlaskConical,
  Gauge,
  Hammer,
  KeyRound,
  Layers,
  Monitor,
  Network,
  Paintbrush,
  Search,
  ShieldCheck,
  Terminal,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@astack/ui";
import type { ComponentProps } from "react";

const identities: Record<string, { label: string; icon: LucideIcon }> = {
  astack: { label: "Astack", icon: Layers },
  "bug-fix": { label: "Bug fix", icon: Bug },
  implement: { label: "Implement", icon: Hammer },
  investigate: { label: "Investigate", icon: Search },
  performance: { label: "Performance", icon: Gauge },
  refactor: { label: "Refactor", icon: CodeXml },
  verify: { label: "Verify", icon: ShieldCheck },
  testing: { label: "Testing", icon: FlaskConical },
  e2e: { label: "E2E", icon: FlaskConical },
  react: { label: "React", icon: CodeXml },
  "typescript-best-practices": { label: "TypeScript", icon: CodeXml },
  "web-feature": { label: "Web feature", icon: Paintbrush },
  convex: { label: "Convex", icon: Database },
  "app-control": { label: "App control", icon: Terminal },
  "project-setup": { label: "Project setup", icon: Monitor },
  "cloud-transition": { label: "Cloud transition", icon: CloudUpload },
  "domain-modeling": { label: "Domain modeling", icon: Network },
  "mcp-server": { label: "MCP server", icon: Network },
  "chatgpt-plugin": { label: "ChatGPT plugin", icon: WandSparkles },
  "workos-auth": { label: "WorkOS auth", icon: KeyRound },
  "show-me": { label: "Show me", icon: Monitor },
};

function skillKey(name: string) {
  return name.replace(/^\$/, "").replace(/^applification:/, "");
}

export function skillLabel(name: string) {
  const key = skillKey(name);
  return key === "pr" ? "PR" : (identities[key]?.label ?? name);
}

export function SkillIcon({ name }: { name: string }) {
  const key = skillKey(name);
  if (key === "pr")
    return (
      <img
        src="/providers/github.svg"
        alt=""
        aria-hidden="true"
        className="skill-github-icon"
      />
    );
  const Icon = identities[key]?.icon ?? BookOpen;
  return <Icon aria-hidden="true" />;
}

export function SkillBadge({
  name,
  ...props
}: { name: string } & Omit<ComponentProps<typeof Button>, "children">) {
  return (
    <Button type="button" variant="badge" {...props}>
      <span className="skill-badge-content">
        <SkillIcon name={name} />
        <span>{skillLabel(name)}</span>
      </span>
    </Button>
  );
}
