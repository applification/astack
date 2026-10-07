import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Bridge = {
  width: number;
  height: number;
  prompt: string | null;
  result: string | null;
};

export function PromptJourney({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [bridge, setBridge] = useState<Bridge | null>(null);

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const prompt = element.querySelector("[data-prompt-card]");
    const root = element.querySelector("[data-map-root]");
    const last = [...element.querySelectorAll("[data-map-main]")].at(-1);
    const result = element.querySelector("[data-result-card]");
    const viewports = [...element.querySelectorAll(".workflow-map-scroll")];
    let frame = 0;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const visible = (node: Element) => {
        const viewport = node.closest(".workflow-map-scroll");
        if (!viewport) return false;
        const rect = node.getBoundingClientRect();
        const clip = viewport.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        return x >= clip.left && x <= clip.right;
      };
      const connect = (
        from: Element | null | undefined,
        to: Element | null | undefined,
      ) => {
        if (!from || !to) return null;
        const start = from.getBoundingClientRect();
        const end = to.getBoundingClientRect();
        if (end.top <= start.bottom) return null;
        const fromX = start.left + start.width / 2 - bounds.left;
        const fromY = start.bottom - bounds.top;
        const toX = end.left + end.width / 2 - bounds.left;
        const toY = end.top - bounds.top;
        const middle = (fromY + toY) / 2;
        return `M ${fromX} ${fromY} C ${fromX} ${middle}, ${toX} ${middle}, ${toX} ${toY}`;
      };
      const next = {
        width: bounds.width,
        height: bounds.height,
        prompt: root && visible(root) ? connect(prompt, root) : null,
        result: last && visible(last) ? connect(last, result) : null,
      };
      setBridge((previous) =>
        previous?.width === next.width &&
        previous.height === next.height &&
        previous.prompt === next.prompt &&
        previous.result === next.result
          ? previous
          : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    for (const node of [element, prompt, root, result, last, ...viewports])
      if (node) observer.observe(node);
    for (const viewport of viewports)
      viewport.addEventListener("scroll", schedule, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      for (const viewport of viewports)
        viewport.removeEventListener("scroll", schedule);
    };
  }, [children]);

  return (
    <div className="prompt-journey" ref={content}>
      {bridge && (
        <svg
          className="prompt-journey-link"
          width={bridge.width}
          height={bridge.height}
          aria-hidden="true"
        >
          {bridge.prompt && (
            <path d={bridge.prompt} data-prompt-connection="" />
          )}
          {bridge.result && (
            <path d={bridge.result} data-result-connection="" />
          )}
        </svg>
      )}
      {children}
    </div>
  );
}
