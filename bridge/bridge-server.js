/**
 * PharmaPOS LAN Printer Bridge
 *
 * Lightweight Node.js HTTP bridge that receives Base64-encoded ESC/POS commands
 * and forwards them over a raw TCP socket to a thermal printer.
 *
 * Usage:
 *   node bridge-server.js [--port 9101] [--printer-port 9100]
 *
 * Endpoints:
 *   POST /print      { printerIp, printerPort?, commandsBase64 }
 *   GET  /health     { status: "ok" }
 */

const http = require("http");
const net = require("net");

const PORT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === "--port") ?? "9101", 10);
const DEFAULT_PRINTER_PORT = parseInt(process.argv.find((a, i) => process.argv[i - 1] === "--printer-port") ?? "9100", 10);

function sendToPrinter(ip, port, buffer, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    let resolved = false;

    function finish(result) {
      if (resolved) return;
      resolved = true;
      try {
        client.destroy();
      } catch {
        // ignore
      }
      resolve(result);
    }

    client.setTimeout(timeoutMs);
    client.on("timeout", () => finish({ success: false, status: "error", message: "TCP connection timed out" }));
    client.on("error", (err) => finish({ success: false, status: "error", message: err.message }));
    client.on("close", () => finish({ success: true, status: "success" }));

    client.connect(port, ip, () => {
      client.write(buffer, () => {
        // Give printer a moment to process before closing
        setTimeout(() => {
          client.end();
        }, 500);
      });
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && req.url === "/print") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body);
        const printerIp = payload.printerIp;
        const printerPort = payload.printerPort ?? DEFAULT_PRINTER_PORT;
        const commandsBase64 = payload.commandsBase64;

        if (!printerIp || !commandsBase64) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, status: "error", message: "Missing printerIp or commandsBase64" }));
          return;
        }

        const buffer = Buffer.from(commandsBase64, "base64");
        const result = await sendToPrinter(printerIp, printerPort, buffer);

        res.writeHead(result.success ? 200 : 502, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, status: "error", message: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ success: false, status: "error", message: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`PharmaPOS LAN Printer Bridge listening on http://localhost:${PORT}`);
  console.log(`Default printer port: ${DEFAULT_PRINTER_PORT}`);
});
