@echo off
setlocal
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Run pnpm install and pnpm build first.
  pause
  exit /b 1
)
where py.exe >nul 2>nul
if not errorlevel 1 (
  py -3 scripts\open-library.py
  goto finished
)
where python.exe >nul 2>nul
if not errorlevel 1 (
  python scripts\open-library.py
  goto finished
)
where pnpm >nul 2>nul
if not errorlevel 1 (
  call pnpm --filter @coverage/web exec vite preview --host 127.0.0.1 --port 8765 --strictPort --open
  goto finished
)
echo Install Python 3, or run pnpm install and pnpm preview in this directory.
pause
exit /b 1
:finished
if errorlevel 1 pause
