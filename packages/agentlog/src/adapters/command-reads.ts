import { parse } from "shell-quote";

// Recognize literal reader commands without executing captured shell text or
// resolving its environment. Successful && chains establish every read;
// pipelines, ; lists and dynamic paths cannot establish the same fact.
export function commandReadPaths(command: string, depth = 0): string[] {
  if (depth > 2 || command.length > 16_384 || /`|\$\(/.test(command)) return [];
  try {
    const tokens = parse(command, () => {
      throw new Error("Dynamic shell path");
    });
    const groups: string[][] = [[]];
    for (const token of tokens) {
      if (typeof token === "string") groups.at(-1)?.push(token);
      else if ("op" in token && token.op === "&&") groups.push([]);
      else return [];
    }
    const paths: string[] = [];
    for (const words of groups) {
      const [reader, ...args] = words;
      if (!reader) return [];
      if (/^(?:\/(?:usr\/)?bin\/)?(?:sh|bash|zsh)$/.test(reader)) {
        const [flags, script] = args;
        if (
          !flags ||
          !/^-[l]*c[l]*$/.test(flags) ||
          !script ||
          args.length !== 2
        )
          return [];
        const nested = commandReadPaths(script, depth + 1);
        if (!nested.length) return [];
        paths.push(...nested);
      } else {
        if (!/^(?:\/(?:usr\/)?bin\/)?(?:cat|read_file)$/.test(reader))
          return [];
        const files = args[0] === "--" ? args.slice(1) : args;
        if (
          !files.length ||
          files.some(
            (path) => !path || path.startsWith("-") || path.startsWith("~"),
          )
        )
          return [];
        paths.push(...files);
      }
    }
    return paths.length <= 40 ? paths : [];
  } catch {
    return [];
  }
}
