"use client";

import { useState, FormEvent, useEffect } from "react";
import type { PrinterProfile, PrinterConnectionType, PrinterRole } from "@/lib/types";

export function PrinterSettingsPanel() {
  const [printers, setPrinters] = useState<PrinterProfile[]>([
    {
      id: "1",
      label: "Counter 1 Printer",
      connectionType: "usb",
      address: "/dev/usb/lp0",
      paperWidth: 80,
      characterSet: "UTF-8",
      autocut: true,
      partialCut: false,
      role: "both",
      isDefault: true,
      status: "online",
    },
    {
      id: "2",
      label: "Report Printer",
      connectionType: "lan",
      address: "192.168.1.100",
      paperWidth: 80,
      characterSet: "UTF-8",
      autocut: true,
      partialCut: true,
      role: "report",
      isDefault: false,
      status: "offline",
    },
  ]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newConnection, setNewConnection] = useState<PrinterConnectionType>("usb");
  const [newAddress, setNewAddress] = useState("");
  const [newPaperWidth, setNewPaperWidth] = useState<58 | 80>(80);
  const [newCharSet, setNewCharSet] = useState("UTF-8");
  const [newRole, setNewRole] = useState<PrinterRole>("both");

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

  function handleAddPrinter(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const newPrinter: PrinterProfile = {
      id: String(Date.now()),
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
    };
    setPrinters((prev) => [...prev, newPrinter]);
    setNewLabel("");
    setNewAddress("");
    setShowAddForm(false);
  }

  function deletePrinter(id: string) {
    setPrinters((prev) => prev.filter((p) => p.id !== id));
  }

  function testPrint() {
    setToast("Test print sent");
  }

  function autoDetectUsb() {
    setScanning(true);
    setScanResult(null);
    setTimeout(() => {
      setScanning(false);
      // 50% chance of finding a mock printer
      if (Math.random() > 0.5) {
        const mock: PrinterProfile = {
          id: String(Date.now()),
          label: "USB Printer (Auto-detected)",
          connectionType: "usb",
          address: "/dev/usb/lp1",
          paperWidth: 80,
          characterSet: "UTF-8",
          autocut: true,
          partialCut: false,
          role: "both",
          isDefault: false,
          status: "online",
        };
        setPrinters((prev) => [...prev, mock]);
        setScanResult("Found 1 new printer and added it to the list.");
      } else {
        setScanResult("No new printers found");
      }
    }, 2000);
  }

  return (
    <section className="panel settings-panel">
      <h2>Printer Settings</h2>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button className="primary" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? "Cancel" : "Add Printer"}
        </button>
        <button onClick={autoDetectUsb} disabled={scanning}>
          🔍 Auto-Detect USB Printers
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
          {printers.length === 0 && (
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
                <button className="primary" onClick={testPrint} style={{ fontSize: "12px", padding: "4px 10px" }}>
                  🖨️ Test Print
                </button>
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
