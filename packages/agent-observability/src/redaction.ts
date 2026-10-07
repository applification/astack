import { z } from "zod";

const sensitiveKey =
  /^(?:env|environment|environmentVariables|headers|authorization|cookie|set-cookie)$|(?:password|passwd|secret|token|credential|api[_-]?key|private[_-]?key)/i;
const replacement = "[REDACTED]";

export function redactText(
  input: string,
  knownSecrets: readonly string[] = [],
  maximumCharacters: number | null = 8000,
): string {
  let value = input;
  for (const secret of knownSecrets)
    if (secret.length >= 6) value = value.split(secret).join(replacement);
  const redacted = value
    .replace(
      /-----BEGIN (?:[A-Z ]+)?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z ]+)?PRIVATE KEY-----/g,
      replacement,
    )
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+\/=:-]+/gi, replacement)
    .replace(
      /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|github_pat_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{16})\b/g,
      replacement,
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      replacement,
    )
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, "$1[REDACTED]@")
    .replace(
      /([?&](?:token|key|password|secret|signature|credential)=)[^&\s]+/gi,
      "$1[REDACTED]",
    )
    .replace(
      /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/g,
      "$1=[REDACTED]",
    )
    .replace(
      /(["']?(?:password|passwd|secret|(?:access_|refresh_|id_)?token|api[_-]?key|authorization|credential|cookie|set-cookie)["']?\s*[=:]\s*)(?:"[^"\n]*"|'[^'\n]*'|[^\s,;}]+)/gi,
      "$1[REDACTED]",
    )
    .replace(
      /(--?(?:password|passwd|token|api-key|secret|credential)\s+)(?:"[^"\n]*"|'[^'\n]*'|[^\s]+)/gi,
      "$1[REDACTED]",
    );
  return maximumCharacters === null
    ? redacted
    : redacted.slice(0, maximumCharacters);
}

export function redact(
  value: unknown,
  knownSecrets: readonly string[] = [],
  depth = 0,
  maximumTextCharacters: number | null = 8000,
): z.infer<ReturnType<typeof z.json>> {
  if (depth > 16) return "[OMITTED: depth]";
  if (typeof value === "string")
    return redactText(value, knownSecrets, maximumTextCharacters);
  if (typeof value === "boolean" || value === null) return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value))
    return value
      .slice(0, 100)
      .map((item) =>
        redact(item, knownSecrets, depth + 1, maximumTextCharacters),
      );
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 100)
        .map(([key, item]) => [
          redactText(key, knownSecrets).slice(0, 128),
          sensitiveKey.test(key)
            ? replacement
            : redact(item, knownSecrets, depth + 1, maximumTextCharacters),
        ]),
    );
  }
  return null;
}

// Inspect secret-like values only in memory; never persist or emit an environment dump.
export function environmentSecrets(environment: NodeJS.ProcessEnv): string[] {
  return Object.entries(environment).flatMap(([key, value]) =>
    sensitiveKey.test(key) && value && value.length >= 6 ? [value] : [],
  );
}
