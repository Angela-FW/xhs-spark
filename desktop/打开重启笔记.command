#!/bin/bash
# 双击即可：若服务未开则自动启动，再打开浏览器
# 可复制到桌面；也可直接双击仓库里的本文件

set -e
PORT=43123
PROJECT="${RESTART_NOTES_DIR:-$HOME/xhs-spark}"

# 若从仓库 desktop/ 运行，优先用仓库根目录
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/../package.json" ]; then
  PROJECT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

if [ ! -f "$PROJECT/package.json" ]; then
  osascript -e "display dialog \"找不到项目目录：\n$PROJECT\n\n请确认项目在 ~/xhs-spark，或设置环境变量 RESTART_NOTES_DIR。\" buttons {\"好\"} default button 1 with icon stop" 2>/dev/null || true
  exit 1
fi

cd "$PROJECT" || exit 1

if ! curl -s -o /dev/null --connect-timeout 1 "http://127.0.0.1:${PORT}/"; then
  # 在后台启动；用 nohup 避免关掉终端窗口后进程被杀
  nohup npm run dev -- --port "$PORT" --hostname 127.0.0.1 >/tmp/restart-notes-dev.log 2>&1 &
  for i in {1..40}; do
    if curl -s -o /dev/null --connect-timeout 1 "http://127.0.0.1:${PORT}/"; then
      break
    fi
    sleep 0.5
  done
fi

open "http://127.0.0.1:${PORT}/"
