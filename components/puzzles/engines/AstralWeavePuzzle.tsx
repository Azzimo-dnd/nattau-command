"use client";

import { useMemo } from "react";
import type {
  CampaignPuzzleRow,
  CampaignPuzzleRunRow,
  JsonRecord,
} from "@/lib/puzzles/puzzleTypes";
import type { AstralEdge, AstralNode } from "@/lib/puzzles/astralWeave";

function parseNodes(value: unknown): AstralNode[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: String(item.id ?? ""),
      x: Number(item.x ?? 0),
      y: Number(item.y ?? 0),
      required: Number(item.required ?? 0),
    }))
    .filter((node) => node.id.length > 0);
}

function parseEdges(value: unknown): AstralEdge[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      id: String(item.id ?? ""),
      a: String(item.a ?? ""),
      b: String(item.b ?? ""),
      crosses: Array.isArray(item.crosses) ? item.crosses.map(String) : [],
    }))
    .filter((edge) => edge.id && edge.a && edge.b);
}

function bridgeRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, number>;
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, count]) => [
      key,
      Math.max(0, Math.min(2, Number(count) || 0)),
    ]),
  );
}

export function AstralWeavePuzzle({
  puzzle,
  run,
  disabled,
  onAction,
}: {
  puzzle: CampaignPuzzleRow;
  run: CampaignPuzzleRunRow;
  disabled: boolean;
  onAction: (action: JsonRecord) => Promise<unknown>;
}) {
  const grid = Math.max(2, Number(puzzle.public_config.grid_size ?? 7));
  const nodes = useMemo(
    () => parseNodes(puzzle.public_config.nodes),
    [puzzle.public_config.nodes],
  );
  const edges = useMemo(
    () => parseEdges(puzzle.public_config.edges),
    [puzzle.public_config.edges],
  );
  const bridges = useMemo(
    () => bridgeRecord(run.state.bridges),
    [run.state.bridges],
  );
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  const degreeByNode = useMemo(() => {
    const degrees = new Map(nodes.map((node) => [node.id, 0]));
    for (const edge of edges) {
      const count = bridges[edge.id] ?? 0;
      if (count <= 0) continue;
      degrees.set(edge.a, (degrees.get(edge.a) ?? 0) + count);
      degrees.set(edge.b, (degrees.get(edge.b) ?? 0) + count);
    }
    return degrees;
  }, [bridges, edges, nodes]);

  const crossingEdges = useMemo(() => {
    const crossed = new Set<string>();
    for (const edge of edges) {
      if ((bridges[edge.id] ?? 0) <= 0) continue;
      for (const otherId of edge.crosses) {
        if ((bridges[otherId] ?? 0) > 0) {
          crossed.add(edge.id);
          crossed.add(otherId);
        }
      }
    }
    return crossed;
  }, [bridges, edges]);

  const position = (value: number) =>
    8 + (Math.max(0, Math.min(grid - 1, value)) / (grid - 1)) * 84;

  const setCount = (edge: AstralEdge, delta: 1 | -1) => {
    if (disabled) return;
    const current = bridges[edge.id] ?? 0;
    const next = delta === 1
      ? (current + 1) % 3
      : (current + 2) % 3;
    void onAction({
      type: "weave_bridge",
      edge_id: edge.id,
      count: next,
    });
  };

  return (
    <div className="mx-auto max-w-[760px]">
      <div className="overflow-hidden rounded-[30px] border border-indigo-500/25 bg-[radial-gradient(circle_at_48%_40%,rgba(49,46,129,0.24),rgba(4,5,15,0.98)_64%)] p-2 shadow-2xl shadow-indigo-950/40 sm:p-4">
        <svg
          viewBox="0 0 100 100"
          className="aspect-square w-full"
          aria-label="Astral Weave star map"
        >
          <defs>
            <filter id="astral-glow">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {Array.from({ length: 34 }, (_, index) => {
            const x = 4 + ((index * 37) % 92);
            const y = 3 + ((index * 61) % 94);
            const radius = index % 5 === 0 ? 0.32 : 0.18;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r={radius}
                fill="rgba(226,232,240,0.34)"
                pointerEvents="none"
              />
            );
          })}

          {edges.map((edge) => {
            const a = nodeById.get(edge.a);
            const b = nodeById.get(edge.b);
            if (!a || !b) return null;
            const x1 = position(a.x);
            const y1 = position(a.y);
            const x2 = position(b.x);
            const y2 = position(b.y);
            const count = bridges[edge.id] ?? 0;
            const crossed = crossingEdges.has(edge.id);
            const horizontal = Math.abs(y1 - y2) < 0.1;
            const offsetX = horizontal ? 0 : 0.85;
            const offsetY = horizontal ? 0.85 : 0;

            const visibleLines =
              count === 2
                ? [
                    [x1 - offsetX, y1 - offsetY, x2 - offsetX, y2 - offsetY],
                    [x1 + offsetX, y1 + offsetY, x2 + offsetX, y2 + offsetY],
                  ]
                : [[x1, y1, x2, y2]];

            return (
              <g key={edge.id}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(129,140,248,0.12)"
                  strokeWidth="0.55"
                  strokeDasharray="1.2 1.8"
                  pointerEvents="none"
                />

                {count > 0
                  ? visibleLines.map((line, lineIndex) => (
                      <line
                        key={lineIndex}
                        x1={line[0]}
                        y1={line[1]}
                        x2={line[2]}
                        y2={line[3]}
                        stroke={
                          crossed
                            ? "rgba(251,113,133,0.95)"
                            : "rgba(196,181,253,0.96)"
                        }
                        strokeWidth="0.75"
                        strokeLinecap="round"
                        filter="url(#astral-glow)"
                        pointerEvents="none"
                      />
                    ))
                  : null}

                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="transparent"
                  strokeWidth="5"
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-label={`Astral thread ${edge.a} to ${edge.b}: ${count}`}
                  className={disabled ? "" : "cursor-pointer"}
                  onClick={() => setCount(edge, 1)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setCount(edge, -1);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setCount(edge, 1);
                    }
                  }}
                />
              </g>
            );
          })}

          {nodes.map((node) => {
            const x = position(node.x);
            const y = position(node.y);
            const current = degreeByNode.get(node.id) ?? 0;
            const complete = current === node.required;
            const over = current > node.required;

            return (
              <g key={node.id} pointerEvents="none">
                <circle
                  cx={x}
                  cy={y}
                  r="4.5"
                  fill={
                    over
                      ? "rgba(76,5,25,0.96)"
                      : complete
                        ? "rgba(30,27,75,0.96)"
                        : "rgba(8,12,28,0.97)"
                  }
                  stroke={
                    over
                      ? "rgba(251,113,133,0.95)"
                      : complete
                        ? "rgba(196,181,253,0.95)"
                        : "rgba(129,140,248,0.62)"
                  }
                  strokeWidth="0.65"
                  filter={complete ? "url(#astral-glow)" : undefined}
                />
                <circle
                  cx={x}
                  cy={y}
                  r="1.15"
                  fill="rgba(255,255,255,0.94)"
                />
                <text
                  x={x}
                  y={y + 0.25}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="3.2"
                  fontWeight="800"
                  fill="rgba(238,242,255,0.96)"
                >
                  {node.required}
                </text>
                <text
                  x={x}
                  y={y + 7}
                  textAnchor="middle"
                  fontSize="2.2"
                  fill={
                    complete
                      ? "rgba(196,181,253,0.82)"
                      : "rgba(148,163,184,0.55)"
                  }
                >
                  {current}/{node.required}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
        <span>Click a faint lane to cycle 0 → 1 → 2 threads.</span>
        <span>Right-click cycles backwards.</span>
        <span>Match every star number and connect one constellation.</span>
        {crossingEdges.size > 0 ? (
          <span className="font-semibold text-rose-300/85">
            crossed star-threads detected
          </span>
        ) : null}
      </div>
    </div>
  );
}
