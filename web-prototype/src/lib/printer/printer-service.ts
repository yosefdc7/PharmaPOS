import type { PrinterProfile, PrintJobResult } from "@/lib/types";

export interface PrinterBackend {
  connect(profile: PrinterProfile): Promise<PrintJobResult>;
  disconnect(): Promise<void>;
  print(commands: Uint8Array): Promise<PrintJobResult>;
  queryStatus(): Promise<PrintJobResult & { status: "success" | "offline" | "paper-low" | "error" }>;
}

export class PrinterService {
  private backend: PrinterBackend | null = null;
  private profile: PrinterProfile | null = null;

  constructor(private backendFactory: (profile: PrinterProfile) => PrinterBackend) {}

  async connect(profile: PrinterProfile): Promise<PrintJobResult> {
    this.profile = profile;
    this.backend = this.backendFactory(profile);
    return this.backend.connect(profile);
  }

  async disconnect(): Promise<void> {
    if (this.backend) {
      await this.backend.disconnect();
      this.backend = null;
    }
    this.profile = null;
  }

  async print(commands: Uint8Array): Promise<PrintJobResult> {
    if (!this.backend) {
      return { status: "error", retryable: true, reason: "Not connected to printer" };
    }
    return this.backend.print(commands);
  }

  async queryStatus(): Promise<PrintJobResult & { status: "success" | "offline" | "paper-low" | "error" }> {
    if (!this.backend) {
      return { status: "offline", retryable: true };
    }
    return this.backend.queryStatus();
  }

  getProfile(): PrinterProfile | null {
    return this.profile;
  }
}

export function createPrinterBackend(profile: PrinterProfile): PrinterBackend {
  switch (profile.connectionType) {
    case "usb":
      return createWebSerialBackend();
    case "bluetooth":
      return createWebBluetoothBackend();
    case "lan":
      return createLanBridgeBackend();
    default:
      throw new Error(`Unsupported connection type: ${profile.connectionType}`);
  }
}

// Placeholder factories — real implementations imported below to avoid circular deps.
function createWebSerialBackend(): PrinterBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebSerialBackend } = require("./web-serial-service");
  return new WebSerialBackend();
}

function createWebBluetoothBackend(): PrinterBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WebBluetoothBackend } = require("./web-bluetooth-service");
  return new WebBluetoothBackend();
}

function createLanBridgeBackend(): PrinterBackend {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { LanBridgeBackend } = require("./lan-bridge-service");
  return new LanBridgeBackend();
}
