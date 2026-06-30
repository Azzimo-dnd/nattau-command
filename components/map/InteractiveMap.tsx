"use client";

import Image from "next/image";
import { useState } from "react";
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
      <aside className="space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
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
                      <p
                        className={`mt-1 text-sm ${getOwnerClass(
                          location.owner
                        )}`}
                      >
                        {location.owner}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
            Selected Location
          </p>

          <h2 className="mt-3 text-3xl font-bold">{selectedLocation.name}</h2>

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
      </aside>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-3">
        <div className="relative overflow-hidden rounded-xl">
          <Image
            src="/images/hinewai-map.jpg"
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
                className="absolute -translate-x-1/2 -translate-y-full"
                title={location.name}
              >
                <div className="flex flex-col items-center">
                  {isSelected && (
                    <span className="absolute top-0 h-8 w-8 rounded-full bg-yellow-500/40 animate-ping" />
                  )}

                  <span
                    className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border shadow-lg transition-all ${
                      isSelected
                        ? "scale-110 border-yellow-300 bg-yellow-500 text-slate-950"
                        : "border-slate-300 bg-slate-950/90 text-slate-100 hover:scale-105 hover:border-yellow-400"
                    }`}
                  >
                    {getLocationIcon(location.type)}
                  </span>

                  <span
                    className={`h-6 w-[2px] ${
                      isSelected ? "bg-yellow-400" : "bg-slate-400"
                    }`}
                  />

                  <span
                    className={`-mt-[1px] h-0 w-0 border-l-[5px] border-r-[5px] border-t-[8px] border-l-transparent border-r-transparent ${
                      isSelected
                        ? "border-t-yellow-400"
                        : "border-t-slate-400"
                    }`}
                  />

                  <span
                    className={`mt-2 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                      isSelected
                        ? "border-yellow-600/50 bg-slate-950 text-yellow-300"
                        : "border-slate-700 bg-slate-950/90 text-slate-300"
                    }`}
                  >
                    {location.name}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}