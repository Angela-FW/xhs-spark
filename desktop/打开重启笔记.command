#!/bin/bash
# 把本文件拖到桌面后双击即可（需先把项目克隆到本机）
cd "$(dirname "$0")/.." || exit 1
PORT=43123
if ! curl -s -o /dev/null --connect-timeout 1 "http://127.0.0.1:${PORT}/"; then
  npm run dev -- --port "$PORT" --hostname 127.0.0.1 &
  for i in {1..30}; do
    curl -s -o /dev/null --connect-timeout 1 "http://127.0.0.1:${PORT}/" && break
    sleep 1
  done
fi
open "http://127.0.0.1:${PORT}/" 2>/dev/null || xdg-open "http://127.0.0.1:${PORT}/" 2>/dev/null
