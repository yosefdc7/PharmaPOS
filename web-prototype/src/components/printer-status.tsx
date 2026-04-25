"use client";

import { useState } from "react";
import type { PrinterStatusType } from "@/lib/types";

type PrinterStatusProps = {
  onStatusClick?: () => void;
};

const statusCycle: PrinterStatusType[] = ["online", "offline", "paper-low", "error"];

const statusLabels: Record<PrinterStatusType, string> = {
  online: "Printer Online",
  offline: "Printer Offline",
  "paper-low": "Paper Low",
  error: "Printer Error",
};

const chipClass: Record<PrinterStatusType, string> = {
  online: "online",
  offline: "offline",
  "paper-low": "paper-low",
  error: "error",
};

export function PrinterStatusIndicator({ onStatusClick }: PrinterStatusProps) {
  const [idx, setIdx] = useState(0);
  const status = statusCycle[idx];

  const handleClick = () => {
    setIdx((i) => (i + 1) % statusCycle.length);
    onStatusClick?.();
  };

  return (
    <button
      type="button"
      className={`printer-status-chip ${chipClass[status]}`}
      onClick={handleClick}
      title="Click to cycle printer status (demo)"
    >
      <span className="status-dot" />
      <span>{statusLabels[status]}</span>
      {status === "offline" && (
        <>
          <span className="reconnect-spinner" />
          <span className="reconnect-text">Reconnecting…</span>
        </>
      )}
    </button>
  );
}
