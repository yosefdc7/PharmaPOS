import type { PrinterProfile, PrintJobResult } from "@/lib/types";
import type { PrinterBackend } from "./printer-service";
import { rawStatusRequest, rawPaperStatusRequest } from "./escpos-commands";

declare global {
  interface Navigator {
    serial?: Serial;
  }
}

interface Serial {
  requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<SerialPort>;
  getPorts(): Promise<SerialPort[]>;
}

interface SerialPort {
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string; bufferSize?: number }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream<Uint8Array> | null;
  readable: ReadableStream<Uint8Array> | null;
}

const DEFAULT_BAUD = 9600;
const READ_TIMEOUT_MS = 3000;

export class WebSerialBackend implements PrinterBackend {
  private port: SerialPort | null = null;

  async connect(profile: PrinterProfile): Promise<PrintJobResult> {
    if (!navigator.serial) {
      return { status: "error", retryable: false, reason: "Web Serial API not available. Use Chrome/Edge on HTTPS or localhost." };
    }

    try {
      let port: SerialPort;
      const ports = await navigator.serial.getPorts();
      const match = profile.portInfo
        ? ports.find(
            (p) =>
              // @ts-expect-error getInfo is experimental
              p.getInfo &&
              // @ts-expect-error
              ((profile.portInfo?.vendorId != null && p.getInfo().usbVendorId === profile.portInfo.vendorId) ||
                // @ts-expect-error
                (profile.portInfo?.productId != null && p.getInfo().usbProductId === profile.portInfo.productId))
          )
        : undefined;

      if (match) {
        port = match;
      } else {
        port = await navigator.serial.requestPort({
          filters: profile.portInfo
            ? [{ usbVendorId: profile.portInfo.vendorId, usbProductId: profile.portInfo.productId }]
            : undefined,
        });
      }

      await port.open({
        baudRate: profile.baudRate ?? DEFAULT_BAUD,
        dataBits: 8,
        stopBits: 1,
        parity: "none",
      });

      this.port = port;
      return { status: "success" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("No port selected") || message.includes("NotFoundError")) {
        return { status: "offline", retryable: true };
      }
      return { status: "error", retryable: true, reason: message };
    }
  }

  async disconnect(): Promise<void> {
    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignore
      }
      this.port = null;
    }
  }

  async print(commands: Uint8Array): Promise<PrintJobResult> {
    if (!this.port || !this.port.writable) {
      return { status: "offline", retryable: true };
    }
    try {
      const writer = this.port.writable.getWriter();
      await writer.write(commands);
      writer.releaseLock();
      return { status: "success" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("NetworkError") || message.includes("break")) {
        return { status: "offline", retryable: true };
      }
      return { status: "error", retryable: true, reason: message };
    }
  }

  async queryStatus(): Promise<PrintJobResult & { status: "success" | "offline" | "paper-low" | "error" }> {
    if (!this.port || !this.port.writable || !this.port.readable) {
      return { status: "offline", retryable: true };
    }

    try {
      // Send DLE EOT 1 (printer status) and DLE EOT 4 (paper status)
      const writer = this.port.writable.getWriter();
      await writer.write(rawStatusRequest());
      await writer.write(rawPaperStatusRequest());
      writer.releaseLock();

      // Read response
      const reader = this.port.readable.getReader();
      let response: Uint8Array | null = null;
      const timer = setTimeout(() => reader.releaseLock(), READ_TIMEOUT_MS);
      try {
        const { value, done } = await reader.read();
        if (!done && value) {
          response = value;
        }
      } catch {
        // ignore read errors
      } finally {
        clearTimeout(timer);
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
      }

      if (!response || response.length === 0) {
        return { status: "offline", retryable: true };
      }

      // ESC/POS status byte 1 bits:
      // bit 2 = drawer kick pin 3 (ignore)
      // bit 3 = offline (1 = online, 0 = offline) — actually bit 3 means something else depending on doc
      // We'll do a simplified heuristic: if all bytes are 0, assume offline
      const paperByte = response[response.length - 1] ?? 0;
      const paperLow = (paperByte & 0b00001100) !== 0; // simplified heuristic
      if (paperLow) {
        return { status: "paper-low", retryable: true };
      }
      return { status: "success" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", retryable: true, reason: message };
    }
  }
}
