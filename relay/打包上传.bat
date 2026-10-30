@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-zip.ps1"
if errorlevel 1 (
  echo.
  echo Failed to create relay.zip
) else (
  echo.
  echo relay.zip is ready. Upload it to Tencent SCF.
)
echo.
pause
