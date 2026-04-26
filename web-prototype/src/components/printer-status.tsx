"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PrinterProfile, PrinterStatusType } from "@/lib/types";
import { getAll } from "@/lib/db";
import { PrinterService, createPrinterBackend } from "@/lib/printer";

const POLL_INTERVAL_MS = 30000;
const INITIAL_BACKOFF_MS = 2000;
const MAX_BACKOFF_MS = 30000;

const statusLabels: Record<PrinterStatusType, string> = {
  online: "Printer Online",
  offline: "Printer Offline",
  "paper-low": "Paper Low",
  error: "Printer Error"
};

const chipClass: Record<PrinterStatusType, string> = {
  online: "online",
  offline: "offline",
  "paper-low": "paper-low",
  error: "error"
};

function getDefaultOrPrinter(profiles: PrinterProfile[]): PrinterProfile | undefined {
  return profiles.find((p) => p.isDefault && (p.role === "or" || p.role === "both")) ??
    profiles.find((p) => p.role === "or" || p.role === "both");
}

export function PrinterStatusIndicator() {
  const [status, setStatus] = useState<PrinterStatusType>("offline");
  const [printer, setPrinter] = useState<PrinterProfile | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const idbAvailable = typeof indexedDB !== "undefined";

  const loadPrinter = useCallback(async () => {
    if (!idbAvailable) {
      return;
    }

    const profiles = await getAll("printerProfiles");
    const defaultPrinter = getDefaultOrPrinter(profiles);
    if (defaultPrinter) {
      setPrinter(defaultPrinter);
    }
  }, [idbAvailable]);

  const pollStatus = useCallback(async () => {
    if (!idbAvailable) {
      return;
    }

    if (!printer) {
      await loadPrinter();
      return;
    }

    const service = new PrinterService(createPrinterBackend);
    try {
      const result = await service.connect(printer);
      if (result.status !== "success") {
        if (mountedRef.current) {
          setStatus(result.status === "paper-low" ? "paper-low" : "offline");
          setReconnecting(true);
        }
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        return;
      }

      const query = await service.queryStatus();
      if (mountedRef.current) {
        if (query.status === "paper-low") {
          setStatus("paper-low");
        } else if (query.status === "error") {
          setStatus("error");
        } else if (query.status === "offline") {
          setStatus("offline");
          setReconnecting(true);
        } else {
          setStatus("online");
          setReconnecting(false);
          backoffRef.current = INITIAL_BACKOFF_MS;
        }
      }
    } catch {
      if (mountedRef.current) {
        setStatus("offline");
        setReconnecting(true);
      }
    } finally {
      await service.disconnect();
    }
  }, [idbAvailable, loadPrinter, printer]);

  useEffect(() => {
    mountedRef.current = true;
    if (!idbAvailable) {
      return () => {
        mountedRef.current = false;
      };
    }

    loadPrinter();

    const interval = setInterval(() => {
      if (mountedRef.current) {
        pollStatus();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [idbAvailable, loadPrinter, pollStatus]);

  useEffect(() => {
    if (!idbAvailable || status !== "offline" || !reconnecting) {
      return;
    }

    timerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        pollStatus();
      }
    }, backoffRef.current);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [idbAvailable, pollStatus, reconnecting, status]);

  return (
    <button
      type="button"
      className={`printer-status-chip ${chipClass[status]}`}
      title={
        !idbAvailable
          ? "Printer status unavailable in this environment"
          : printer
            ? `Printer: ${printer.label} (${printer.connectionType.toUpperCase()})`
            : "No default OR printer configured"
      }
    >
      <span className="status-dot" />
      <span>{statusLabels[status]}</span>
      {status === "offline" && reconnecting && (
        <>
          <span className="reconnect-spinner" />
          <span className="reconnect-text">Reconnecting...</span>
        </>
      )}
    </button>
  );
}
