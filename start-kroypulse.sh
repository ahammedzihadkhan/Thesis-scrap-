#!/bin/sh
# KroyPulse - runs only on this computer (http://127.0.0.1:4173). No data leaves the device.
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Install Node.js 20+ from https://nodejs.org"; exit 1; }
[ -d node_modules ] || npm install --no-audit --no-fund
npm start
