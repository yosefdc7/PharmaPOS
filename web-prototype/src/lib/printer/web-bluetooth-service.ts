import type { PrinterProfile, PrintJobResult } from "@/lib/types";
import type { PrinterBackend } from "./printer-service";

// Common printer service UUIDs
const PRINTER_SERVICE_UUIDS = ["000018f0-0000-1000-8000-00805f9b34fb", "00001101-0000-1000-8000-00805f9b34fb"];

interface BluetoothDevice {
  id: string;
  gatt?: BluetoothRemoteGATTServer;
}

interface BluetoothRemoteGATTServer {
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
}

interface BluetoothRemoteGATTCharacteristic {
  uuid: string;
  writeValue(value: ArrayBuffer | Uint8Array): Promise<void>;
  readValue(): Promise<DataView>;
}

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice(options: {
        filters?: Array<{ services?: string[] }>;
        acceptAllDevices?: boolean;
        optionalServices?: string[];
      }): Promise<BluetoothDevice>;
      getDevices?(): Promise<BluetoothDevice[]>;
    };
  }
}

export class WebBluetoothBackend implements PrinterBackend {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private rxChar: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(profile: PrinterProfile): Promise<PrintJobResult> {
    if (!navigator.bluetooth) {
      return { status: "error", retryable: false, reason: "Web Bluetooth API not available. Use Chrome/Edge on HTTPS or localhost." };
    }

    try {
      let device: BluetoothDevice;
      if (profile.deviceId && navigator.bluetooth.getDevices) {
        const paired = await navigator.bluetooth.getDevices();
        const match = paired.find((d) => d.id === profile.deviceId);
        if (match) {
          device = match;
        } else {
          device = await navigator.bluetooth.requestDevice({
            filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
            optionalServices: PRINTER_SERVICE_UUIDS,
          });
        }
      } else {
        device = await navigator.bluetooth.requestDevice({
          filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
          optionalServices: PRINTER_SERVICE_UUIDS,
        });
      }

      this.device = device;
      const server = await device.gatt!.connect();
      this.server = server;

      // Try to find a writable characteristic on any known printer service
      for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          // Try common RX characteristic UUIDs
          const charUuids = [
            "00002af1-0000-1000-8000-00805f9b34fb",
            "00002af0-0000-1000-8000-00805f9b34fb",
          ];
          for (const charUuid of charUuids) {
            try {
              const char = await service.getCharacteristic(charUuid);
              this.rxChar = char;
              return { status: "success" };
            } catch {
              // continue trying
            }
          }
        } catch {
          // continue trying next service
        }
      }

      return { status: "error", retryable: false, reason: "Could not find a writable characteristic on the Bluetooth printer." };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("NotFoundError") || message.includes("User cancelled")) {
        return { status: "offline", retryable: true };
      }
      return { status: "error", retryable: true, reason: message };
    }
  }

  async disconnect(): Promise<void> {
    if (this.server) {
      this.server.disconnect();
      this.server = null;
    }
    this.device = null;
    this.rxChar = null;
  }

  async print(commands: Uint8Array): Promise<PrintJobResult> {
    if (!this.rxChar) {
      return { status: "offline", retryable: true };
    }
    try {
      await this.rxChar.writeValue(commands);
      return { status: "success" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("Network") || message.includes("disconnected")) {
        return { status: "offline", retryable: true };
      }
      return { status: "error", retryable: true, reason: message };
    }
  }

  async queryStatus(): Promise<PrintJobResult & { status: "success" | "offline" | "paper-low" | "error" }> {
    if (!this.server || !this.server.connected) {
      return { status: "offline", retryable: true };
    }
    // Most Bluetooth thermal printers do not expose a readable status characteristic.
    // We assume success if connected; paper-low detection is not available on most BLE printers.
    return { status: "success" };
  }
}
