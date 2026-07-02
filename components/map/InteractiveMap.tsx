"use client";

import Image from "next/image";
import { useState } from "react";
import { FactionInfluence } from "./FactionInfluence";
import { mapLocations } from "./mapLocations";

function getLocationIcon(type: string) {
  switch (type) {
    case "capital":
      return "⭐";
    case "fortress":
      return "🏰";
    case "port":
      return "⚓";
    case "city":
      return "🏛";
    default:
      return "📍";
  }
}

function getOwnerClass(owner: string) {
  switch (owner) {
    case "Kainites":
      return "text-yellow-400";
    case "Merrydock":
      return "text-green-400";
    case "Jin Yan Chao":
      return "text-orange-400";
    default:
      return "text-slate-400";
  }
}

export function InteractiveMap() {
  const [selectedId, setSelectedId] = useState(mapLocations[0].id);

  const selectedLocation =
    mapLocations.find((location) => location.id === selectedId) ??
    mapLocations[0];

  return (
    <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
      <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="text-2xl font-bold text-yellow-500">Locations</h2>
        <p className="mt-2 text-sm text-slate-500">
          Select a known location to ping it on the strategic map.
        </p>

        <div className="mt-5 space-y-3">
          {mapLocations.map((location) => {
            const isSelected = selectedId === location.id;

            return (
              <button
                key={location.id}
                type="button"
                onClick={() => setSelectedId(location.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? "border-yellow-600/50 bg-yellow-500/10"
                    : "border-slate-800 bg-slate-950/60 hover:border-yellow-600/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">
                    {getLocationIcon(location.type)}
                  </span>

                  <div>
                    <h3 className="font-bold text-slate-100">
                      {location.name}
                    </h3>
                    <p className={`mt-1 text-sm ${getOwnerClass(location.owner)}`}>
                      {location.owner}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
          <div className="relative overflow-hidden rounded-xl">
            <Image
              src="/images/hinewai-clear.jpg"
              alt="Strategic map of Hinewai"
              width={1408}
              height={1024}
              className="h-auto w-full"
              priority
            />

            {mapLocations.map((location) => {
              const isSelected = selectedId === location.id;

              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => setSelectedId(location.id)}
                  style={{
                    left: `${location.x}%`,
                    top: `${location.y}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  title={location.name}
                >
                  {isSelected && (
                    <span className="absolute -inset-3 animate-ping rounded-full bg-yellow-500/40" />
                  )}

                  <span
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border text-sm shadow-lg ${
                      isSelected
                        ? "border-yellow-300 bg-yellow-500 text-slate-950"
                        : "border-slate-300 bg-slate-950/80 text-slate-100 hover:border-yellow-400"
                    }`}
                  >
                    {getLocationIcon(location.type)}
                  </span>

                  <span
                    className={`absolute left-1/2 top-9 hidden -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-1 text-xs md:block ${
                      isSelected
                        ? "border-yellow-600/40 bg-slate-950 text-yellow-300"
                        : "border-slate-700 bg-slate-950/80 text-slate-300"
                    }`}
                  >
                    {location.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
              Selected Location
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              {selectedLocation.name}
            </h2>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide text-slate-400">
                {selectedLocation.type}
              </span>

              <span
                className={`rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide ${getOwnerClass(
                  selectedLocation.owner
                )}`}
              >
                {selectedLocation.owner}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-400">
              {selectedLocation.description}
            </p>
          </div>

          <FactionInfluence />
        </section>
      </div>
    </section>
  );
}