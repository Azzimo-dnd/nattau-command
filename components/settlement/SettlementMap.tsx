"use client";

import Image from "next/image";
import { useState } from "react";
import {
  getCategoryLabel,
  settlementBuildings,
  settlementSummary,
  type BuildingCategory,
} from "./settlementData";

const categoryFilters: Array<BuildingCategory | "all"> = [
  "all",
  "food",
  "military",
  "civic",
  "housing",
  "special",
  "infrastructure",
];

function getCategoryClass(category: BuildingCategory) {
  switch (category) {
    case "food":
      return "border-green-500/60 bg-green-500/15 text-green-300";
    case "military":
      return "border-red-500/60 bg-red-500/15 text-red-300";
    case "civic":
      return "border-blue-500/60 bg-blue-500/15 text-blue-300";
    case "housing":
      return "border-slate-500/60 bg-slate-500/15 text-slate-300";
    case "special":
      return "border-purple-500/60 bg-purple-500/15 text-purple-300";
    case "infrastructure":
      return "border-yellow-500/60 bg-yellow-500/15 text-yellow-300";
    default:
      return "border-slate-700 bg-slate-950 text-slate-300";
  }
}

function getStatusClass(status: string) {
  switch (status) {
    case "active":
      return "text-green-400";
    case "stable":
      return "text-blue-400";
    case "damaged":
      return "text-red-400";
    case "inactive":
      return "text-slate-400";
    case "planned":
      return "text-yellow-400";
    default:
      return "text-slate-400";
  }
}

export function SettlementMap() {
  const [selectedBuildingId, setSelectedBuildingId] = useState(
    settlementBuildings[0].id
  );
  const [selectedCategory, setSelectedCategory] =
    useState<BuildingCategory | "all">("all");
  const [showLabels, setShowLabels] = useState(false);

  const selectedBuilding =
    settlementBuildings.find((building) => building.id === selectedBuildingId) ??
    settlementBuildings[0];

  const visibleBuildings =
    selectedCategory === "all"
      ? settlementBuildings
      : settlementBuildings.filter(
          (building) => building.category === selectedCategory
        );

  return (
    <section className="space-y-6">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Population</p>
          <p className="mt-2 text-3xl font-black text-yellow-400">
            {settlementSummary.population}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            Settlers
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Morale</p>
          <p className="mt-2 text-3xl font-black text-green-400">
            {settlementSummary.morale}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            Inspired
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Food</p>
          <p className="mt-2 text-3xl font-black text-green-300">
            {settlementSummary.food}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            Cabbage + grain
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <p className="text-sm text-slate-400">Defense</p>
          <p className="mt-2 text-3xl font-black text-blue-400">
            {settlementSummary.defense}
          </p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            Gate / walls / towers
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                Settlement Index
              </p>
              <h2 className="mt-3 text-2xl font-bold">Locations</h2>
            </div>

            <button
              type="button"
              onClick={() => setShowLabels((current) => !current)}
              className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
            >
              {showLabels ? "Hide Labels" : "Show Labels"}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {categoryFilters.map((category) => {
              const isSelected = selectedCategory === category;
              const label =
                category === "all" ? "All" : getCategoryLabel(category);

              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-xl border px-3 py-2 text-xs transition ${
                    isSelected
                      ? "border-yellow-500 bg-yellow-500/15 text-yellow-300"
                      : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-yellow-600/40 hover:text-yellow-300"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-5 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {visibleBuildings.map((building) => {
              const isSelected = selectedBuilding.id === building.id;

              return (
                <button
                  key={building.id}
                  type="button"
                  onClick={() => setSelectedBuildingId(building.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isSelected
                      ? "border-yellow-500 bg-yellow-500/10"
                      : "border-slate-800 bg-slate-950/60 hover:border-yellow-600/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{building.icon}</span>

                    <div>
                      <h3 className="font-bold text-slate-100">
                        {building.name}
                      </h3>
                      <p
                        className={`mt-1 text-xs uppercase tracking-wide ${getStatusClass(
                          building.status
                        )}`}
                      >
                        {building.status}
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
                src="/images/uc-settlement-map.png"
                alt="Map of UĆ settlement"
                width={1536}
                height={1024}
                className="h-auto w-full"
                priority
              />

              {visibleBuildings.map((building) => {
                const isSelected = selectedBuilding.id === building.id;

                return (
                  <button
                    key={building.id}
                    type="button"
                    onClick={() => setSelectedBuildingId(building.id)}
                    style={{
                      left: `${building.x}%`,
                      top: `${building.y}%`,
                    }}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    title={building.name}
                  >
                    {isSelected && (
                      <span className="absolute -inset-2 animate-ping rounded-full bg-yellow-500/40" />
                    )}

                    <span
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border text-sm shadow-lg transition md:h-9 md:w-9 ${
                      isSelected
                        ? "border-yellow-300 bg-yellow-500 text-slate-950 opacity-100"
                        : "border-slate-300 bg-slate-950/45 text-slate-100 opacity-45 hover:border-yellow-400 hover:bg-slate-950/80 hover:opacity-100"
                    }`}
                  >
                    {building.icon}
                  </span>

                    {showLabels && (
                      <span
                        className={`absolute left-1/2 top-9 hidden -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-1 text-xs md:block ${
                          isSelected
                            ? "border-yellow-600/40 bg-slate-950 text-yellow-300"
                            : "border-slate-700 bg-slate-950/80 text-slate-300"
                        }`}
                      >
                        {building.name}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
                  Selected Location
                </p>

                <h2 className="mt-3 text-3xl font-bold">
                  {selectedBuilding.name}
                </h2>
              </div>

              <span
                className={`rounded-full border px-3 py-1 text-xs uppercase tracking-wide ${getCategoryClass(
                  selectedBuilding.category
                )}`}
              >
                {getCategoryLabel(selectedBuilding.category)}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={`rounded-full border border-slate-700 px-3 py-1 text-xs uppercase tracking-wide ${getStatusClass(
                  selectedBuilding.status
                )}`}
              >
                {selectedBuilding.status}
              </span>

              {selectedBuilding.output && (
                <span className="rounded-full border border-yellow-600/40 bg-yellow-500/10 px-3 py-1 text-xs uppercase tracking-wide text-yellow-300">
                  {selectedBuilding.output}
                </span>
              )}
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-400">
              {selectedBuilding.summary}
            </p>

            <div className="mt-4 space-y-2">
              {selectedBuilding.notes.map((note) => (
                <p key={note} className="text-sm text-slate-500">
                  • {note}
                </p>
              ))}
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
