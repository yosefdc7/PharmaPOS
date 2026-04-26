import type { PrinterProfile, PrintJobResult } from "@/lib/types";
import type { PrinterBackend } from "./printer-service";

const DEFAULT_BRIDGE_URL = "http://localhost:9101/print";

export class LanBridgeBackend implements PrinterBackend {
  private profile: PrinterProfile | null = null;

  async connect(profile: PrinterProfile): Promise<PrintJobResult> {
    this.profile = profile;
    // Connection is stateless via HTTP; validate bridge by pinging it
    try {
      const bridgeUrl = profile.bridgeUrl ?? DEFAULT_BRIDGE_URL;
      const ping = bridgeUrl.replace("/print", "/health");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(ping, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        return { status: "offline", retryable: true };
      }
      return { status: "success" };
    } catch {
      return { status: "offline", retryable: true };
    }
  }

  async disconnect(): Promise<void> {
    this.profile = null;
  }

  async print(commands: Uint8Array): Promise<PrintJobResult> {
    if (!this.profile) {
      return { status: "error", retryable: true, reason: "No profile set" };
    }
    try {
      const bridgeUrl = this.profile.bridgeUrl ?? DEFAULT_BRIDGE_URL;
      const body = JSON.stringify({
        printerIp: this.profile.address,
        printerPort: 9100,
        commandsBase64: arrayBufferToBase64(commands),
      });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(bridgeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        return { status: "offline", retryable: true };
      }
      const json = (await res.json()) as { success?: boolean; status?: string; message?: string };
      if (json.success) {
        return { status: "success" };
      }
      if (json.status === "paper-low") {
        return { status: "paper-low", retryable: true };
      }
      return { status: "error", retryable: true, reason: json.message ?? "Bridge returned failure" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("abort") || message.includes("fetch")) {
        return { status: "offline", retryable: true };
      }
      return { status: "error", retryable: true, reason: message };
    }
  }

  async queryStatus(): Promise<PrintJobResult & { status: "success" | "offline" | "paper-low" | "error" }> {
    if (!this.profile) {
      return { status: "offline", retryable: true };
    }
    try {
      const bridgeUrl = this.profile.bridgeUrl ?? DEFAULT_BRIDGE_URL;
      const ping = bridgeUrl.replace("/print", "/health");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(ping, { method: "GET", signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        return { status: "offline", retryable: true };
      }
      return { status: "success" };
    } catch {
      return { status: "offline", retryable: true };
    }
  }
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}
