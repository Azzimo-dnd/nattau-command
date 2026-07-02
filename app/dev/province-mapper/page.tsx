"use client";

import Image from "next/image";
import { useState } from "react";

type Point = {
  x: number;
  y: number;
};

export default function ProvinceMapperPage() {
  const [points, setPoints] = useState<Point[]>([]);

  function handleMapClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setPoints((currentPoints) => [
      ...currentPoints,
      {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
      },
    ]);
  }

  function undoLastPoint() {
    setPoints((currentPoints) => currentPoints.slice(0, -1));
  }

  function clearPoints() {
    setPoints([]);
  }

  const pointsString = points
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 md:p-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-yellow-600/30 bg-slate-900/70 p-6">
          <p className="text-xs uppercase tracking-[0.45em] text-yellow-500">
            Nattau Command Dev Tool
          </p>

          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
            Province Mapper
          </h1>

          <p className="mt-3 max-w-3xl text-slate-400">
            Click around a province border to generate SVG polygon points.
            Use this only locally while preparing province overlays.
          </p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
            <div
              onClick={handleMapClick}
              className="relative cursor-crosshair overflow-hidden rounded-xl"
            >
              <Image
                src="/images/hinewai-map.jpg"
                alt="Clean map of Hinewai"
                width={1408}
                height={1024}
                className="h-auto w-full select-none"
                priority
              />

              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {points.length > 1 && (
                  <polyline
                    points={pointsString}
                    fill="none"
                    stroke="yellow"
                    strokeWidth="0.35"
                  />
                )}

                {points.length > 2 && (
                  <polygon
                    points={pointsString}
                    fill="rgba(234, 179, 8, 0.2)"
                    stroke="yellow"
                    strokeWidth="0.35"
                  />
                )}

                {points.map((point, index) => (
                  <g key={`${point.x}-${point.y}-${index}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="0.7"
                      fill="red"
                      stroke="white"
                      strokeWidth="0.2"
                    />
                    <text
                      x={point.x + 1}
                      y={point.y - 1}
                      fill="white"
                      fontSize="2"
                      stroke="black"
                      strokeWidth="0.15"
                    >
                      {index + 1}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-2xl font-bold text-yellow-500">
                Mapper Controls
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                Click points clockwise or counter-clockwise around the province.
                When you are happy, copy the generated string.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={undoLastPoint}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-300 hover:border-yellow-600/50 hover:text-yellow-400"
                >
                  Undo
                </button>

                <button
                  type="button"
                  onClick={clearPoints}
                  className="rounded-xl border border-red-700/50 bg-red-950/30 px-4 py-2 text-sm text-red-300 hover:border-red-500"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Points Count
              </p>

              <p className="mt-2 text-4xl font-bold text-slate-100">
                {points.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                SVG Polygon Points
              </p>

              <textarea
                readOnly
                value={pointsString}
                className="mt-4 h-40 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-sm text-slate-200"
              />

              <p className="mt-3 text-sm text-slate-500">
                Copy this value into <code>provinceData.ts</code> as the
                province&apos;s <code>points</code>.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Example
              </p>

              <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
{`{
  id: "uc-province",
  name: "UĆ Province",
  owner: "Kainites",
  points: "${pointsString}"
}`}
              </pre>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}