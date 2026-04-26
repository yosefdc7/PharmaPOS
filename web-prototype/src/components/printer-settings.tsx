"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { deleteOne, getAll, getOne, putOne } from "../lib/db";
import type { BirSettings, PrinterConnectionType, PrinterProfile, PrinterRole } from "@/lib/types";
import {
  applyPrinterRoleDefault,
  buildReceipt,
  createDefaultReceiptLayout,
  createPrinterBackend,
  getPrinterDefaultLabel,
  getReceiptLayout,
  getReceiptLayoutOptions,
  normalizePrinterProfile,
  PrinterService
} from "@/lib/printer";
import { logPrinterActivity } from "./audit-trail";

const DEFAULT_BRIDGE_URL = "http://localhost:9101";

export function PrinterSettingsPanel() {
  const [printers, setPrinters] = useState<PrinterProfile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newConnection, setNewConnection] = useState<PrinterConnectionType>("usb");
  const [newAddress, setNewAddress] = useState("");
  const [newPaperWidth, setNewPaperWidth] = useState<58 | 80>(80);
  const [newCharSet, setNewCharSet] = useState("UTF-8");
  const [newRole, setNewRole] = useState<PrinterRole>("both");
  const [newBaudRate, setNewBaudRate] = useState(9600);
  const [newBridgeUrl, setNewBridgeUrl] = useState(DEFAULT_BRIDGE_URL);

  const [headerLines, setHeaderLines] = useState("");
  const [footerLines, setFooterLines] = useState("");
  const [autoCut, setAutoCut] = useState(true);
  const [partialCut, setPartialCut] = useState(false);
  const [maxReceiptLines, setMaxReceiptLines] = useState(40);
  const [autoCondense, setAutoCondense] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const serialAvailable = typeof navigator !== "undefined" && "serial" in navigator;
  const bluetoothAvailable = typeof navigator !== "undefined" && "bluetooth" in navigator;

  const selectedPrinter = useMemo(
    () => printers.find((printer) => printer.id === selectedPrinterId) ?? null,
    [printers, selectedPrinterId]
  );

  useEffect(() => {
    async function load() {
      const saved = (await getAll("printerProfiles")).map(normalizePrinterProfile);
      setPrinters(saved);
      setSelectedPrinterId((current) => current || saved[0]?.id || "");
      setLoaded(true);
    }

    load();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    if (!selectedPrinter) {
      const layout = createDefaultReceiptLayout();
      setHeaderLines(layout.headerLines.join("\n"));
      setFooterLines(layout.footerLines.join("\n"));
      setAutoCut(true);
      setPartialCut(false);
      setMaxReceiptLines(layout.maxReceiptLines);
      setAutoCondense(layout.autoCondense);
      return;
    }

    const layout = getReceiptLayout(selectedPrinter);
    setHeaderLines(layout.headerLines.join("\n"));
    setFooterLines(layout.footerLines.join("\n"));
    setAutoCut(selectedPrinter.autocut);
    setPartialCut(selectedPrinter.partialCut);
    setMaxReceiptLines(layout.maxReceiptLines);
    setAutoCondense(layout.autoCondense);
  }, [selectedPrinter]);

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

  async function persistProfiles(updated: PrinterProfile[]) {
    setPrinters(updated);
    await Promise.all(updated.map((printer) => putOne("printerProfiles", printer)));
  }

  async function replacePrinter(updatedPrinter: PrinterProfile) {
    const updated = printers.map((printer) => (printer.id === updatedPrinter.id ? normalizePrinterProfile(updatedPrinter) : printer));
    setPrinters(updated);
    await putOne("printerProfiles", normalizePrinterProfile(updatedPrinter));
  }

  function buildLayoutDraft() {
    return {
      logoUrl: selectedPrinter?.receiptLayout?.logoUrl ?? "",
      headerLines: headerLines.split("\n").map((line) => line.trim()).filter(Boolean),
      footerLines: footerLines.split("\n").map((line) => line.trim()).filter(Boolean),
      maxReceiptLines: Math.max(10, maxReceiptLines || 40),
      autoCondense
    };
  }

  async function handleAddPrinter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const newPrinter = normalizePrinterProfile({
      id: crypto.randomUUID(),
      label: newLabel,
      connectionType: newConnection,
      address: newAddress,
      paperWidth: newPaperWidth,
      characterSet: newCharSet,
      autocut: true,
      partialCut: false,
      role: newRole,
      isDefault: false,
      defaultForOr: false,
      defaultForReport: false,
      status: "offline",
      baudRate: newConnection === "usb" ? newBaudRate : undefined,
      bridgeUrl: newConnection === "lan" ? newBridgeUrl : undefined,
      receiptLayout: createDefaultReceiptLayout()
    });

    await putOne("printerProfiles", newPrinter);
    setPrinters((current) => [...current, newPrinter]);
    setSelectedPrinterId((current) => current || newPrinter.id);
    setNewLabel("");
    setNewAddress("");
    setNewBaudRate(9600);
    setNewBridgeUrl(DEFAULT_BRIDGE_URL);
    setShowAddForm(false);
  }

  async function deletePrinter(id: string) {
    await deleteOne("printerProfiles", id);
    const updated = printers.filter((printer) => printer.id !== id);
    setPrinters(updated);
    setSelectedPrinterId((current) => (current === id ? updated[0]?.id || "" : current));
  }

  async function saveLayout() {
    if (!selectedPrinter) {
      return;
    }

    const updatedPrinter = normalizePrinterProfile({
      ...selectedPrinter,
      autocut: autoCut,
      partialCut: partialCut && autoCut,
      receiptLayout: buildLayoutDraft()
    });

    await replacePrinter(updatedPrinter);
    setToast(`Saved receipt layout for ${updatedPrinter.label}`);
  }

  async function setDefault(printerId: string, role: "or" | "report") {
    const updated = applyPrinterRoleDefault(printers, printerId, role).map(normalizePrinterProfile);
    await persistProfiles(updated);
    setToast(role === "or" ? "Updated default OR printer" : "Updated default report printer");
  }

  async function testPrint(printer: PrinterProfile) {
    setToast(`Connecting to ${printer.label}...`);

    const bir = await getOne("birSettings", "bir") as BirSettings | undefined;
    const service = new PrinterService(createPrinterBackend);
    const connectResult = await service.connect(printer);
    if (connectResult.status !== "success") {
      setToast(`Connection failed: ${connectResult.status}`);
      await logPrinterActivity({
        jobType: "receipt",
        timestamp: new Date().toISOString(),
        printerUsed: printer.label,
        status: "failed",
        failureReason: connectResult.status
      });
      return;
    }

    const sample = buildReceipt("normal", printer, bir, null, getReceiptLayoutOptions(printer));
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
      failureReason: "reason" in printResult ? printResult.reason : undefined
    });

    await replacePrinter({
      ...printer,
      status: printResult.status === "success" ? "online" : "offline"
    });
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
      const detected = normalizePrinterProfile({
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
        defaultForOr: false,
        defaultForReport: false,
        status: "offline",
        baudRate: 9600,
        portInfo: {
          vendorId: info.usbVendorId,
          productId: info.usbProductId
        },
        receiptLayout: createDefaultReceiptLayout()
      });
      await putOne("printerProfiles", detected);
      setPrinters((current) => [...current, detected]);
      setSelectedPrinterId((current) => current || detected.id);
      setScanResult("Found 1 new USB printer and added it to the list.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("No port selected") || message.includes("NotFoundError")) {
        setScanResult("No new printers found.");
      } else {
        setScanResult(`Error: ${message}`);
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
        optionalServices: ["000018f0-0000-1000-8000-00805f9b34fb", "00001101-0000-1000-8000-00805f9b34fb"]
      });

      const detected = normalizePrinterProfile({
        id: crypto.randomUUID(),
        label: `Bluetooth Printer (${(device as { name?: string }).name ?? "unknown"})`,
        connectionType: "bluetooth",
        address: device.id,
        paperWidth: 80,
        characterSet: "UTF-8",
        autocut: true,
        partialCut: false,
        role: "both",
        isDefault: false,
        defaultForOr: false,
        defaultForReport: false,
        status: "offline",
        deviceId: device.id,
        receiptLayout: createDefaultReceiptLayout()
      });
      await putOne("printerProfiles", detected);
      setPrinters((current) => [...current, detected]);
      setSelectedPrinterId((current) => current || detected.id);
      setScanResult("Paired Bluetooth printer and added it to the list.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("NotFoundError") || message.includes("User cancelled")) {
        setScanResult("No Bluetooth printer selected.");
      } else {
        setScanResult(`Error: ${message}`);
      }
    } finally {
      setScanning(false);
    }
  }

  return (
    <section className="panel settings-panel">
      <h2>Printer Settings</h2>

      {(!serialAvailable || !bluetoothAvailable) && (
        <div style={{ background: "#fff3cd", color: "#664d03", padding: "8px 12px", borderRadius: "4px", fontSize: "13px", marginBottom: "12px" }}>
          {!serialAvailable && <div>Web Serial API unavailable - USB printer auto-detect will not work. Use Chrome/Edge on HTTPS/localhost.</div>}
          {!bluetoothAvailable && <div>Web Bluetooth API unavailable - Bluetooth printer pairing will not work. Use Chrome/Edge on HTTPS/localhost.</div>}
        </div>
      )}

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

      {scanning && (
        <div className="scan-animation">
          <div className="scan-spinner" />
          Scanning for printers...
        </div>
      )}
      {scanResult && !scanning && (
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
          {scanResult}
        </p>
      )}

      {showAddForm && (
        <form className="add-printer-form" onSubmit={handleAddPrinter}>
          <h3>Add Printer</h3>
          <div className="form-grid">
            <label className="input-label">
              Printer Label
              <input
                type="text"
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
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
                onChange={(event) => setNewAddress(event.target.value)}
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
                  onChange={(event) => setNewBaudRate(Number(event.target.value))}
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
                  onChange={(event) => setNewBridgeUrl(event.target.value)}
                  placeholder={DEFAULT_BRIDGE_URL}
                  required
                />
              </label>
            )}

            <div className="input-label">
              Paper Width
              <div className="connection-type-selector">
                {([58, 80] as const).map((width) => (
                  <button
                    key={width}
                    type="button"
                    className={newPaperWidth === width ? "active" : ""}
                    onClick={() => setNewPaperWidth(width)}
                  >
                    {width}mm
                  </button>
                ))}
              </div>
            </div>

            <label className="input-label">
              Character Set
              <select value={newCharSet} onChange={(event) => setNewCharSet(event.target.value)}>
                <option value="UTF-8">UTF-8</option>
                <option value="ESC/POS Standard">ESC/POS Standard</option>
              </select>
            </label>

            <label className="input-label">
              Role
              <select value={newRole} onChange={(event) => setNewRole(event.target.value as PrinterRole)}>
                <option value="or">OR Printer</option>
                <option value="report">Report Printer</option>
                <option value="both">Both</option>
              </select>
            </label>

            <button className="primary" type="submit">
              Save Printer
            </button>
          </div>
        </form>
      )}

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
          {printers.map((printer) => {
            const defaultLabel = getPrinterDefaultLabel(printer);

            return (
              <tr key={printer.id}>
                <td>
                  {printer.label}
                  {defaultLabel ? (
                    <span style={{ fontSize: "11px", color: "var(--primary)", marginLeft: "6px" }}>
                      {defaultLabel}
                    </span>
                  ) : null}
                </td>
                <td>{printer.connectionType.toUpperCase()}</td>
                <td>{printer.address}</td>
                <td>{printer.paperWidth}mm</td>
                <td>{printer.role === "or" ? "OR Printer" : printer.role === "report" ? "Report" : "Both"}</td>
                <td>
                  <span className={`printer-status-dot ${printer.status}`} />
                  {statusLabel(printer.status)}
                </td>
                <td style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  <button className="primary" onClick={() => testPrint(printer)} style={{ fontSize: "12px", padding: "4px 10px" }}>
                    Test Print
                  </button>
                  <button onClick={() => setSelectedPrinterId(printer.id)} style={{ fontSize: "12px", padding: "4px 10px" }}>
                    Edit Layout
                  </button>
                  {(printer.role === "or" || printer.role === "both") && (
                    <button
                      onClick={() => setDefault(printer.id, "or")}
                      disabled={Boolean(printer.defaultForOr)}
                      style={{ fontSize: "12px", padding: "4px 10px" }}
                    >
                      Default OR
                    </button>
                  )}
                  {(printer.role === "report" || printer.role === "both") && (
                    <button
                      onClick={() => setDefault(printer.id, "report")}
                      disabled={Boolean(printer.defaultForReport)}
                      style={{ fontSize: "12px", padding: "4px 10px" }}
                    >
                      Default Report
                    </button>
                  )}
                  {printer.connectionType === "lan" && (
                    <button
                      className="secondary"
                      onClick={async () => {
                        const { LanBridgeBackend } = await import("@/lib/printer/lan-bridge-service");
                        const backend = new LanBridgeBackend();
                        const result = await backend.connect(printer);
                        setToast(result.status === "success" ? "Bridge reachable" : `Bridge unreachable: ${result.status}`);
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
            );
          })}
        </tbody>
      </table>

      <div className="receipt-layout-section">
        <h3>Receipt Layout</h3>
        {selectedPrinter ? (
          <p style={{ color: "var(--muted)", marginBottom: 12 }}>
            Editing saved layout for <strong>{selectedPrinter.label}</strong>.
          </p>
        ) : (
          <p style={{ color: "var(--muted)", marginBottom: 12 }}>
            Add a printer to configure saved receipt layout defaults.
          </p>
        )}

        <div className="form-grid">
          <label className="input-label">
            Layout Printer
            <select
              value={selectedPrinterId}
              onChange={(event) => setSelectedPrinterId(event.target.value)}
              disabled={printers.length === 0}
            >
              <option value="">Select a printer</option>
              {printers.map((printer) => (
                <option key={printer.id} value={printer.id}>
                  {printer.label}
                </option>
              ))}
            </select>
          </label>

          <div className="logo-upload-area">
            <span>Logo upload stays placeholder in this phase</span>
          </div>

          <label className="input-label">
            Header Lines
            <textarea
              value={headerLines}
              onChange={(event) => setHeaderLines(event.target.value)}
              placeholder="Additional header lines"
              rows={2}
              disabled={!selectedPrinter}
            />
          </label>

          <label className="input-label">
            Footer Lines
            <textarea
              value={footerLines}
              onChange={(event) => setFooterLines(event.target.value)}
              placeholder="Thank you! Come again"
              rows={2}
              disabled={!selectedPrinter}
            />
          </label>

          <div className="toggle-row">
            <div
              className={`toggle-switch ${autoCut ? "active" : ""}`}
              onClick={() => {
                if (!selectedPrinter) {
                  return;
                }
                setAutoCut(!autoCut);
                if (autoCut) {
                  setPartialCut(false);
                }
              }}
              role="switch"
              aria-checked={autoCut}
              tabIndex={selectedPrinter ? 0 : -1}
            />
            <span>Auto-Cut</span>
          </div>

          <div className="toggle-row">
            <div
              className={`toggle-switch ${partialCut ? "active" : ""}`}
              onClick={() => {
                if (!selectedPrinter || !autoCut) {
                  return;
                }
                setPartialCut(!partialCut);
              }}
              role="switch"
              aria-checked={partialCut}
              aria-disabled={!selectedPrinter || !autoCut}
              tabIndex={selectedPrinter ? 0 : -1}
              style={!selectedPrinter || !autoCut ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
            />
            <span style={!selectedPrinter || !autoCut ? { opacity: 0.45 } : undefined}>Partial Cut</span>
          </div>

          <label className="input-label">
            Max Receipt Lines
            <input
              type="number"
              value={maxReceiptLines}
              onChange={(event) => setMaxReceiptLines(Number(event.target.value))}
              min={10}
              disabled={!selectedPrinter}
            />
          </label>

          <div className="toggle-row">
            <div
              className={`toggle-switch ${autoCondense ? "active" : ""}`}
              onClick={() => {
                if (!selectedPrinter) {
                  return;
                }
                setAutoCondense(!autoCondense);
              }}
              role="switch"
              aria-checked={autoCondense}
              tabIndex={selectedPrinter ? 0 : -1}
            />
            <span>Auto-condense long receipts</span>
          </div>
        </div>

        <div className="settings-actions" style={{ marginTop: 12 }}>
          <button className="primary" onClick={saveLayout} disabled={!selectedPrinter}>
            Save Layout
          </button>
        </div>
      </div>

      {toast && <div className="toast-notification">{toast}</div>}
    </section>
  );
}
