"use client";

import { useState, FormEvent, useEffect } from "react";
import { getAll, putOne, deleteOne } from "../lib/db";
import type { PrinterProfile, PrinterConnectionType, PrinterRole, PrinterActivityLog } from "@/lib/types";
import { PrinterService, createPrinterBackend, buildReceipt } from "@/lib/printer";
import { logPrinterActivity } from "./audit-trail";

export function PrinterSettingsPanel() {
  const [printers, setPrinters] = useState<PrinterProfile[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      const saved = await getAll("printerProfiles") as PrinterProfile[];
      setPrinters(saved);
      setLoaded(true);
    }
    load();
  }, []);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newConnection, setNewConnection] = useState<PrinterConnectionType>("usb");
  const [newAddress, setNewAddress] = useState("");
  const [newPaperWidth, setNewPaperWidth] = useState<58 | 80>(80);
  const [newCharSet, setNewCharSet] = useState("UTF-8");
  const [newRole, setNewRole] = useState<PrinterRole>("both");
  const [newBaudRate, setNewBaudRate] = useState(9600);
  const [newBridgeUrl, setNewBridgeUrl] = useState("http://localhost:9101");

  // Receipt Layout state
  const [headerLines, setHeaderLines] = useState("");
  const [footerLines, setFooterLines] = useState("");
  const [autoCut, setAutoCut] = useState(true);
  const [partialCut, setPartialCut] = useState(false);
  const [maxReceiptLines, setMaxReceiptLines] = useState(40);
  const [autoCondense, setAutoCondense] = useState(false);

  // Toast state
  const [toast, setToast] = useState<string | null>(null);

  // Scanning state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Browser capability warnings
  const serialAvailable = typeof navigator !== "undefined" && "serial" in navigator;
  const bluetoothAvailable = typeof navigator !== "undefined" && "bluetooth" in navigator;

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function addressLabel(type: PrinterConnectionType): string {
    if (type === "usb") return "Device Path";
    if (type === "bluetooth") return "MAC Address";
    return "IP Address";
  }

  function statusLabel(status: PrinterProfile["status"]): string {
    if (status === "online") return "Online";
    if (status === "offline") return "Offline";
    if (status === "paper-low") return "Paper Low";
    return "Error";
  }

  async function handleAddPrinter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const newPrinter: PrinterProfile = {
      id: crypto.randomUUID(),
      label: newLabel,
      connectionType: newConnection,
      address: newAddress,
      paperWidth: newPaperWidth,
      characterSet: newCharSet,
      autocut: autoCut,
      partialCut: partialCut,
      role: newRole,
      isDefault: false,
      status: "offline",
      baudRate: newConnection === "usb" ? newBaudRate : undefined,
      bridgeUrl: newConnection === "lan" ? newBridgeUrl : undefined,
    };
    await putOne("printerProfiles", newPrinter);
    setPrinters((prev) => [...prev, newPrinter]);
    setNewLabel("");
    setNewAddress("");
    setNewBaudRate(9600);
    setNewBridgeUrl("http://localhost:9101");
    setShowAddForm(false);
  }

  async function deletePrinter(id: string) {
    await deleteOne("printerProfiles", id);
    setPrinters((prev) => prev.filter((p) => p.id !== id));
  }

  async function testPrint(printer: PrinterProfile) {
    setToast(`Connecting to ${printer.label}…`);
    const service = new PrinterService(createPrinterBackend);
    const connectResult = await service.connect(printer);
    if (connectResult.status !== "success") {
      setToast(`Connection failed: ${connectResult.status}`);
      await logPrinterActivity({
        jobType: "receipt",
        timestamp: new Date().toISOString(),
        printerUsed: printer.label,
        status: "failed",
        failureReason: connectResult.status,
      });
      return;
    }

    const sample = buildReceipt("normal", printer, undefined, null, {
      headerLines: headerLines ? headerLines.split("\n") : undefined,
      footerLines: footerLines ? footerLines.split("\n") : undefined,
    });
    const printResult = await service.print(sample);
    await service.disconnect();

    if (printResult.status === "success") {
      setToast("Test print sent successfully");
    } else {
      setToast(`Print failed: ${printResult.status}`);
    }

    await logPrinterActivity({
      jobType: "receipt",
      timestamp: new Date().toISOString(),
      printerUsed: printer.label,
      status: printResult.status === "success" ? "success" : "failed",
      failureReason: "reason" in printResult ? printResult.reason : undefined,
    });

    // Update profile status in state
    setPrinters((prev) =>
      prev.map((p) =>
        p.id === printer.id
          ? { ...p, status: printResult.status === "success" ? "online" as const : "offline" as const }
          : p
      )
    );
    await putOne("printerProfiles", { ...printer, status: printResult.status === "success" ? "online" : "offline" });
  }

  async function autoDetectUsb() {
    if (!serialAvailable) {
      setScanResult("Web Serial API is not available in this browser. Use Chrome or Edge on HTTPS/localhost.");
      return;
    }
    setScanning(true);
    setScanResult(null);
    try {
      // @ts-expect-error navigator.serial is experimental
      const port = await navigator.serial.requestPort();
      // @ts-expect-error getInfo is experimental
      const info = port.getInfo ? port.getInfo() : {};
      const detected: PrinterProfile = {
        id: crypto.randomUUID(),
        label: `USB Printer (${info.usbVendorId?.toString(16) ?? "unknown"})`,
        connectionType: "usb",
        address: "USB Serial",
        paperWidth: 80,
        characterSet: "UTF-8",
        autocut: true,
        partialCut: false,
        role: "both",
        isDefault: false,
        status: "offline",
        baudRate: 9600,
        portInfo: {
          vendorId: info.usbVendorId,
          productId: info.usbProductId,
        },
      };
      await putOne("printerProfiles", detected);
      setPrinters((prev) => [...prev, detected]);
      setScanResult("Found 1 new USB printer and added it to the list.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("No port selected") || msg.includes("NotFoundError")) {
        setScanResult("No new printers found.");
      } else {
        setScanResult(`Error: ${msg}`);
      }
    } finally {
      setScanning(false);
    }
  }

  async function pairBluetoothPrinter() {
    if (!bluetoothAvailable) {
      setScanResult("Web Bluetooth API is not available in this browser. Use Chrome or Edge on HTTPS/localhost.");
      return;
    }
    setScanning(true);
    setScanResult(null);
    try {
      // @ts-expect-error navigator.bluetooth is experimental
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ["000018f0-0000-1000-8000-00805f9b34fb"] }],
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb", "00001101-0000-1000-8000-00805f9b34fb"],
      });
      const detected: PrinterProfile = {
        id: crypto.randomUUID(),
        label: `Bluetooth Printer (${(device as unknown as { name?: string }).name ?? "unknown"})`,
        connectionType: "bluetooth",
        address: device.id,
        paperWidth: 80,
        characterSet: "UTF-8",
        autocut: true,
        partialCut: false,
        role: "both",
        isDefault: false,
        status: "offline",
        deviceId: device.id,
      };
      await putOne("printerProfiles", detected);
      setPrinters((prev) => [...prev, detected]);
      setScanResult("Paired Bluetooth printer and added it to the list.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotFoundError") || msg.includes("User cancelled")) {
        setScanResult("No Bluetooth printer selected.");
      } else {
        setScanResult(`Error: ${msg}`);
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <section className="panel settings-panel">
      <h2>Printer Settings</h2>

      {/* Browser capability warnings */}
      {(!serialAvailable || !bluetoothAvailable) && (
        <div style={{ background: "#fff3cd", color: "#664d03", padding: "8px 12px", borderRadius: "4px", fontSize: "13px", marginBottom: "12px" }}>
          {!serialAvailable && <div>Web Serial API unavailable — USB printer auto-detect will not work. Use Chrome/Edge on HTTPS/localhost.</div>}
          {!bluetoothAvailable && <div>Web Bluetooth API unavailable — Bluetooth printer pairing will not work. Use Chrome/Edge on HTTPS/localhost.</div>}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button className="primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "Add Printer"}
        </button>
        <button onClick={autoDetectUsb} disabled={scanning}>
          Auto-Detect USB Printers
        </button>
        <button onClick={pairBluetoothPrinter} disabled={scanning}>
          Pair Bluetooth Printer
        </button>
      </div>

      {/* Scanning animation */}
      {scanning && (
        <div className="scan-animation">
          <div className="scan-spinner" />
          Scanning for USB printers...
        </div>
      )}
      {scanResult && !scanning && (
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
          {scanResult}
        </p>
      )}

      {/* Add Printer Form (PR-1, PR-2) */}
      {showAddForm && (
        <form className="add-printer-form" onSubmit={handleAddPrinter}>
          <h3>Add Printer</h3>
          <div className="form-grid">
            <label className="input-label">
              Printer Label
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Counter 1 Printer"
                required
              />
            </label>

            <div className="input-label">
              Connection Type
              <div className="connection-type-selector">
                {(["usb", "bluetooth", "lan"] as PrinterConnectionType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={newConnection === type ? "active" : ""}
                    onClick={() => setNewConnection(type)}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <label className="input-label">
              {addressLabel(newConnection)}
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder={
                  newConnection === "usb"
                    ? "/dev/usb/lp0"
                    : newConnection === "bluetooth"
                    ? "00:11:22:33:44:55"
                    : "192.168.1.100"
                }
                required
              />
            </label>

            {newConnection === "usb" && (
              <label className="input-label">
                Baud Rate
                <input
                  type="number"
                  value={newBaudRate}
                  onChange={(e) => setNewBaudRate(Number(e.target.value))}
                  placeholder="9600"
                  required
                />
              </label>
            )}

            {newConnection === "lan" && (
              <label className="input-label">
                Bridge URL
                <input
                  type="text"
                  value={newBridgeUrl}
                  onChange={(e) => setNewBridgeUrl(e.target.value)}
                  placeholder="http://localhost:9101"
                  required
                />
              </label>
            )}

            <div className="input-label">
              Paper Width
              <div className="connection-type-selector">
                {([58, 80] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    className={newPaperWidth === w ? "active" : ""}
                    onClick={() => setNewPaperWidth(w)}
                  >
                    {w}mm
                  </button>
                ))}
              </div>
            </div>

            <label className="input-label">
              Character Set
              <select value={newCharSet} onChange={(e) => setNewCharSet(e.target.value)}>
                <option value="UTF-8">UTF-8</option>
                <option value="ESC/POS Standard">ESC/POS Standard</option>
              </select>
            </label>

            <label className="input-label">
              Role
              <select value={newRole} onChange={(e) => setNewRole(e.target.value as PrinterRole)}>
                <option value="or">OR Printer</option>
                <option value="report">Report Printer</option>
                <option value="both">Both</option>
              </select>
            </label>

            <button className="primary" type="submit">Save Printer</button>
          </div>
        </form>
      )}

      {/* Printer List Table (PR-1, PR-5) */}
      <table className="printer-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Connection</th>
            <th>Address</th>
            <th>Paper</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {!loaded && printers.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: "var(--muted)", textAlign: "center" }}>
                Loading printers...
              </td>
            </tr>
          )}
          {loaded && printers.length === 0 && (
            <tr>
              <td colSpan={7} style={{ color: "var(--muted)", textAlign: "center" }}>
                No printers configured.
              </td>
            </tr>
          )}
          {printers.map((printer) => (
            <tr key={printer.id}>
              <td>
                {printer.label}
                {printer.isDefault && (
                  <span style={{ fontSize: "11px", color: "var(--primary)", marginLeft: "6px" }}>
                    Default
                  </span>
                )}
              </td>
              <td>{printer.connectionType.toUpperCase()}</td>
              <td>{printer.address}</td>
              <td>{printer.paperWidth}mm</td>
              <td>{printer.role === "or" ? "OR Printer" : printer.role === "report" ? "Report" : "Both"}</td>
              <td>
                <span className={`printer-status-dot ${printer.status}`} />
                {statusLabel(printer.status)}
              </td>
              <td style={{ display: "flex", gap: "6px" }}>
                <button className="primary" onClick={() => testPrint(printer)} style={{ fontSize: "12px", padding: "4px 10px" }}>
                  Test Print
                </button>
                {printer.connectionType === "lan" && (
                  <button
                    className="secondary"
                    onClick={async () => {
                      const { LanBridgeBackend } = await import("@/lib/printer/lan-bridge-service");
                      const backend = new LanBridgeBackend();
                      const res = await backend.connect(printer);
                      setToast(res.status === "success" ? "Bridge reachable" : `Bridge unreachable: ${res.status}`);
                    }}
                    style={{ fontSize: "12px", padding: "4px 10px" }}
                  >
                    Test Bridge
                  </button>
                )}
                <button
                  className="danger"
                  onClick={() => deletePrinter(printer.id)}
                  style={{ fontSize: "12px", padding: "4px 10px" }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Receipt Layout Panel (PR-3) */}
      <div className="receipt-layout-section">
        <h3>Receipt Layout</h3>

        <div className="logo-upload-area">
          <span>Upload Logo</span>
          <input
            type="file"
            accept="image/*"
            style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
          />
        </div>

        <div className="form-grid">
          <label className="input-label">
            Header Lines
            <textarea
              value={headerLines}
              onChange={(e) => setHeaderLines(e.target.value)}
              placeholder="Additional header lines"
              rows={2}
            />
          </label>
          <label className="input-label">
            Footer Lines
            <textarea
              value={footerLines}
              onChange={(e) => setFooterLines(e.target.value)}
              placeholder="e.g. Thank you! Come again"
              rows={2}
            />
          </label>

          {/* Auto-Cut toggle (PR-27) */}
          <div className="toggle-row">
            <div
              className={`toggle-switch ${autoCut ? "active" : ""}`}
              onClick={() => {
                setAutoCut(!autoCut);
                if (autoCut) setPartialCut(false);
              }}
              role="switch"
              aria-checked={autoCut}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAutoCut(!autoCut);
                  if (autoCut) setPartialCut(false);
                }
              }}
            />
            <span>Auto-Cut</span>
          </div>

          {/* Partial Cut toggle (PR-27) */}
          <div className="toggle-row">
            <div
              className={`toggle-switch ${partialCut ? "active" : ""} ${!autoCut ? "" : ""}`}
              onClick={() => {
                if (autoCut) setPartialCut(!partialCut);
              }}
              role="switch"
              aria-checked={partialCut}
              aria-disabled={!autoCut}
              tabIndex={0}
              style={!autoCut ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
              onKeyDown={(e) => {
                if (autoCut && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  setPartialCut(!partialCut);
                }
              }}
            />
            <span style={!autoCut ? { opacity: 0.45 } : undefined}>Partial Cut</span>
          </div>

          {/* Max Receipt Length (PR-26) */}
          <label className="input-label">
            Max Receipt Lines
            <input
              type="number"
              value={maxReceiptLines}
              onChange={(e) => setMaxReceiptLines(Number(e.target.value))}
              min={10}
            />
          </label>

          <div className="toggle-row">
            <div
              className={`toggle-switch ${autoCondense ? "active" : ""}`}
              onClick={() => setAutoCondense(!autoCondense)}
              role="switch"
              aria-checked={autoCondense}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setAutoCondense(!autoCondense);
                }
              }}
            />
            <span>Auto-condense long receipts</span>
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast && <div className="toast-notification">{toast}</div>}
    </section>
  );
}
