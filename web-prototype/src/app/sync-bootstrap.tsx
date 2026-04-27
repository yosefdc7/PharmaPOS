"use client";

import { useEffect } from "react";
import { startAutoSync, stopAutoSync } from "@/lib/sync-worker";

export function SyncBootstrap(): null {
  useEffect(() => {
    startAutoSync();
    return () => stopAutoSync();
  }, []);

  return null;
}
