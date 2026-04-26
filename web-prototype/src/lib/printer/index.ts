export { EscPosBuilder, initPrinter, line, text, align, bold, doubleHeight, normalSize } from "./escpos-commands";
export { buildReceipt, type ReceiptVariant } from "./receipt-content";
export { PrinterService, createPrinterBackend, type PrinterBackend } from "./printer-service";
export { WebSerialBackend } from "./web-serial-service";
export { WebBluetoothBackend } from "./web-bluetooth-service";
export { LanBridgeBackend } from "./lan-bridge-service";
export {
  applyPrinterRoleDefault,
  canServeRole,
  createDefaultReceiptLayout,
  getPrinterDefaultLabel,
  getReceiptLayout,
  getReceiptLayoutOptions,
  normalizePrinterProfile,
  resolvePrinterForRole,
  type PrintTargetRole
} from "./printer-config";
export {
  enqueuePrintJob,
  markJobStatus,
  removeJob,
  getPendingJobs,
  getAllJobs,
  clearPrintedJobs,
  commandsToBase64,
  base64ToCommands,
} from "./print-queue";
