@echo off
REM 把本文件复制到桌面后双击（需先把项目克隆到本机）
cd /d "%~dp0\.."
set PORT=43123
curl -s -o NUL --connect-timeout 1 http://127.0.0.1:%PORT%/ >NUL 2>&1
if errorlevel 1 (
  start "重启笔记" cmd /c "npm run dev -- --port %PORT% --hostname 127.0.0.1"
  timeout /t 8 /nobreak >NUL
)
start "" http://127.0.0.1:%PORT%/
