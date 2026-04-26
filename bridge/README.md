# PharmaPOS LAN Printer Bridge

A lightweight Node.js bridge for forwarding ESC/POS print commands from the browser to a network thermal printer over raw TCP.

## Why this exists

Browsers cannot open raw TCP sockets. This local bridge runs alongside the browser (on the POS terminal) and receives HTTP requests from the PharmaPOS web app, then forwards the Base64-encoded ESC/POS payload to the printer via TCP.

## Setup

Requires **Node.js** (v14+).

```bash
cd bridge
node bridge-server.js
```

Options:
```bash
node bridge-server.js --port 9101 --printer-port 9100
```

## Endpoints

- `GET /health` — Returns `{ status: "ok" }` for connectivity checks.
- `POST /print` — Accepts `{ printerIp, printerPort?, commandsBase64 }`. Forwards decoded bytes to the printer and returns `{ success, status, message }`.

## Browser requirements

The web app expects the bridge at `http://localhost:9101` by default. Change per-printer in **Settings > Printer > Bridge URL** if needed.

## CORS

The bridge sends `Access-Control-Allow-Origin: *` so the PWA (served from any origin during development) can reach it.
