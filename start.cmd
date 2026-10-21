@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=8765

echo.
echo   ========================================
echo            小越背单词 . 本地启动
echo   ========================================
echo.

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
  set "IP=%%a"
  goto :gotip
)
:gotip
set "IP=%IP: =%"

echo   电脑打开：  http://127.0.0.1:%PORT%
if defined IP (
  echo   手机打开：  http://%IP%:%PORT%
  echo              ^(手机和电脑要连同一个 WiFi^)
)
echo.
echo   关掉这个窗口 = 停止服务。
echo.

rem ---- 找一个能用的 Python（依次尝试）----
set "PYEXE="
py -c "pass" >nul 2>nul && set "PYEXE=py"
if not defined PYEXE (
  python -c "pass" >nul 2>nul && set "PYEXE=python"
)
if not defined PYEXE (
  if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" (
    set "PYEXE=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
  )
)

if not defined PYEXE (
  echo   [错误] 没找到 Python。
  echo   请安装： https://www.python.org/downloads/
  echo.
  pause
  exit /b 1
)

rem ---- 自动打开浏览器 ----
start "" "http://127.0.0.1:%PORT%/"

"%PYEXE%" -m http.server %PORT% --bind 0.0.0.0

echo.
echo   服务已停止。
pause
