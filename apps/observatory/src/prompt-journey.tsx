import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Bridge = { width: number; height: number; path: string };

export function PromptJourney({ children }: { children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null);
  const [bridge, setBridge] = useState<Bridge | null>(null);

  useLayoutEffect(() => {
    const element = content.current;
    if (!element) return;
    const prompt = element.querySelector("[data-prompt-card]");
    const root = element.querySelector("[data-map-root]");
    const viewport = root?.closest(".workflow-map-scroll");
    let frame = 0;
    const measure = () => {
      if (!prompt || !root || !viewport) {
        setBridge(null);
        return;
      }
      const bounds = element.getBoundingClientRect();
      const start = prompt.getBoundingClientRect();
      const end = root.getBoundingClientRect();
      const visible = viewport.getBoundingClientRect();
      const rootX = end.left + end.width / 2;
      if (
        rootX < visible.left ||
        rootX > visible.right ||
        end.top <= start.bottom
      ) {
        setBridge(null);
        return;
      }
      const fromX = start.left + start.width / 2 - bounds.left;
      const fromY = start.bottom - bounds.top;
      const toX = rootX - bounds.left;
      const toY = end.top - bounds.top;
      const middle = (fromY + toY) / 2;
      const next = {
        width: bounds.width,
        height: toY,
        path: `M ${fromX} ${fromY} C ${fromX} ${middle}, ${toX} ${middle}, ${toX} ${toY}`,
      };
      setBridge((previous) =>
        previous?.width === next.width &&
        previous.height === next.height &&
        previous.path === next.path
          ? previous
          : next,
      );
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    if (prompt) observer.observe(prompt);
    if (root) observer.observe(root);
    if (viewport) {
      observer.observe(viewport);
      viewport.addEventListener("scroll", schedule, { passive: true });
    }
    measure();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport?.removeEventListener("scroll", schedule);
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
          <path d={bridge.path} data-prompt-connection="" />
        </svg>
      )}
      {children}
    </div>
  );
}
