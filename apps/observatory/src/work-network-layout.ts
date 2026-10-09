import { createGraph, getLouvainCommunities } from "@statelyai/graph";
import { getForceLayout } from "@statelyai/graph/layout/d3-force";
import { getDagreLayout } from "@statelyai/graph/layout/dagre";
import type {
  WorkNetwork,
  NetworkNode,
} from "@astack/agent-observability/work-network";

export type NetworkLayout = "force" | "communities" | "layered";
export type NetworkPosition = {
  x: number;
  y: number;
  radius: number;
  community: number;
};
export type ViewBox = { x: number; y: number; width: number; height: number };
const radius = (node: NetworkNode) =>
  node.item.kind === "conversation"
    ? 27
    : node.item.kind === "contribution"
      ? 22
      : node.item.kind === "turn"
        ? 17
        : 12;

export function positionNetworkLabels(
  nodes: NetworkNode[],
  positions: ReadonlyMap<string, NetworkPosition>,
  radii: ReadonlyMap<string, number>,
  units: number,
  box: ViewBox,
) {
  const labels = new Map<
    string,
    { x: number; y: number; anchor: "middle" | "start" | "end"; text: string }
  >();
  const occupied = [...positions].map(([id, point]) => {
    const r = radii.get(id) ?? point.radius;
    return { x: point.x - r, y: point.y - r, width: r * 2, height: r * 2 };
  });
  for (const node of nodes) {
    const point = positions.get(node.id);
    if (!point) continue;
    const text =
      node.title.length > 28 ? node.title.slice(0, 27) + "…" : node.title;
    const width = text.length * 6.6 * units,
      height = 15 * units,
      gap = (radii.get(node.id) ?? point.radius) + 7 * units;
    const candidates = [
      {
        x: point.x - width / 2,
        y: point.y - gap - height,
        width,
        height,
        anchor: "middle" as const,
      },
      {
        x: point.x - width / 2,
        y: point.y + gap,
        width,
        height,
        anchor: "middle" as const,
      },
      {
        x: point.x + gap,
        y: point.y - height / 2,
        width,
        height,
        anchor: "start" as const,
      },
      {
        x: point.x - gap - width,
        y: point.y - height / 2,
        width,
        height,
        anchor: "end" as const,
      },
    ];
    const placement = candidates.find(
      (candidate) =>
        candidate.x >= box.x &&
        candidate.y >= box.y &&
        candidate.x + width <= box.x + box.width &&
        candidate.y + height <= box.y + box.height &&
        !occupied.some(
          (rect) =>
            candidate.x < rect.x + rect.width &&
            candidate.x + width > rect.x &&
            candidate.y < rect.y + rect.height &&
            candidate.y + height > rect.y,
        ),
    );
    if (!placement) continue;
    occupied.push(placement);
    labels.set(node.id, {
      x:
        placement.x +
        (placement.anchor === "middle"
          ? width / 2
          : placement.anchor === "end"
            ? width
            : 0) -
        point.x,
      y: placement.y + height * 0.8 - point.y,
      anchor: placement.anchor,
      text,
    });
  }
  return labels;
}

export function layoutWorkNetwork(
  network: WorkNetwork,
  layout: NetworkLayout,
  seed: number,
  resolution: number,
) {
  const graph = createGraph({
    nodes: network.nodes.map((node, index) => ({
      id: node.id,
      x: Math.cos(index * 2.4 + seed) * (20 + index * 4),
      y: Math.sin(index * 2.4 + seed) * (20 + index * 4),
      width: radius(node) * 2,
      height: radius(node) * 2,
    })),
    edges: network.edges.map((edge) => ({
      id: edge.id,
      sourceId: edge.from,
      targetId: edge.to,
    })),
  });
  const communities =
    layout === "communities"
      ? getLouvainCommunities(graph, { resolution })
      : [];
  const membership = new Map(
    communities.flatMap((group, index) =>
      group.map((id) => [id, index] as const),
    ),
  );
  const result =
    layout === "layered"
      ? getDagreLayout(graph, {
          direction: "right",
          spacing: { node: 45, layer: 100 },
        })
      : getForceLayout(graph, {
          seed,
          iterations: 220,
          linkDistance: 100,
          chargeStrength: -650,
        });
  const positions = new Map<string, NetworkPosition>();
  for (const node of result.nodes)
    positions.set(node.id, {
      x: node.x + node.width / 2,
      y: node.y + node.height / 2,
      radius: node.width / 2,
      community: membership.get(node.id) ?? 0,
    });
  if (layout === "communities" && communities.length > 1)
    communities.forEach((group, index) => {
      const members = group.flatMap((id) => {
        const point = positions.get(id);
        return point ? [point] : [];
      });
      const cx =
        members.reduce((sum, point) => sum + point.x, 0) / members.length;
      const cy =
        members.reduce((sum, point) => sum + point.y, 0) / members.length;
      const angle = (index * Math.PI * 2) / communities.length;
      const distance = 120 + Math.sqrt(network.nodes.length) * 25;
      for (const point of members) {
        point.x = (point.x - cx) * 0.65 + Math.cos(angle) * distance;
        point.y = (point.y - cy) * 0.65 + Math.sin(angle) * distance;
      }
    });
  // Resolve circle overlap without changing topology or implying chronology.
  const points = [...positions.values()];
  for (let pass = 0; pass < 10; pass++)
    for (let a = 0; a < points.length; a++)
      for (let b = a + 1; b < points.length; b++) {
        const first = points[a],
          second = points[b];
        if (!first || !second) continue;
        const dx = second.x - first.x || 0.1,
          dy = second.y - first.y || 0.1;
        const distance = Math.hypot(dx, dy),
          minimum = first.radius + second.radius + 20;
        if (distance >= minimum) continue;
        const shift = (minimum - distance) / 2;
        first.x -= (dx / distance) * shift;
        first.y -= (dy / distance) * shift;
        second.x += (dx / distance) * shift;
        second.y += (dy / distance) * shift;
      }
  const minX = points.length
    ? Math.min(...points.map((point) => point.x - point.radius))
    : 0;
  const minY = points.length
    ? Math.min(...points.map((point) => point.y - point.radius))
    : 0;
  const maxX = points.length
    ? Math.max(...points.map((point) => point.x + point.radius))
    : 500;
  const maxY = points.length
    ? Math.max(...points.map((point) => point.y + point.radius))
    : 300;
  const fit: ViewBox = {
    x: minX - 100,
    y: minY - 65,
    width: Math.max(350, maxX - minX + 200),
    height: Math.max(300, maxY - minY + 130),
  };
  return { positions, fit, communities: communities.length };
}
