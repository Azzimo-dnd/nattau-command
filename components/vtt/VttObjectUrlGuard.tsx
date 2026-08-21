"use client";

import { useEffect } from "react";

export function VttObjectUrlGuard() {
  useEffect(() => {
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    const deferred = new Set<string>();

    URL.revokeObjectURL = (url: string) => {
      if (url.startsWith("blob:")) {
        deferred.add(url);
        return;
      }
      originalRevoke(url);
    };

    return () => {
      URL.revokeObjectURL = originalRevoke;
      for (const url of deferred) originalRevoke(url);
      deferred.clear();
    };
  }, []);

  return null;
}
