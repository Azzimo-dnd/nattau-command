"use client";

import { useEffect, useState } from "react";

type LocalSessionDateProps = {
  value: string | null;
  fallback?: string;
};

function formatSessionDate(value: string | null, fallback: string) {
  if (!value) return fallback;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return fallback;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function LocalSessionDate({
  value,
  fallback = "Not announced",
}: LocalSessionDateProps) {
  const [label, setLabel] = useState(value ? "…" : fallback);

  useEffect(() => {
    setLabel(formatSessionDate(value, fallback));
  }, [fallback, value]);

  return <>{label}</>;
}
