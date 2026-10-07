import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Point = { x: number; y: number };
type Connection = {
  id: string;
  kind: "root" | "main" | "fork" | "child" | "join";
  from: string;
  to: string;
  d: string;
  color: string;
};

export const childLineColors = [
  "#5b9d9b",
  "#b78b3e",
  "#8875a6",
  "#d7775f",
  "#6f8eb2",
];

// Lines follow measured stops, so wrapped labels and evidence panels cannot detach them.
export function ConnectedWorkflowMap({
  children,
  route,
}: {
  children: ReactNode;
  route?: string;
}) {
  const content = useRef<HTMLDivElement>(null);
  const [geometry, setGeometry] = useState<{
    width: number;
    height: number;
    connections: Connection[];
  }>({ width: 0, height: 0, connections: [] });
  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const point = (stop: Element): Point => {
        const rect = stop.getBoundingClientRect();
        return {
          x: rect.left - bounds.left + rect.width / 2,
          y: rect.top - bounds.top + rect.height / 2,
        };
      };
      const connections: Connection[] = [];
      const connect = (
        from: Element,
        to: Element,
        kind: Connection["kind"],
        color = "var(--journey-color)",
      ) => {
        const a = point(from),
          b = point(to);
        const fromKey = from.getAttribute("data-map-key") ?? "root";
        const toKey = to.getAttribute("data-map-key") ?? "stop";
        const d =
          kind === "root" || kind === "fork" || kind === "join"
            ? `M ${a.x} ${a.y} C ${a.x} ${a.y + (b.y - a.y) / 2} ${b.x} ${a.y + (b.y - a.y) / 2} ${b.x} ${b.y}`
            : `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
        connections.push({
          id: `${kind}:${fromKey}:${toKey}`,
          kind,
          from: fromKey,
          to: toKey,
          d,
          color,
        });
      };
      const main = [...element.querySelectorAll("[data-map-main]")];
      const root = element.querySelector("[data-map-root]");
      if (root && main[0]) connect(root, main[0], "root");
      main.forEach((stop, index) => {
        const previous = main[index - 1];
        if (previous) connect(previous, stop, "main");
      });
      const fork = element.querySelector("[data-map-fork]");
      element.querySelectorAll("[data-map-branch]").forEach((branch, index) => {
        const stops = [...branch.querySelectorAll("[data-map-child-stop]")];
        const color =
          childLineColors[index % childLineColors.length] ?? "#5b9d9b";
        if (fork && stops[0]) connect(fork, stops[0], "fork", color);
        stops.forEach((stop, i) => {
          const previous = stops[i - 1];
          if (previous) connect(previous, stop, "child", color);
        });
        const target = branch.getAttribute("data-join-target");
        const join = target
          ? main.find((stop) => stop.getAttribute("data-map-key") === target)
          : null;
        const last = stops.at(-1);
        if (last && join) connect(last, join, "join", color);
      });
      const next = {
        width: element.scrollWidth,
        height: element.scrollHeight,
        connections,
      };
      setGeometry((previous) =>
        JSON.stringify(previous) === JSON.stringify(next) ? previous : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    element
      .querySelectorAll("[data-map-station]")
      .forEach((stop) => observer.observe(stop));
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [children]);
  return (
    <div
      className="workflow-map-scroll"
      role="region"
      aria-label="Workflow map"
      tabIndex={0}
    >
      <div ref={content} className="workflow-map" data-route={route}>
        <svg
          className="workflow-map-lines"
          width={geometry.width}
          height={geometry.height}
          aria-hidden="true"
        >
          {geometry.connections.map((line) => (
            <path
              key={line.id}
              data-connection={line.kind}
              data-from={line.from}
              data-to={line.to}
              d={line.d}
              stroke={line.color}
            />
          ))}
        </svg>
        {children}
      </div>
    </div>
  );
}
